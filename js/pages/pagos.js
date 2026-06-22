import { getPagos, createPago, deletePago } from '../services/pagos.service.js';
import { getAllClientes } from '../services/clientes.service.js';
import { renderDataTable, renderPagination, appendPagination } from '../components/data-table.js';
import { renderEmptyState, bindEmptyAction } from '../components/empty-state.js';
import { renderClienteSearchBox, bindClienteSearch } from '../components/cliente-search.js';
import { createModal } from '../components/modal.js';
import { validatePagoForm, hasErrors } from '../utils/validators.js';
import { getCurrentUserData, getUserRole } from '../auth.js';
import { canDelete } from '../utils/permissions.js';
import { PAYMENT_TYPE_LABELS, PAYMENT_METHOD_LABELS, ITEMS_PER_PAGE } from '../utils/constants.js';
import { showRealError, logFirestoreError } from '../utils/debug-error.js';

let currentPage = 1;
let filters = { tipo: 'todos', metodoPago: 'todos' };

export async function render(container) {
  console.log('[BFC Pagos] Entrando a Pagos');
  try {
    await loadPagos(container);
    console.log('[BFC Pagos] Pagos cargados');
  } catch (error) {
    showRealError(container, error, 'js/pages/pagos.js', 'render / loadPagos');
  }
}

async function loadPagos(container) {
  let data = [], total = 0, page = 1, perPage = ITEMS_PER_PAGE;

  console.log('[BFC Pagos] Consultando colección pagos');
  try {
    const result = await getPagos({ page: currentPage, perPage: ITEMS_PER_PAGE, ...filters });
    ({ data, total, page, perPage } = result);
    console.log('[BFC Pagos] Documentos obtenidos:', total);
  } catch (error) {
    logFirestoreError('Pagos', error);
    throw error;
  }

  const isEmpty = total === 0 && filters.tipo === 'todos' && filters.metodoPago === 'todos';
  const tipoOptions = Object.entries(PAYMENT_TYPE_LABELS).map(([k, v]) =>
    `<option value="${k}" ${filters.tipo === k ? 'selected' : ''}>${v}</option>`
  ).join('');
  const metodoOptions = Object.entries(PAYMENT_METHOD_LABELS).map(([k, v]) =>
    `<option value="${k}" ${filters.metodoPago === k ? 'selected' : ''}>${v}</option>`
  ).join('');

  container.innerHTML = `
    <div class="animate-fade-in">
      <div class="page-header">
        <div>
          <h2 class="page-title">Pagos</h2>
          <p class="page-subtitle">Registro de ingresos</p>
        </div>
        <button class="btn btn-primary" id="btn-nuevo-pago">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
          Registrar Pago
        </button>
      </div>

      ${!isEmpty ? `
      <div class="filters-bar">
        <select class="form-select" id="filter-tipo" style="width:auto;"><option value="todos">Todos los tipos</option>${tipoOptions}</select>
        <select class="form-select" id="filter-metodo" style="width:auto;"><option value="todos">Todos los métodos</option>${metodoOptions}</select>
      </div>` : ''}

      <div class="card" style="padding:0;">
        ${isEmpty ? renderEmptyState({
          icon: 'payment',
          title: 'No hay pagos registrados',
          message: 'Registre el primer pago del gimnasio.',
          actionLabel: 'Registrar Pago',
          actionId: 'empty-registrar-pago'
        }) : renderDataTable({
          columns: [
            { key: 'fecha', label: 'Fecha', format: 'datetime' },
            { key: 'clienteNombre', label: 'Cliente' },
            { key: 'concepto', label: 'Concepto' },
            { key: 'monto', label: 'Monto', format: 'currency' },
            { key: 'metodoPago', label: 'Método', render: v => PAYMENT_METHOD_LABELS[v] || v }
          ],
          data,
          actions: (row) => canDelete(getUserRole())
            ? `<button class="btn btn-danger btn-sm" data-action="delete" data-id="${row.id}">Eliminar</button>` : '',
          emptyMessage: 'No hay registros'
        })}
      </div>
      ${!isEmpty ? '<div id="pagination-container"></div>' : ''}
    </div>
  `;

  if (!isEmpty) {
    appendPagination('pagination-container', renderPagination({
      page, perPage, total,
      onPageChange: (p) => { currentPage = p; loadPagos(container); }
    }));
    document.getElementById('filter-tipo')?.addEventListener('change', (e) => { filters.tipo = e.target.value; currentPage = 1; loadPagos(container); });
    document.getElementById('filter-metodo')?.addEventListener('change', (e) => { filters.metodoPago = e.target.value; currentPage = 1; loadPagos(container); });
  }

  document.getElementById('btn-nuevo-pago')?.addEventListener('click', () => showPagoForm(container));
  bindEmptyAction('empty-registrar-pago', () => showPagoForm(container));

  container.querySelectorAll('[data-action="delete"]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const ok = await Swal.fire({ title: '¿Eliminar pago?', icon: 'warning', showCancelButton: true, confirmButtonColor: '#ef4444', background: '#1a1a1a', color: '#fff' });
      if (ok.isConfirmed) { await deletePago(btn.dataset.id); loadPagos(container); }
    });
  });
}

async function showPagoForm(container) {
  const clientes = await getAllClientes();
  let selectedCliente = null;

  const tipoOptions = Object.entries(PAYMENT_TYPE_LABELS).map(([k, v]) => `<option value="${k}">${v}</option>`).join('');
  const metodoOptions = Object.entries(PAYMENT_METHOD_LABELS).map(([k, v]) => `<option value="${k}">${v}</option>`).join('');

  const { close } = createModal({
    title: 'Registrar Pago',
    size: 'modal-lg',
    content: `
      <form id="form-pago">
        <div class="form-group">
          <label class="form-label">🔍 Buscar cliente</label>
          ${renderClienteSearchBox({ inputId: 'pago-cliente-search' })}
          <div class="cliente-search-results" id="pago-cliente-results"></div>
          <p id="pago-cliente-selected" style="font-size:0.8125rem;color:var(--color-text-secondary);margin-top:0.5rem;">Cliente: ninguno (opcional)</p>
        </div>
        <div class="form-group"><label class="form-label required">Concepto</label><input class="form-input" name="concepto" required></div>
        <div class="form-grid">
          <div class="form-group"><label class="form-label required">Tipo</label><select class="form-select" name="tipo" required>${tipoOptions}</select></div>
          <div class="form-group"><label class="form-label required">Monto (Q)</label><input type="number" step="0.01" class="form-input" name="monto" required></div>
        </div>
        <div class="form-group"><label class="form-label required">Método de pago</label><select class="form-select" name="metodoPago" required>${metodoOptions}</select></div>
      </form>
    `,
    footer: `<button class="btn btn-secondary" id="btn-cancel-pago">Cancelar</button><button class="btn btn-primary" id="btn-save-pago">Registrar</button>`
  });

  bindClienteSearch({
    input: document.getElementById('pago-cliente-search'),
    resultsEl: document.getElementById('pago-cliente-results'),
    allClientes: clientes,
    onSelect: (c) => {
      selectedCliente = c;
      document.getElementById('pago-cliente-selected').textContent = `Cliente: ${c.nombreCompleto} — ${c.telefono || ''}`;
    }
  });

  document.getElementById('btn-cancel-pago')?.addEventListener('click', close);
  document.getElementById('btn-save-pago')?.addEventListener('click', async () => {
    const form = document.getElementById('form-pago');
    const data = Object.fromEntries(new FormData(form));
    if (hasErrors(validatePagoForm(data))) return;

    const user = getCurrentUserData();
    await createPago({
      clienteId: selectedCliente?.id || null,
      clienteNombre: selectedCliente?.nombreCompleto || '—',
      concepto: data.concepto,
      tipo: data.tipo,
      monto: data.monto,
      metodoPago: data.metodoPago,
      usuario: { uid: user.id, nombre: user.nombre }
    });

    close();
    Swal.fire({ icon: 'success', title: 'Pago registrado', timer: 1200, showConfirmButton: false, background: '#1a1a1a', color: '#fff' });
    loadPagos(container);
  });
}
