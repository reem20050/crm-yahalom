/**
 * Auto Invoice Generator Service v2
 * Generates draft invoices automatically:
 * 1. When events are completed
 * 2. Monthly for active contracts with auto_invoice enabled
 *
 * v2 enhancements:
 * - Configurable VAT rate chain: contract → customer → system config → 17%
 * - Configurable payment terms chain: contract → customer → system config → 30 days
 * - Prorating for partial months (start/end mid-month)
 * - Custom billing description templates with variable substitution
 * - Invoice preview (dry-run) without inserting
 * - System config helpers
 */
const { query, generateUUID } = require('../config/database');

const HEBREW_MONTHS = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];

class AutoInvoiceGenerator {

  // ── System Config Helpers ───────────────────────────────────────────

  /**
   * Get a system config value by key
   * @param {string} key
   * @returns {string|undefined}
   */
  getSystemConfig(key) {
    const result = query('SELECT value FROM system_config WHERE key = $1', [key]);
    return result.rows[0]?.value;
  }

  /**
   * Update a system config value
   * @param {string} key
   * @param {string} value
   */
  updateSystemConfig(key, value) {
    query('UPDATE system_config SET value = $1, updated_at = CURRENT_TIMESTAMP WHERE key = $2', [value, key]);
  }

  // ── Resolution Chains ──────────────────────────────────────────────

  /**
   * Resolve VAT rate: contract → customer → system_config → 17.0
   */
  resolveVatRate(contract, customer) {
    if (contract.vat_rate != null && contract.vat_rate !== '') {
      return parseFloat(contract.vat_rate);
    }
    if (customer.default_vat_rate != null && customer.default_vat_rate !== '') {
      return parseFloat(customer.default_vat_rate);
    }
    const systemRate = this.getSystemConfig('default_vat_rate');
    if (systemRate != null) {
      return parseFloat(systemRate);
    }
    return 17.0;
  }

  /**
   * Resolve payment days: contract → customer → system_config → 30
   */
  resolvePaymentDays(contract, customer) {
    if (contract.payment_days != null && contract.payment_days !== '') {
      return parseInt(contract.payment_days);
    }
    if (customer.default_payment_days != null && customer.default_payment_days !== '') {
      return parseInt(customer.default_payment_days);
    }
    const systemDays = this.getSystemConfig('default_payment_days');
    if (systemDays != null) {
      return parseInt(systemDays);
    }
    return 30;
  }

  // ── Prorating Logic ────────────────────────────────────────────────

  /**
   * Calculate prorated amount for partial months
   * @returns {{ amount: number, isProrated: boolean }}
   */
  calculateProratedAmount(contract, monthlyValue, targetDate) {
    if (!contract.prorate_partial_months) {
      return { amount: monthlyValue, isProrated: false };
    }

    const year = targetDate.getFullYear();
    const month = targetDate.getMonth();
    const firstOfMonth = new Date(year, month, 1);
    const lastOfMonth = new Date(year, month + 1, 0);
    const totalDaysInMonth = lastOfMonth.getDate();

    let startDay = 1;
    let endDay = totalDaysInMonth;
    let isProrated = false;

    // Check if contract starts after 1st of current month
    if (contract.start_date) {
      const contractStart = new Date(contract.start_date);
      if (contractStart > firstOfMonth && contractStart.getMonth() === month && contractStart.getFullYear() === year) {
        startDay = contractStart.getDate();
        isProrated = true;
      }
    }

    // Check if contract ends before last day of current month
    if (contract.end_date) {
      const contractEnd = new Date(contract.end_date);
      if (contractEnd < lastOfMonth && contractEnd.getMonth() === month && contractEnd.getFullYear() === year) {
        endDay = contractEnd.getDate();
        isProrated = true;
      }
    }

    if (isProrated) {
      const activeDays = endDay - startDay + 1;
      const proratedAmount = monthlyValue * (activeDays / totalDaysInMonth);
      return { amount: Math.round(proratedAmount * 100) / 100, isProrated: true };
    }

    return { amount: monthlyValue, isProrated: false };
  }

  // ── Description Template ───────────────────────────────────────────

  /**
   * Build invoice description from template or default
   */
  buildDescription(contract, customerName, targetDate) {
    const monthName = HEBREW_MONTHS[targetDate.getMonth()];
    const year = targetDate.getFullYear();

    if (contract.billing_description_template) {
      return contract.billing_description_template
        .replace(/\{month\}/g, monthName)
        .replace(/\{year\}/g, String(year))
        .replace(/\{customer\}/g, customerName);
    }

    return `שירותי אבטחה - ${monthName} ${year} - ${customerName}`;
  }

  // ── Core: Build Invoice Data ───────────────────────────────────────

  /**
   * Build invoice data for a single contract (shared by generate and preview)
   * @returns {object|null} invoice data object or null if should skip
   */
  buildInvoiceData(contract, targetDate) {
    const currentMonth = targetDate.toISOString().slice(0, 7); // YYYY-MM

    // Check if already invoiced this month
    if (contract.last_invoiced_date && contract.last_invoiced_date.startsWith(currentMonth)) {
      return null; // skip
    }

    // Check that monthly_value is set
    if (!contract.monthly_value || contract.monthly_value <= 0) {
      return { error: `Contract ${contract.id} for ${contract.company_name}: no monthly value` };
    }

    // Resolve VAT and payment days
    const vatRate = this.resolveVatRate(contract, contract);
    const paymentDays = this.resolvePaymentDays(contract, contract);

    // Calculate prorated amount
    const { amount: baseAmount, isProrated } = this.calculateProratedAmount(
      contract, contract.monthly_value, targetDate
    );

    // Calculate financials
    const vatAmount = Math.round(baseAmount * (vatRate / 100) * 100) / 100;
    const totalAmount = Math.round((baseAmount + vatAmount) * 100) / 100;

    // Build description
    const description = this.buildDescription(contract, contract.company_name, targetDate);

    // Calculate dates
    const issueDate = targetDate.toISOString().split('T')[0];
    const dueDate = this.calculateDueDate(issueDate, paymentDays);

    return {
      customer_id: contract.customer_id,
      customer_name: contract.company_name,
      contract_id: contract.id,
      contract_name: contract.terms || `חוזה - ${contract.company_name}`,
      amount: baseAmount,
      vat_rate: vatRate,
      vat_amount: vatAmount,
      total: totalAmount,
      issue_date: issueDate,
      due_date: dueDate,
      is_prorated: isProrated,
      description,
      payment_days: paymentDays,
      auto_send: contract.auto_send_invoice === 1,
      invoice_email: contract.invoice_email,
    };
  }

  // ── Preview Monthly Invoices ───────────────────────────────────────

  /**
   * Preview monthly invoices without inserting into database
   * @returns {Array} array of preview objects
   */
  previewMonthlyInvoices() {
    const contracts = query(`
      SELECT ct.*,
             c.company_name, c.id as cust_id, c.business_id, c.address as customer_address,
             c.default_vat_rate, c.default_payment_days, c.auto_send_invoice, c.invoice_email
      FROM contracts ct
      JOIN customers c ON ct.customer_id = c.id
      WHERE ct.status = 'active'
      AND ct.auto_invoice = 1
      AND c.status = 'active'
      AND c.deleted_at IS NULL
    `);

    const now = new Date();
    const previews = [];

    for (const contract of contracts.rows) {
      const data = this.buildInvoiceData(contract, now);
      if (!data) continue; // skipped (already invoiced)
      if (data.error) {
        previews.push({ error: data.error, customer_name: contract.company_name, contract_id: contract.id });
        continue;
      }
      previews.push(data);
    }

    return previews;
  }

  // ── Generate Monthly Invoices ──────────────────────────────────────

  /**
   * Generate monthly invoices for all contracts with auto_invoice enabled
   * Called by cron on the 1st of each month
   * @param {string|null} createdBy - user ID or null for cron
   * @param {string[]|null} selectedContractIds - optional array to only generate for specific contracts
   * @returns {{ created: number, skipped: number, errors: string[] }}
   */
  generateMonthlyInvoices(createdBy = null, selectedContractIds = null) {
    const results = { created: 0, skipped: 0, errors: [] };

    // Get active contracts with auto_invoice enabled
    const contracts = query(`
      SELECT ct.*,
             c.company_name, c.id as cust_id, c.business_id, c.address as customer_address,
             c.default_vat_rate, c.default_payment_days, c.auto_send_invoice, c.invoice_email
      FROM contracts ct
      JOIN customers c ON ct.customer_id = c.id
      WHERE ct.status = 'active'
      AND ct.auto_invoice = 1
      AND c.status = 'active'
      AND c.deleted_at IS NULL
    `);

    const now = new Date();

    for (const contract of contracts.rows) {
      // If selectedContractIds provided, only process those
      if (selectedContractIds && !selectedContractIds.includes(contract.id)) {
        continue;
      }

      try {
        const data = this.buildInvoiceData(contract, now);
        if (!data) {
          results.skipped++;
          continue;
        }
        if (data.error) {
          results.errors.push(data.error);
          continue;
        }

        // Create draft invoice
        const invoiceId = generateUUID();

        query(`
          INSERT INTO invoices (id, customer_id, issue_date, due_date, amount, vat_amount, total_amount, description, status, auto_generated, source_type, source_id)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'draft', 1, 'contract', $9)
        `, [invoiceId, data.customer_id, data.issue_date, data.due_date, data.amount, data.vat_amount, data.total, data.description, data.contract_id]);

        // Update last_invoiced_date on contract
        query(`UPDATE contracts SET last_invoiced_date = $1 WHERE id = $2`, [data.issue_date, data.contract_id]);

        results.created++;

        // Auto-send via Green Invoice if enabled (non-blocking)
        if (data.auto_send && data.invoice_email) {
          try {
            this.attemptAutoSend(invoiceId, data);
          } catch (sendErr) {
            // Log but don't fail the generation
            console.warn(`Auto-send failed for invoice ${invoiceId}:`, sendErr.message);
          }
        }
      } catch (error) {
        results.errors.push(`Contract ${contract.id}: ${error.message}`);
      }
    }

    // Log the generation
    if (results.created > 0 || results.errors.length > 0) {
      const logId = generateUUID();
      query(`
        INSERT INTO auto_generation_log (id, type, generated_count, details, created_by)
        VALUES ($1, 'auto_invoices_monthly', $2, $3, $4)
      `, [logId, results.created, JSON.stringify(results), createdBy]);
    }

    return results;
  }

  /**
   * Attempt to auto-send invoice via Green Invoice API (best-effort)
   */
  attemptAutoSend(invoiceId, invoiceData) {
    try {
      const settings = query(`SELECT green_invoice_api_key FROM integration_settings WHERE id = 'main'`);
      if (settings.rows.length > 0 && settings.rows[0].green_invoice_api_key) {
        // Green Invoice integration exists - mark for sending
        // Actual sending would be handled by greenInvoice service
        console.log(`Auto-send queued for invoice ${invoiceId} to ${invoiceData.invoice_email}`);
      }
    } catch (err) {
      console.warn('Auto-send check failed:', err.message);
    }
  }

  // ── Event Invoice Generation ───────────────────────────────────────

  /**
   * Generate invoice for a completed event
   * Called when an event status changes to 'completed'
   * @param {string} eventId
   * @param {string|null} createdBy
   * @returns {object|null} created invoice or null if skipped
   */
  generateEventInvoice(eventId, createdBy = null) {
    // Get event details
    const eventResult = query(`
      SELECT e.*, c.company_name, c.id as cust_id,
             c.default_vat_rate, c.default_payment_days
      FROM events e
      LEFT JOIN customers c ON e.customer_id = c.id
      WHERE e.id = $1
    `, [eventId]);

    if (eventResult.rows.length === 0) return null;
    const event = eventResult.rows[0];

    // Skip if no customer or no price
    if (!event.customer_id || !event.price || event.price <= 0) return null;

    // Check if invoice already exists for this event
    const existing = query(`
      SELECT id FROM invoices WHERE event_id = $1 AND deleted_at IS NULL
    `, [eventId]);

    if (existing.rows.length > 0) return null; // already invoiced

    // Resolve VAT rate and payment days using customer defaults
    const vatRate = this.resolveVatRate({}, event);
    const paymentDays = this.resolvePaymentDays({}, event);

    // Create draft invoice
    const invoiceId = generateUUID();
    const issueDate = new Date().toISOString().split('T')[0];
    const dueDate = this.calculateDueDate(issueDate, paymentDays);
    const amount = event.price;
    const vatAmount = Math.round(amount * (vatRate / 100) * 100) / 100;
    const totalAmount = Math.round((amount + vatAmount) * 100) / 100;
    const description = `אבטחת אירוע: ${event.event_name} - ${event.event_date}`;

    query(`
      INSERT INTO invoices (id, customer_id, event_id, issue_date, due_date, amount, vat_amount, total_amount, description, status, auto_generated, source_type, source_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'draft', 1, 'event', $3)
    `, [invoiceId, event.customer_id, eventId, issueDate, dueDate, amount, vatAmount, totalAmount, description]);

    // Log
    const logId = generateUUID();
    query(`
      INSERT INTO auto_generation_log (id, type, source_id, generated_count, details, created_by)
      VALUES ($1, 'auto_invoice_event', $2, 1, $3, $4)
    `, [logId, eventId, JSON.stringify({
      event_name: event.event_name,
      customer: event.company_name,
      amount: totalAmount
    }), createdBy]);

    return { id: invoiceId, amount, totalAmount, description };
  }

  // ── Helpers ────────────────────────────────────────────────────────

  /**
   * Calculate due date from issue date
   */
  calculateDueDate(issueDate, days) {
    const date = new Date(issueDate);
    date.setDate(date.getDate() + days);
    return date.toISOString().split('T')[0];
  }
}

module.exports = new AutoInvoiceGenerator();
