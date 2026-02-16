import * as XLSX from 'xlsx';

interface ExcelColumn {
  header: string;
  dataKey: string;
  width?: number;
}

interface ExcelExportOptions {
  title: string;
  columns: ExcelColumn[];
  data: Record<string, unknown>[];
  filename?: string;
  sheetName?: string;
}

export function exportToExcel({
  title,
  columns,
  data,
  filename = 'report.xlsx',
  sheetName = 'דוח',
}: ExcelExportOptions) {
  if (!data || data.length === 0) return;

  // Build header row
  const headers = columns.map((c) => c.header);

  // Build data rows
  const rows = data.map((row) =>
    columns.map((c) => {
      const val = row[c.dataKey];
      if (val === null || val === undefined) return '';
      return val;
    })
  );

  // Create worksheet with title row + gap + headers + data
  const wsData = [[title], [], headers, ...rows];
  const ws = XLSX.utils.aoa_to_sheet(wsData);

  // Set column widths
  ws['!cols'] = columns.map((c) => ({
    wch: c.width || Math.max(c.header.length + 2, 12),
  }));

  // Merge title row across all columns
  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: columns.length - 1 } },
  ];

  // Set RTL for the sheet
  ws['!sheetProps'] = { rightToLeft: true } as never;

  // Create workbook
  const wb = XLSX.utils.book_new();

  // Set RTL view
  if (!wb.Workbook) wb.Workbook = {};
  if (!wb.Workbook.Views) wb.Workbook.Views = [];
  wb.Workbook.Views[0] = { RTL: true };

  XLSX.utils.book_append_sheet(wb, ws, sheetName);

  // Trigger download
  XLSX.writeFile(wb, filename);
}

// Quick helper: export any array of objects with auto-detected columns
export function quickExportExcel(
  data: Record<string, unknown>[],
  filename = 'export.xlsx',
  title = 'ייצוא נתונים'
) {
  if (!data || data.length === 0) return;

  const keys = Object.keys(data[0]);
  const columns: ExcelColumn[] = keys.map((key) => ({
    header: key,
    dataKey: key,
  }));

  exportToExcel({ title, columns, data, filename });
}
