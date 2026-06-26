import { getPagos, createPago, deletePago } from '../services/pagos.service.js';
import { getAllClientes } from '../services/clientes.service.js';
import { getAllProductos, venderProducto } from '../services/inventario.service.js';
import { renderDataTable, renderPagination, appendPagination } from '../components/data-table.js';
import { renderEmptyState, bindEmptyAction } from '../components/empty-state.js';
import { renderClienteSearchBox, bindClienteSearch } from '../components/cliente-search.js';
import { createModal } from '../components/modal.js';
import { validatePagoForm, hasErrors } from '../utils/validators.js';
import { getCurrentUserData, getUserRole } from '../auth.js';
import { canDelete } from '../utils/permissions.js';
import { PAYMENT_TYPE_LABELS, PAYMENT_METHOD_LABELS, ITEMS_PER_PAGE, ROUTES } from '../utils/constants.js';
import { formatCurrency } from '../utils/formatters.js';
import { debounce } from '../utils/helpers.js';
import { showRealError, logFirestoreError } from '../utils/debug-error.js';
import { navigateTo } from '../router.js';

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

  try {
    const result = await getPagos({ page: currentPage, perPage: ITEMS_PER_PAGE, ...filters });
    ({ data, total, page, perPage } = result);
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
          <p class="page-subtitle">Ventas, membresías e ingresos del gimnasio</p>
        </div>
        <button class="btn btn-primary" id="btn-nueva-venta">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
          Nueva Venta
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
          message: 'Registre ventas de membresías, productos u otros ingresos.',
          actionLabel: 'Nueva Venta',
          actionId: 'empty-registrar-pago'
        }) : renderDataTable({
          columns: [
            { key: 'fecha', label: 'Fecha', format: 'datetime' },
            { key: 'clienteNombre', label: 'Cliente' },
            { key: 'concepto', label: 'Concepto' },
            { key: 'tipo', label: 'Tipo', render: v => PAYMENT_TYPE_LABELS[v] || v },
            { key: 'monto', label: 'Monto', format: 'currency' },
            { key: 'ganancia', label: 'Ganancia', render: v => v != null ? formatCurrency(v) : '—' },
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

  document.getElementById('btn-nueva-venta')?.addEventListener('click', () => showNuevaVenta(container));
  bindEmptyAction('empty-registrar-pago', () => showNuevaVenta(container));

  container.querySelectorAll('[data-action="delete"]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const ok = await Swal.fire({ title: '¿Eliminar pago?', icon: 'warning', showCancelButton: true, confirmButtonColor: '#ef4444', background: '#1a1a1a', color: '#fff' });
      if (ok.isConfirmed) { await deletePago(btn.dataset.id); loadPagos(container); }
    });
  });
}

function showNuevaVenta(container) {
  const { close } = createModal({
    title: 'Nueva Venta',
    content: `
      <div class="form-group">
        <label class="form-label">Tipo de venta</label>
        <div style="display:flex;flex-direction:column;gap:0.5rem;">
          <label style="display:flex;align-items:center;gap:0.5rem;cursor:pointer;font-size:0.875rem;">
            <input type="radio" name="tipo-venta" value="membresia" checked> Membresía
          </label>
          <label style="display:flex;align-items:center;gap:0.5rem;cursor:pointer;font-size:0.875rem;">
            <input type="radio" name="tipo-venta" value="inscripcion"> Inscripción
          </label>
          <label style="display:flex;align-items:center;gap:0.5rem;cursor:pointer;font-size:0.875rem;">
            <input type="radio" name="tipo-venta" value="producto"> Producto
          </label>
          <label style="display:flex;align-items:center;gap:0.5rem;cursor:pointer;font-size:0.875rem;">
            <input type="radio" name="tipo-venta" value="otro"> Otro ingreso
          </label>
        </div>
      </div>
    `,
    footer: `<button class="btn btn-secondary" id="btn-cancel-tipo">Cancelar</button><button class="btn btn-primary" id="btn-continuar-venta">Continuar</button>`
  });

  document.getElementById('btn-cancel-tipo')?.addEventListener('click', close);
  document.getElementById('btn-continuar-venta')?.addEventListener('click', () => {
    const tipo = document.querySelector('input[name="tipo-venta"]:checked')?.value;
    close();
    if (tipo === 'membresia') navigateTo(ROUTES.VENTA);
    else if (tipo === 'inscripcion') showInscripcion(container);
    else if (tipo === 'producto') showVentaProducto(container);
    else showOtroIngreso(container);
  });
}

async function showVentaProducto(container) {
  const [productos, clientes] = await Promise.all([getAllProductos(), getAllClientes()]);
  let selectedProducto = null;
  let selectedCliente = null;
  let cantidad = 1;

  const { close } = createModal({
    title: 'Venta de Producto',
    size: 'modal-lg',
    content: `
      <form id="form-venta-producto">
        <div class="form-group">
          <label class="form-label">🔍 Buscar producto</label>
          <input type="text" class="form-input" id="producto-search" placeholder="Nombre o código..." autocomplete="off">
          <div id="producto-results" class="cliente-search-results"></div>
          <p id="producto-selected" style="font-size:0.8125rem;color:var(--color-text-muted);margin-top:0.5rem;">Producto: ninguno</p>
        </div>
        <div class="form-group">
          <label class="form-label">Cliente (opcional)</label>
          ${renderClienteSearchBox({ inputId: 'venta-prod-cliente' })}
          <div class="cliente-search-results" id="venta-prod-cliente-results"></div>
        </div>
        <div class="form-grid">
          <div class="form-group">
            <label class="form-label required">Cantidad</label>
            <input type="number" class="form-input" id="venta-cantidad" name="cantidad" min="1" value="1" required>
          </div>
          <div class="form-group">
            <label class="form-label required">Método de pago</label>
            <select class="form-select" name="metodoPago" required>
              ${Object.entries(PAYMENT_METHOD_LABELS).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="card" style="padding:0.75rem;margin-top:0.5rem;background:var(--color-bg-input);">
          <p style="font-size:0.8125rem;margin-bottom:0.25rem;">Stock disponible: <strong id="venta-stock">—</strong></p>
          <p style="font-size:0.8125rem;margin-bottom:0.25rem;">Total: <strong id="venta-total" style="color:var(--color-gold);">Q 0.00</strong></p>
          <p style="font-size:0.8125rem;">Ganancia: <strong id="venta-ganancia" style="color:var(--color-success);">Q 0.00</strong></p>
        </div>
      </form>
    `,
    footer: `<button class="btn btn-secondary" id="btn-cancel-prod-venta">Cancelar</button><button class="btn btn-primary" id="btn-confirm-prod-venta">Confirmar venta</button>`
  });

  const renderProductoResults = (term) => {
    const el = document.getElementById('producto-results');
    if (!el) return;
    const t = (term || '').trim().toLowerCase();
    if (!t) {
      el.innerHTML = '<p style="padding:0.75rem;font-size:0.8125rem;color:var(--color-text-muted);">Escriba para buscar</p>';
      return;
    }
    const filtered = productos.filter(p =>
      p.activo !== false && (
        p.nombre?.toLowerCase().includes(t) ||
        p.codigo?.toLowerCase().includes(t) ||
        p.categoria?.toLowerCase().includes(t)
      )
    ).slice(0, 8);
    if (!filtered.length) {
      el.innerHTML = '<p style="padding:0.75rem;font-size:0.8125rem;color:var(--color-text-muted);">Sin resultados</p>';
      return;
    }
    el.innerHTML = filtered.map(p => `
      <button type="button" class="cliente-search-item" data-producto-id="${p.id}">
        <span class="cliente-search-name">${p.nombre}</span>
        <span class="cliente-search-tel">Stock: ${p.stock} · ${formatCurrency(p.precioVenta)}</span>
      </button>
    `).join('');
    el.querySelectorAll('[data-producto-id]').forEach(btn => {
      btn.addEventListener('click', () => {
        selectedProducto = productos.find(p => p.id === btn.dataset.productoId);
        document.getElementById('producto-selected').textContent =
          `Producto: ${selectedProducto.nombre} (${selectedProducto.codigo})`;
        updateVentaResumen();
      });
    });
  };

  const updateVentaResumen = () => {
    cantidad = Math.max(1, Number(document.getElementById('venta-cantidad')?.value) || 1);
    if (!selectedProducto) {
      document.getElementById('venta-stock').textContent = '—';
      document.getElementById('venta-total').textContent = formatCurrency(0);
      document.getElementById('venta-ganancia').textContent = formatCurrency(0);
      return;
    }
    const total = (selectedProducto.precioVenta || 0) * cantidad;
    const ganancia = ((selectedProducto.precioVenta || 0) - (selectedProducto.precioCompra || 0)) * cantidad;
    document.getElementById('venta-stock').textContent = String(selectedProducto.stock ?? 0);
    document.getElementById('venta-total').textContent = formatCurrency(total);
    document.getElementById('venta-ganancia').textContent = formatCurrency(ganancia);
  };

  document.getElementById('producto-search')?.addEventListener('input', debounce((e) => renderProductoResults(e.target.value), 200));
  document.getElementById('venta-cantidad')?.addEventListener('input', updateVentaResumen);

  bindClienteSearch({
    input: document.getElementById('venta-prod-cliente'),
    resultsEl: document.getElementById('venta-prod-cliente-results'),
    allClientes: clientes,
    onSelect: (c) => { selectedCliente = c; }
  });

  document.getElementById('btn-cancel-prod-venta')?.addEventListener('click', close);
  document.getElementById('btn-confirm-prod-venta')?.addEventListener('click', async () => {
    if (!selectedProducto) {
      Swal.fire({ icon: 'warning', title: 'Seleccione un producto', background: '#1a1a1a', color: '#fff' });
      return;
    }
    cantidad = Math.max(1, Number(document.getElementById('venta-cantidad')?.value) || 1);
    const metodoPago = document.querySelector('[name="metodoPago"]')?.value;
    const user = getCurrentUserData();

    try {
      const venta = await venderProducto({
        productoId: selectedProducto.id,
        cantidad,
        motivo: `Venta${selectedCliente ? ` — ${selectedCliente.nombreCompleto}` : ''}`,
        usuario: { uid: user.id, nombre: user.nombre }
      });

      await createPago({
        clienteId: selectedCliente?.id || null,
        clienteNombre: selectedCliente?.nombreCompleto || 'Venta mostrador',
        concepto: `${selectedProducto.nombre} x${cantidad}`,
        tipo: 'producto',
        monto: venta.totalVenta,
        metodoPago,
        productoId: selectedProducto.id,
        productoNombre: selectedProducto.nombre,
        cantidad,
        ganancia: venta.ganancia,
        precioCompraUnitario: venta.precioCompraUnitario,
        usuario: { uid: user.id, nombre: user.nombre }
      });

      close();
      Swal.fire({
        icon: 'success',
        title: 'Venta registrada',
        html: `<p>Total: ${formatCurrency(venta.totalVenta)}</p><p>Ganancia: ${formatCurrency(venta.ganancia)}</p>`,
        timer: 2000,
        showConfirmButton: false,
        background: '#1a1a1a',
        color: '#fff'
      });
      loadPagos(container);
    } catch (error) {
      Swal.fire({ icon: 'error', title: 'Error', text: error.message, background: '#1a1a1a', color: '#fff' });
    }
  });
}

async function showInscripcion(container) {
  const clientes = await getAllClientes();
  let selectedCliente = null;
  const metodoOptions = Object.entries(PAYMENT_METHOD_LABELS).map(([k, v]) => `<option value="${k}">${v}</option>`).join('');

  const { close } = createModal({
    title: 'Inscripción',
    size: 'modal-lg',
    content: `
      <form id="form-pago-inscripcion">
        <div class="form-group">
          <label class="form-label required">Cliente</label>
          ${renderClienteSearchBox({ inputId: 'pago-inscripcion-cliente' })}
          <div class="cliente-search-results" id="pago-inscripcion-cliente-results"></div>
        </div>
        <div class="form-group"><label class="form-label">Concepto</label><input class="form-input" name="concepto" value="Inscripción"></div>
        <div class="form-grid">
          <div class="form-group"><label class="form-label required">Monto (Q)</label><input type="number" step="0.01" class="form-input" name="monto" required></div>
          <div class="form-group"><label class="form-label required">Método</label><select class="form-select" name="metodoPago" required>${metodoOptions}</select></div>
        </div>
      </form>
    `,
    footer: `<button class="btn btn-secondary" id="btn-cancel-inscripcion">Cancelar</button><button class="btn btn-primary" id="btn-save-inscripcion">Registrar</button>`
  });

  bindClienteSearch({
    input: document.getElementById('pago-inscripcion-cliente'),
    resultsEl: document.getElementById('pago-inscripcion-cliente-results'),
    allClientes: clientes,
    onSelect: (c) => { selectedCliente = c; }
  });

  document.getElementById('btn-cancel-inscripcion')?.addEventListener('click', close);
  document.getElementById('btn-save-inscripcion')?.addEventListener('click', async () => {
    if (!selectedCliente) {
      Swal.fire({ icon: 'warning', title: 'Seleccione un cliente', background: '#1a1a1a', color: '#fff' });
      return;
    }
    const form = document.getElementById('form-pago-inscripcion');
    const data = Object.fromEntries(new FormData(form));
    if (hasErrors(validatePagoForm(data))) return;
    const user = getCurrentUserData();
    await createPago({
      clienteId: selectedCliente.id,
      clienteNombre: selectedCliente.nombreCompleto,
      concepto: data.concepto?.trim() || 'Inscripción',
      tipo: 'inscripcion',
      monto: data.monto,
      metodoPago: data.metodoPago,
      ganancia: Number(data.monto),
      usuario: { uid: user.id, nombre: user.nombre }
    });
    close();
    Swal.fire({ icon: 'success', title: 'Inscripción registrada', timer: 1200, showConfirmButton: false, background: '#1a1a1a', color: '#fff' });
    loadPagos(container);
  });
}

async function showOtroIngreso(container) {
  const clientes = await getAllClientes();
  let selectedCliente = null;
  const metodoOptions = Object.entries(PAYMENT_METHOD_LABELS).map(([k, v]) => `<option value="${k}">${v}</option>`).join('');

  const { close } = createModal({
    title: 'Otro Ingreso',
    size: 'modal-lg',
    content: `
      <form id="form-pago-otro">
        <div class="form-group">
          <label class="form-label">Cliente (opcional)</label>
          ${renderClienteSearchBox({ inputId: 'pago-otro-cliente' })}
          <div class="cliente-search-results" id="pago-otro-cliente-results"></div>
        </div>
        <div class="form-group"><label class="form-label required">Concepto</label><input class="form-input" name="concepto" required></div>
        <div class="form-grid">
          <div class="form-group"><label class="form-label required">Monto (Q)</label><input type="number" step="0.01" class="form-input" name="monto" required></div>
          <div class="form-group"><label class="form-label required">Método</label><select class="form-select" name="metodoPago" required>${metodoOptions}</select></div>
        </div>
      </form>
    `,
    footer: `<button class="btn btn-secondary" id="btn-cancel-otro">Cancelar</button><button class="btn btn-primary" id="btn-save-otro">Registrar</button>`
  });

  bindClienteSearch({
    input: document.getElementById('pago-otro-cliente'),
    resultsEl: document.getElementById('pago-otro-cliente-results'),
    allClientes: clientes,
    onSelect: (c) => { selectedCliente = c; }
  });

  document.getElementById('btn-cancel-otro')?.addEventListener('click', close);
  document.getElementById('btn-save-otro')?.addEventListener('click', async () => {
    const form = document.getElementById('form-pago-otro');
    const data = Object.fromEntries(new FormData(form));
    if (hasErrors(validatePagoForm(data))) return;
    const user = getCurrentUserData();
    await createPago({
      clienteId: selectedCliente?.id || null,
      clienteNombre: selectedCliente?.nombreCompleto || '—',
      concepto: data.concepto,
      tipo: 'otro',
      monto: data.monto,
      metodoPago: data.metodoPago,
      ganancia: Number(data.monto),
      usuario: { uid: user.id, nombre: user.nombre }
    });
    close();
    Swal.fire({ icon: 'success', title: 'Ingreso registrado', timer: 1200, showConfirmButton: false, background: '#1a1a1a', color: '#fff' });
    loadPagos(container);
  });
}
