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
  async createDocument(params) {
    const {
      type, // 320 = invoice, 400 = receipt, 305 = quote
      customer,
      items,
      dueDate,
      remarks,
    } = params;

    const payload = {
      type,
      lang: 'he',
      currency: 'ILS',
      vatType: 0, // 0 = include VAT, 1 = exclude VAT
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
        vatType: 0,
      })),
      payment: dueDate ? [{ dueDate, type: 4 }] : [], // 4 = bank transfer
      remarks,
    };

    return await this.request('POST', '/documents', payload);
  }

  // Create an invoice
  async createInvoice(customer, items, dueDate, remarks) {
    return await this.createDocument({
      type: 320, // Invoice
      customer,
      items,
      dueDate,
      remarks,
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
  async syncInvoices(db, fromDate) {
    const documents = await this.getDocuments({
      fromDate,
      type: 320, // Invoices only
    });

    for (const doc of documents.items || []) {
      // Update or create invoice in our database
      await db.query(`
        INSERT INTO invoices (green_invoice_id, invoice_number, issue_date, due_date, total_amount, status, document_url)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (green_invoice_id)
        DO UPDATE SET status = $6, updated_at = CURRENT_TIMESTAMP
      `, [
        doc.id,
        doc.number,
        doc.documentDate,
        doc.dueDate,
        doc.total,
        doc.status === 0 ? 'draft' : doc.status === 1 ? 'sent' : doc.status === 2 ? 'paid' : 'sent',
        doc.url?.he,
      ]);
    }

    return documents.items?.length || 0;
  }
}

module.exports = new GreenInvoiceService();
