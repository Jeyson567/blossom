import { formatCurrency, formatDate, formatDateTime } from '../utils/formatters.js';
import { downloadBlob } from '../utils/helpers.js';

export function exportToExcel({ columns, data, filename, sheetName = 'Datos' }) {
  const headers = columns.map(c => c.label);
  const rows = data.map(row =>
    columns.map(col => {
      let value = row[col.key];
      if (col.format === 'currency') value = Number(value) || 0;
      else if (col.format === 'date') value = formatDate(value);
      else if (col.format === 'datetime') value = formatDateTime(value);
      else if (value === null || value === undefined) value = '';
      return value;
    })
  );

  const wsData = [headers, ...rows];
  const ws = XLSX.utils.aoa_to_sheet(wsData);

  const colWidths = columns.map((col, i) => {
    const maxLen = Math.max(
      col.label.length,
      ...rows.map(r => String(r[i] || '').length)
    );
    return { wch: Math.min(maxLen + 2, 40) };
  });
  ws['!cols'] = colWidths;

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);

  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  downloadBlob(blob, `${filename}.xlsx`);
}
