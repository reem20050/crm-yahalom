const { google } = require('googleapis');
require('dotenv').config();

class GoogleService {
  constructor() {
    this.clientId = process.env.GOOGLE_CLIENT_ID;
    this.clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    this.redirectUri = process.env.GOOGLE_REDIRECT_URI;

    this.oauth2Client = new google.auth.OAuth2(
      this.clientId,
      this.clientSecret,
      this.redirectUri
    );
  }

  // Generate auth URL with all needed scopes
  getAuthUrl() {
    const scopes = [
      'openid',
      'email',
      'profile',
      'https://www.googleapis.com/auth/gmail.send',
      'https://www.googleapis.com/auth/calendar',
      'https://www.googleapis.com/auth/calendar.events',
    ];

    return this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      prompt: 'consent',
    });
  }

  // Exchange code for tokens
  async getTokensFromCode(code) {
    const { tokens } = await this.oauth2Client.getToken(code);
    this.oauth2Client.setCredentials(tokens);
    return tokens;
  }

  // Set credentials
  setCredentials(tokens) {
    this.oauth2Client.setCredentials(tokens);
  }

  // =====================
  // CALENDAR
  // =====================

  async createCalendarEvent(eventData) {
    const calendar = google.calendar({ version: 'v3', auth: this.oauth2Client });

    const event = {
      summary: eventData.title,
      location: eventData.location,
      description: eventData.description,
      start: {
        dateTime: `${eventData.date}T${eventData.startTime}:00`,
        timeZone: 'Asia/Jerusalem',
      },
      end: {
        dateTime: `${eventData.date}T${eventData.endTime}:00`,
        timeZone: 'Asia/Jerusalem',
      },
      reminders: {
        useDefault: false,
        overrides: [
          { method: 'popup', minutes: 60 },
          { method: 'popup', minutes: 1440 }, // 1 day before
        ],
      },
    };

    const response = await calendar.events.insert({
      calendarId: 'primary',
      resource: event,
    });

    return response.data;
  }

  async updateCalendarEvent(eventId, eventData) {
    const calendar = google.calendar({ version: 'v3', auth: this.oauth2Client });

    const event = {
      summary: eventData.title,
      location: eventData.location,
      description: eventData.description,
      start: {
        dateTime: `${eventData.date}T${eventData.startTime}:00`,
        timeZone: 'Asia/Jerusalem',
      },
      end: {
        dateTime: `${eventData.date}T${eventData.endTime}:00`,
        timeZone: 'Asia/Jerusalem',
      },
    };

    const response = await calendar.events.update({
      calendarId: 'primary',
      eventId,
      resource: event,
    });

    return response.data;
  }

  async deleteCalendarEvent(eventId) {
    const calendar = google.calendar({ version: 'v3', auth: this.oauth2Client });

    await calendar.events.delete({
      calendarId: 'primary',
      eventId,
    });

    return true;
  }

  // =====================
  // DRIVE
  // =====================

  async uploadFile(fileBuffer, fileName, mimeType, folderId = null) {
    const drive = google.drive({ version: 'v3', auth: this.oauth2Client });

    const fileMetadata = {
      name: fileName,
      parents: folderId ? [folderId] : [],
    };

    const media = {
      mimeType,
      body: require('stream').Readable.from(fileBuffer),
    };

    const response = await drive.files.create({
      resource: fileMetadata,
      media,
      fields: 'id, name, webViewLink',
    });

    // Make file viewable by link
    await drive.permissions.create({
      fileId: response.data.id,
      resource: {
        role: 'reader',
        type: 'anyone',
      },
    });

    return {
      id: response.data.id,
      name: response.data.name,
      url: response.data.webViewLink,
    };
  }

  async createFolder(folderName, parentFolderId = null) {
    const drive = google.drive({ version: 'v3', auth: this.oauth2Client });

    const fileMetadata = {
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder',
      parents: parentFolderId ? [parentFolderId] : [],
    };

    const response = await drive.files.create({
      resource: fileMetadata,
      fields: 'id, name',
    });

    return response.data;
  }

  async getFileUrl(fileId) {
    const drive = google.drive({ version: 'v3', auth: this.oauth2Client });

    const response = await drive.files.get({
      fileId,
      fields: 'webViewLink',
    });

    return response.data.webViewLink;
  }

  // =====================
  // GMAIL
  // =====================

  async sendEmail(to, subject, body, attachments = []) {
    const gmail = google.gmail({ version: 'v1', auth: this.oauth2Client });

    // Build email
    let email = [
      'Content-Type: text/html; charset=utf-8',
      'MIME-Version: 1.0',
      `To: ${to}`,
      `Subject: =?UTF-8?B?${Buffer.from(subject).toString('base64')}?=`,
      '',
      body,
    ].join('\r\n');

    const encodedEmail = Buffer.from(email).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

    const response = await gmail.users.messages.send({
      userId: 'me',
      resource: {
        raw: encodedEmail,
      },
    });

    return response.data;
  }

  // Send quote email with PDF
  async sendQuoteEmail(to, customerName, quotePdfUrl) {
    const subject = 'הצעת מחיר - צוות יהלום';
    const body = `
      <div dir="rtl" style="font-family: Arial, sans-serif;">
        <h2>שלום ${customerName},</h2>
        <p>מצורפת הצעת המחיר שביקשתם.</p>
        <p><a href="${quotePdfUrl}" style="background-color: #0ea5e9; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">צפייה בהצעת מחיר</a></p>
        <p>לכל שאלה, אנו כאן לשירותכם.</p>
        <br>
        <p>בברכה,<br>צוות יהלום</p>
      </div>
    `;

    return await this.sendEmail(to, subject, body);
  }

  // Send invoice email
  async sendInvoiceEmail(to, customerName, invoiceNumber, invoicePdfUrl) {
    const subject = `חשבונית #${invoiceNumber} - צוות יהלום`;
    const body = `
      <div dir="rtl" style="font-family: Arial, sans-serif;">
        <h2>שלום ${customerName},</h2>
        <p>מצורפת חשבונית מספר ${invoiceNumber}.</p>
        <p><a href="${invoicePdfUrl}" style="background-color: #0ea5e9; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">צפייה בחשבונית</a></p>
        <p>תודה על שיתוף הפעולה.</p>
        <br>
        <p>בברכה,<br>צוות יהלום</p>
      </div>
    `;

    return await this.sendEmail(to, subject, body);
  }
}

module.exports = new GoogleService();
