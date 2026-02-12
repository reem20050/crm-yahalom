const axios = require('axios');
require('dotenv').config();

class GreenInvoiceService {
  constructor() {
    this.apiUrl = process.env.GREEN_INVOICE_API_URL;
    this.apiKey = process.env.GREEN_INVOICE_API_KEY;
    this.apiSecret = process.env.GREEN_INVOICE_API_SECRET;
    this.token = null;
    this.tokenExpiry = null;
  }

  async getToken() {
    // Check if token is still valid
    if (this.token && this.tokenExpiry && new Date() < this.tokenExpiry) {
      return this.token;
    }

    try {
      const response = await axios.post(`${this.apiUrl}/account/token`, {
        id: this.apiKey,
        secret: this.apiSecret,
      });

      this.token = response.data.token;
      // Token expires in 30 minutes, refresh 5 minutes before
      this.tokenExpiry = new Date(Date.now() + 25 * 60 * 1000);

      return this.token;
    } catch (error) {
      console.error('Green Invoice auth error:', error.response?.data || error.message);
      throw new Error('שגיאה בהתחברות לחשבונית ירוקה');
    }
  }

  async request(method, endpoint, data = null) {
    const token = await this.getToken();

    try {
      const response = await axios({
        method,
        url: `${this.apiUrl}${endpoint}`,
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        data,
      });

      return response.data;
    } catch (error) {
      console.error('Green Invoice API error:', error.response?.data || error.message);
      throw error;
    }
  }

  // Create a new invoice/quote
  // Payment types: 1=cash, 2=check, 3=credit card, 4=bank transfer, 10=other
  async createDocument(params) {
    const {
      type, // 320 = invoice, 400 = receipt, 305 = quote
      customer,
      items,
      dueDate,
      remarks,
      paymentType = 4, // default: bank transfer
      vatType = 0, // 0 = include VAT, 1 = exclude VAT
    } = params;

    const payload = {
      type,
      lang: 'he',
      currency: 'ILS',
      vatType,
      client: {
        name: customer.name,
        emails: customer.email ? [customer.email] : [],
        taxId: customer.businessId || '',
        address: customer.address || '',
        city: customer.city || '',
        phone: customer.phone || '',
      },
      income: items.map((item) => ({
        description: item.description,
        quantity: item.quantity || 1,
        price: item.price,
        currency: 'ILS',
        vatType,
      })),
      payment: dueDate ? [{ dueDate, type: paymentType }] : [],
      remarks,
    };

    return await this.request('POST', '/documents', payload);
  }

  // Create an invoice (paymentType: 1=cash, 2=check, 3=credit card, 4=bank transfer)
  async createInvoice(customer, items, dueDate, remarks, paymentType = 4) {
    return await this.createDocument({
      type: 320, // Invoice
      customer,
      items,
      dueDate,
      remarks,
      paymentType,
    });
  }

  // Create a quote
  async createQuote(customer, items, remarks) {
    return await this.createDocument({
      type: 305, // Quote
      customer,
      items,
      remarks,
    });
  }

  // Get document by ID
  async getDocument(documentId) {
    return await this.request('GET', `/documents/${documentId}`);
  }

  // Get all documents
  async getDocuments(params = {}) {
    const queryParams = new URLSearchParams({
      page: params.page || 1,
      pageSize: params.pageSize || 25,
      ...params,
    });

    return await this.request('GET', `/documents?${queryParams}`);
  }

  // Get document PDF URL
  async getDocumentPdfUrl(documentId) {
    const doc = await this.getDocument(documentId);
    return doc.url?.he || doc.url?.origin;
  }

  // Mark document as paid
  async markAsPaid(documentId, paymentDate = new Date().toISOString().split('T')[0]) {
    return await this.request('POST', `/documents/${documentId}/payment`, {
      type: 1, // 1 = cash, 2 = check, 3 = credit card, 4 = bank transfer
      date: paymentDate,
    });
  }

  // Get business details
  async getBusinessDetails() {
    return await this.request('GET', '/account/details');
  }

  // Sync invoices from Green Invoice to our database
  async syncInvoices(dbModule, fromDate) {
    const documents = await this.getDocuments({
      fromDate,
      type: 320, // Invoices only
    });

    const queryFn = dbModule.query || dbModule;
    let synced = 0;

    for (const doc of documents.items || []) {
      try {
        const status = doc.status === 0 ? 'draft' : doc.status === 1 ? 'sent' : doc.status === 2 ? 'paid' : 'sent';
        const docUrl = doc.url?.he || '';

        // Check if exists
        const existing = queryFn(`SELECT id FROM invoices WHERE green_invoice_id = ?`, [doc.id]);

        if (existing.rows && existing.rows.length > 0) {
          // Update status
          queryFn(`UPDATE invoices SET status = ?, document_url = ?, updated_at = datetime('now') WHERE green_invoice_id = ?`,
            [status, docUrl, doc.id]);
        } else {
          // Insert new
          const id = require('crypto').randomUUID();
          queryFn(`INSERT INTO invoices (id, green_invoice_id, invoice_number, issue_date, due_date, total_amount, amount, vat_amount, status, document_url, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
            [id, doc.id, doc.number, doc.documentDate, doc.dueDate, doc.total, doc.amount || doc.total, doc.vat || 0, status, docUrl]);
        }
        synced++;
      } catch (err) {
        console.warn('Sync single invoice failed:', doc.id, err.message);
      }
    }

    return synced;
  }
}

module.exports = new GreenInvoiceService();
