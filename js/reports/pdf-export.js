import { jsPDF } from 'https://cdn.jsdelivr.net/npm/jspdf@2.5.2/+esm';
import { formatCurrency, formatDate, formatDateTime } from '../utils/formatters.js';

export function exportToPDF({ title, columns, data, filename, gymName = 'Blossom Fitness Club' }) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();

  doc.setFontSize(18);
  doc.setTextColor(201, 162, 39);
  doc.text(gymName, pageWidth / 2, 20, { align: 'center' });

  doc.setFontSize(14);
  doc.setTextColor(0, 0, 0);
  doc.text(title, pageWidth / 2, 30, { align: 'center' });

  doc.setFontSize(9);
  doc.setTextColor(100, 100, 100);
  doc.text(`Generado: ${formatDateTime(new Date())}`, pageWidth / 2, 38, { align: 'center' });

  let y = 50;
  const colWidth = (pageWidth - 28) / columns.length;

  doc.setFillColor(201, 162, 39);
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8);

  columns.forEach((col, i) => {
    doc.rect(14 + i * colWidth, y, colWidth, 8, 'F');
    doc.text(col.label, 16 + i * colWidth, y + 5.5);
  });

  y += 10;
  doc.setTextColor(0, 0, 0);

  data.forEach((row, idx) => {
    if (y > 270) {
      doc.addPage();
      y = 20;
    }

    if (idx % 2 === 0) {
      doc.setFillColor(245, 245, 245);
      doc.rect(14, y - 1, pageWidth - 28, 7, 'F');
    }

    columns.forEach((col, i) => {
      let value = row[col.key];
      if (col.format === 'currency') value = formatCurrency(value);
      else if (col.format === 'date') value = formatDate(value);
      else if (value === null || value === undefined) value = '—';

      const text = String(value).substring(0, 25);
      doc.text(text, 16 + i * colWidth, y + 4);
    });
    y += 7;
  });

  doc.save(`${filename}.pdf`);
}
