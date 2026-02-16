import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface TableColumn {
  header: string;
  dataKey: string;
}

interface ExportOptions {
  title: string;
  subtitle?: string;
  columns: TableColumn[];
  data: Record<string, unknown>[];
  filename?: string;
  orientation?: 'portrait' | 'landscape';
}

export function exportTableToPDF({
  title,
  subtitle,
  columns,
  data,
  filename = 'report.pdf',
  orientation = 'portrait',
}: ExportOptions) {
  const doc = new jsPDF({ orientation, unit: 'mm', format: 'a4' });

  // Title
  doc.setFontSize(18);
  doc.text(title, doc.internal.pageSize.getWidth() / 2, 20, { align: 'center' });

  // Subtitle
  if (subtitle) {
    doc.setFontSize(12);
    doc.setTextColor(100);
    doc.text(subtitle, doc.internal.pageSize.getWidth() / 2, 28, { align: 'center' });
    doc.setTextColor(0);
  }

  // Footer with company name
  const startY = subtitle ? 35 : 28;

  // Table
  autoTable(doc, {
    startY,
    head: [columns.map((c) => c.header)],
    body: data.map((row) => columns.map((c) => String(row[c.dataKey] ?? ''))),
    styles: {
      fontSize: 9,
      cellPadding: 3,
      halign: 'right',
    },
    headStyles: {
      fillColor: [14, 165, 233], // primary-500
      textColor: 255,
      halign: 'right',
      fontStyle: 'bold',
    },
    alternateRowStyles: {
      fillColor: [245, 247, 250],
    },
    didDrawPage: (data: { pageNumber: number }) => {
      // Page footer
      const pageHeight = doc.internal.pageSize.getHeight();
      doc.setFontSize(8);
      doc.setTextColor(150);
      doc.text(
        `Yahalom CRM - Page ${data.pageNumber}`,
        doc.internal.pageSize.getWidth() / 2,
        pageHeight - 10,
        { align: 'center' }
      );
    },
  });

  doc.save(filename);
}

export function exportInvoiceToPDF(invoice: {
  invoice_number: string;
  company_name: string;
  issue_date: string;
  due_date: string;
  total_amount: number;
  status: string;
  description?: string;
}) {
  const doc = new jsPDF('portrait', 'mm', 'a4');
  const width = doc.internal.pageSize.getWidth();

  // Header
  doc.setFillColor(14, 165, 233);
  doc.rect(0, 0, width, 40, 'F');
  doc.setTextColor(255);
  doc.setFontSize(24);
  doc.text('Yahalom CRM', width / 2, 20, { align: 'center' });
  doc.setFontSize(14);
  doc.text('Invoice', width / 2, 32, { align: 'center' });

  // Invoice details
  doc.setTextColor(0);
  doc.setFontSize(12);
  const y = 55;
  doc.text(`Invoice #${invoice.invoice_number || 'N/A'}`, 20, y);
  doc.text(`Customer: ${invoice.company_name}`, 20, y + 10);
  doc.text(`Issue Date: ${invoice.issue_date}`, 20, y + 20);
  doc.text(`Due Date: ${invoice.due_date}`, 20, y + 30);
  doc.text(`Status: ${invoice.status}`, 20, y + 40);

  // Amount box
  doc.setFillColor(245, 247, 250);
  doc.rect(15, y + 50, width - 30, 25, 'F');
  doc.setFontSize(18);
  doc.text(`Total: ${invoice.total_amount?.toLocaleString()} ILS`, width / 2, y + 66, { align: 'center' });

  // Description
  if (invoice.description) {
    doc.setFontSize(10);
    doc.text(`Description: ${invoice.description}`, 20, y + 85);
  }

  doc.save(`invoice-${invoice.invoice_number || 'draft'}.pdf`);
}
