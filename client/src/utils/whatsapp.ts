/**
 * WhatsApp Web Link Utility
 * Opens WhatsApp Web/App with a pre-filled message - no API needed!
 */

/**
 * Format Israeli phone number for WhatsApp
 * Removes non-digits, converts leading 0 to 972
 */
export function formatPhoneForWhatsApp(phone: string): string {
  if (!phone) return '';
  let formatted = phone.replace(/[^0-9]/g, '');
  if (formatted.startsWith('0')) {
    formatted = '972' + formatted.slice(1);
  }
  // If number doesn't start with country code, assume Israel
  if (formatted.length === 9) {
    formatted = '972' + formatted;
  }
  return formatted;
}

/**
 * Generate WhatsApp Web URL with pre-filled message
 */
export function getWhatsAppUrl(phone: string, message?: string): string {
  const formattedPhone = formatPhoneForWhatsApp(phone);
  if (!formattedPhone) return '';

  let url = `https://wa.me/${formattedPhone}`;
  if (message) {
    url += `?text=${encodeURIComponent(message)}`;
  }
  return url;
}

/**
 * Open WhatsApp with a pre-filled message in a new tab
 */
export function openWhatsApp(phone: string, message?: string): void {
  const url = getWhatsAppUrl(phone, message);
  if (url) {
    window.open(url, '_blank');
  }
}

/**
 * Pre-built message templates
 */
export const whatsappTemplates = {
  shiftReminder: (employeeName: string, siteName: string, date: string, startTime: string, endTime: string) =>
    `שלום ${employeeName}! 🔔\nתזכורת למשמרת:\n📍 ${siteName}\n🕐 ${startTime} - ${endTime}\n📅 ${date}\n\nצוות יהלום`,

  assignmentConfirmation: (employeeName: string, siteName: string, date: string, startTime: string, endTime: string) =>
    `שלום ${employeeName}! ✅\nשובצת למשמרת:\n📍 ${siteName}\n🕐 ${startTime} - ${endTime}\n📅 ${date}\n\nנא לאשר קבלה.\nצוות יהלום`,

  bookingConfirmation: (contactName: string, eventDate: string, startTime: string, location: string, guards: number) =>
    `שלום ${contactName}! ✅\nהזמנתכם לאבטחת האירוע אושרה:\n📅 ${eventDate}\n🕐 ${startTime}\n📍 ${location}\n👥 ${guards} מאבטחים\n\nצוות יהלום`,

  invoiceReminder: (contactName: string, invoiceNumber: string, amount: string, dueDate: string) =>
    `שלום ${contactName},\nתזכורת לתשלום חשבונית #${invoiceNumber}\nסכום: ₪${amount}\nתאריך תשלום: ${dueDate}\n\nלפרטים נוספים ניתן לפנות אלינו.\nצוות יהלום`,

  general: (name: string) =>
    `שלום ${name},\n\nצוות יהלום`,
};
