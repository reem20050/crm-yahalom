/**
 * Auto Invoice Generator Service
 * Generates draft invoices automatically:
 * 1. When events are completed
 * 2. Monthly for active contracts with auto_invoice enabled
 */
const { query, generateUUID } = require('../config/database');

class AutoInvoiceGenerator {
  /**
   * Generate monthly invoices for all contracts with auto_invoice enabled
   * Called by cron on the 1st of each month
   * @param {string|null} createdBy - user ID or null for cron
   * @returns {{ created: number, skipped: number, errors: string[] }}
   */
  generateMonthlyInvoices(createdBy = null) {
    const results = { created: 0, skipped: 0, errors: [] };

    // Get active contracts with auto_invoice enabled
    const contracts = query(`
      SELECT ct.*, c.company_name, c.id as cust_id, c.business_id, c.address as customer_address
      FROM contracts ct
      JOIN customers c ON ct.customer_id = c.id
      WHERE ct.status = 'active'
      AND ct.auto_invoice = 1
      AND c.status = 'active'
      AND c.deleted_at IS NULL
    `);

    const now = new Date();
    const currentMonth = now.toISOString().slice(0, 7); // YYYY-MM

    for (const contract of contracts.rows) {
      try {
        // Check if already invoiced this month
        if (contract.last_invoiced_date && contract.last_invoiced_date.startsWith(currentMonth)) {
          results.skipped++;
          continue;
        }

        // Check that monthly_value is set
        if (!contract.monthly_value || contract.monthly_value <= 0) {
          results.errors.push(`Contract ${contract.id} for ${contract.company_name}: no monthly value`);
          continue;
        }

        // Create draft invoice
        const invoiceId = generateUUID();
        const issueDate = now.toISOString().split('T')[0];
        const dueDate = this.calculateDueDate(issueDate, 30);
        const amount = contract.monthly_value;
        const vatAmount = Math.round(amount * 0.17 * 100) / 100;
        const totalAmount = Math.round((amount + vatAmount) * 100) / 100;

        const monthNames = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];
        const description = `שירותי אבטחה - ${monthNames[now.getMonth()]} ${now.getFullYear()} - ${contract.company_name}`;

        query(`
          INSERT INTO invoices (id, customer_id, issue_date, due_date, amount, vat_amount, total_amount, description, status, auto_generated, source_type, source_id)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'draft', 1, 'contract', $9)
        `, [invoiceId, contract.customer_id, issueDate, dueDate, amount, vatAmount, totalAmount, description, contract.id]);

        // Update last_invoiced_date on contract
        query(`UPDATE contracts SET last_invoiced_date = $1 WHERE id = $2`, [issueDate, contract.id]);

        results.created++;
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
   * Generate invoice for a completed event
   * Called when an event status changes to 'completed'
   * @param {string} eventId
   * @param {string|null} createdBy
   * @returns {object|null} created invoice or null if skipped
   */
  generateEventInvoice(eventId, createdBy = null) {
    // Get event details
    const eventResult = query(`
      SELECT e.*, c.company_name, c.id as cust_id
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

    // Create draft invoice
    const invoiceId = generateUUID();
    const issueDate = new Date().toISOString().split('T')[0];
    const dueDate = this.calculateDueDate(issueDate, 30);
    const amount = event.price;
    const vatAmount = Math.round(amount * 0.17 * 100) / 100;
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
