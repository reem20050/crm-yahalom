/**
 * Google Calendar/Drive Helper - Safe wrapper for Google integrations
 * Failures are logged but never break the main flow
 */
const googleService = require('../services/google');
const { query } = require('../config/database');

class GoogleHelper {
  /**
   * Check if Google is connected and load tokens
   */
  isConfigured() {
    try {
      const settings = query(`SELECT google_tokens FROM integration_settings WHERE id = 'main'`);
      if (settings.rows.length === 0 || !settings.rows[0].google_tokens) return false;

      const tokens = JSON.parse(settings.rows[0].google_tokens);
      googleService.setCredentials(tokens);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Create a Google Calendar event from a CRM event
   */
  async createCalendarEvent(event) {
    try {
      if (!this.isConfigured()) return null;

      const calEvent = await googleService.createCalendarEvent({
        title: `[צוות יהלום] ${event.event_name}`,
        location: event.location || event.address || '',
        description: `אירוע אבטחה - ${event.event_type || ''}
מספר מאבטחים: ${event.required_guards || '-'}
${event.notes || ''}

CRM Event ID: ${event.id}`,
        date: event.event_date,
        startTime: event.start_time,
        endTime: event.end_time
      });

      console.log(`Google Calendar event created: ${calEvent.id}`);
      return calEvent.id;
    } catch (error) {
      console.error('Google Calendar create error:', error.message);
      return null;
    }
  }

  /**
   * Update a Google Calendar event
   */
  async updateCalendarEvent(googleEventId, event) {
    try {
      if (!this.isConfigured() || !googleEventId) return null;

      await googleService.updateCalendarEvent(googleEventId, {
        title: `[צוות יהלום] ${event.event_name}`,
        location: event.location || event.address || '',
        description: `אירוע אבטחה - ${event.event_type || ''}
מספר מאבטחים: ${event.required_guards || '-'}
${event.notes || ''}`,
        date: event.event_date,
        startTime: event.start_time,
        endTime: event.end_time
      });

      console.log(`Google Calendar event updated: ${googleEventId}`);
      return true;
    } catch (error) {
      console.error('Google Calendar update error:', error.message);
      return null;
    }
  }

  /**
   * Delete a Google Calendar event
   */
  async deleteCalendarEvent(googleEventId) {
    try {
      if (!this.isConfigured() || !googleEventId) return;
      await googleService.deleteCalendarEvent(googleEventId);
      console.log(`Google Calendar event deleted: ${googleEventId}`);
    } catch (error) {
      console.error('Google Calendar delete error:', error.message);
    }
  }

  /**
   * Create a calendar entry for a shift
   */
  async createShiftCalendarEvent(shift) {
    try {
      if (!this.isConfigured()) return null;

      const calEvent = await googleService.createCalendarEvent({
        title: `[משמרת] ${shift.site_name || shift.company_name || 'משמרת'}`,
        location: shift.site_address || '',
        description: `משמרת אבטחה
לקוח: ${shift.company_name || '-'}
אתר: ${shift.site_name || '-'}`,
        date: shift.date,
        startTime: shift.start_time,
        endTime: shift.end_time
      });

      return calEvent?.id || null;
    } catch (error) {
      console.error('Google Calendar shift create error:', error.message);
      return null;
    }
  }

  /**
   * Upload a file to Google Drive
   */
  async uploadFile(fileBuffer, fileName, mimeType) {
    try {
      if (!this.isConfigured()) return null;

      const result = await googleService.uploadFile(fileBuffer, fileName, mimeType);
      console.log(`File uploaded to Google Drive: ${result.name}`);
      return result;
    } catch (error) {
      console.error('Google Drive upload error:', error.message);
      return null;
    }
  }

  /**
   * Send email via Gmail
   * Throws errors so callers (like invoice send-email) can report failures to the user
   */
  async sendEmail(to, subject, body) {
    if (!this.isConfigured()) {
      throw new Error('Gmail לא מחובר. יש לחבר Google בדף ההגדרות ולוודא שניתנו הרשאות Gmail.');
    }

    const result = await googleService.sendEmail(to, subject, body);
    console.log(`Email sent via Gmail to: ${to}`);
    return result;
  }

  /**
   * Send invoice email via Gmail
   */
  async sendInvoiceEmail(to, customerName, invoiceNumber, invoicePdfUrl) {
    try {
      if (!this.isConfigured()) return null;
      return await googleService.sendInvoiceEmail(to, customerName, invoiceNumber, invoicePdfUrl);
    } catch (error) {
      console.error('Gmail invoice email error:', error.message);
      return null;
    }
  }
}

module.exports = new GoogleHelper();
