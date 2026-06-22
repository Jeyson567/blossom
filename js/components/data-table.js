import { formatCurrency, formatDate, formatDateTime } from '../utils/formatters.js';
import { getTotalPages } from '../utils/helpers.js';
import { renderEmptyState } from './empty-state.js';

export function renderDataTable({ columns, data, actions, emptyMessage = 'No hay registros', emptyState }) {
  if (!data.length) {
    if (emptyState) return renderEmptyState(emptyState);
    return `<div class="empty-state"><p>${emptyMessage}</p></div>`;
  }

  const headers = columns.map(c => `<th>${c.label}</th>`).join('');
  const actionsHeader = actions ? '<th>Acciones</th>' : '';

  const rows = data.map(row => {
    const cells = columns.map(col => {
      let value = row[col.key];
      if (col.format === 'currency') value = formatCurrency(value);
      else if (col.format === 'date') value = formatDate(value);
      else if (col.format === 'datetime') value = formatDateTime(value);
      else if (col.render) value = col.render(value, row);
      else if (value === null || value === undefined) value = '—';
      return `<td>${value}</td>`;
    }).join('');

    const actionsCell = actions
      ? `<td class="whitespace-nowrap">${actions(row)}</td>`
      : '';

    return `<tr>${cells}${actionsCell}</tr>`;
  }).join('');

  return `
    <div class="table-container">
      <table class="data-table">
        <thead><tr>${headers}${actionsHeader}</tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

export function renderPagination({ page, perPage, total, onPageChange }) {
  const totalPages = getTotalPages(total, perPage);
  if (totalPages <= 1) return null;

  const start = (page - 1) * perPage + 1;
  const end = Math.min(page * perPage, total);

  const container = document.createElement('div');
  container.className = 'pagination';
  container.innerHTML = `
    <span class="pagination-info">Mostrando ${start}-${end} de ${total}</span>
    <div class="pagination-controls">
      <button class="btn btn-secondary btn-sm" data-page="prev" ${page <= 1 ? 'disabled' : ''}>Anterior</button>
      <span class="pagination-info">Página ${page} de ${totalPages}</span>
      <button class="btn btn-secondary btn-sm" data-page="next" ${page >= totalPages ? 'disabled' : ''}>Siguiente</button>
    </div>
  `;

  container.querySelector('[data-page="prev"]')?.addEventListener('click', () => onPageChange(page - 1));
  container.querySelector('[data-page="next"]')?.addEventListener('click', () => onPageChange(page + 1));

  return container;
}

/** Añade paginación solo si renderPagination devolvió un nodo válido. */
export function appendPagination(containerId, paginationEl) {
  if (paginationEl && paginationEl.nodeType === 1) {
    document.getElementById(containerId)?.appendChild(paginationEl);
  }
}

export function renderStatusBadge(status) {
  const map = {
    activo: 'badge-success',
    activa: 'badge-success',
    proximo_vencer: 'badge-warning',
    vencido: 'badge-danger',
    vencida: 'badge-danger',
    sin_membresia: 'badge-neutral',
    permitido: 'badge-success',
    pendiente: 'badge-warning',
    enviado: 'badge-success',
    abierta: 'badge-success',
    cerrada: 'badge-neutral'
  };
  const labels = {
    activo: 'Activo', activa: 'Activa', proximo_vencer: 'Próximo a vencer',
    vencido: 'Vencido', vencida: 'Vencida', sin_membresia: 'Sin membresía',
    permitido: 'Permitido', pendiente: 'Pendiente', enviado: 'Enviado',
    abierta: 'Abierta', cerrada: 'Cerrada'
  };
  return `<span class="badge ${map[status] || 'badge-neutral'}">${labels[status] || status}</span>`;
}
