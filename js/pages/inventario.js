import {
  getProductos, createProducto, updateProducto, deleteProducto,
  registrarMovimiento, getStockAlerts, getCategorias
} from '../services/inventario.service.js';
import { renderDataTable, renderPagination, appendPagination } from '../components/data-table.js';
import { renderEmptyState, bindEmptyAction } from '../components/empty-state.js';
import { createModal } from '../components/modal.js';
import { getCurrentUserData, getUserRole } from '../auth.js';
import { canDelete } from '../utils/permissions.js';
import { formatCurrency } from '../utils/formatters.js';
import { ITEMS_PER_PAGE } from '../utils/constants.js';
import { debounce } from '../utils/helpers.js';

let currentPage = 1;
let currentSearch = '';

export async function render(container) {
  let alerts = { agotado: [], bajo: [] };
  try {
    alerts = await getStockAlerts();
  } catch (error) {
    console.warn('[BFC Inventario] Alertas no disponibles:', error.message);
  }
  await loadProductos(container, alerts);
}

async function loadProductos(container, alerts) {
  let data = [], total = 0, page = 1, perPage = ITEMS_PER_PAGE;

  try {
    const result = await getProductos({ search: currentSearch, page: currentPage, perPage: ITEMS_PER_PAGE });
    data = result.data;
    total = result.total;
    page = result.page;
    perPage = result.perPage;
  } catch (error) {
    console.error('[BFC Inventario]', error);
    if (error.code === 'permission-denied') throw error;
    data = [];
    total = 0;
  }

  const isEmpty = total === 0 && !currentSearch;

  container.innerHTML = `
    <div class="animate-fade-in">
      <div class="page-header">
        <div>
          <h2 class="page-title">Inventario</h2>
          <p class="page-subtitle">Gestión de productos y stock</p>
        </div>
        <button class="btn btn-primary" id="btn-nuevo-producto">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
          Nuevo Producto
        </button>
      </div>

      ${!isEmpty && (alerts.agotado.length || alerts.bajo.length) ? `
        <div style="margin-bottom:1rem;display:flex;gap:0.5rem;flex-wrap:wrap;">
          ${alerts.agotado.length ? `<span class="badge badge-danger">${alerts.agotado.length} agotados</span>` : ''}
          ${alerts.bajo.length ? `<span class="badge badge-warning">${alerts.bajo.length} stock bajo</span>` : ''}
        </div>
      ` : ''}

      ${isEmpty ? '' : `
      <div class="filters-bar">
        <div class="search-box" style="flex:1;max-width:320px;">
          <svg class="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0016 9.5 6.5 6.5 0 109.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>
          <input type="text" class="form-input" id="search-producto" placeholder="Buscar producto..." value="${currentSearch}">
        </div>
      </div>
      `}

      <div class="card" style="padding:0;">
        ${isEmpty ? renderEmptyState({
          icon: 'inventory',
          title: 'No existen productos registrados',
          message: 'Agregue productos para controlar el stock de la tienda del gimnasio.',
          actionLabel: 'Nuevo Producto',
          actionId: 'empty-agregar-producto'
        }) : renderDataTable({
          columns: [
            { key: 'codigo', label: 'Código' },
            { key: 'nombre', label: 'Nombre' },
            { key: 'categoria', label: 'Categoría' },
            { key: 'stock', label: 'Stock', render: (v, row) => {
              const cls = v <= 0 ? 'badge-danger' : v <= row.stockMinimo ? 'badge-warning' : 'badge-success';
              return `<span class="badge ${cls}">${v}</span>`;
            }},
            { key: 'precioVenta', label: 'Precio Venta', format: 'currency' },
            { key: 'ganancia', label: 'Ganancia/u', render: (_, row) => formatCurrency((row.precioVenta || 0) - (row.precioCompra || 0)) }
          ],
          data,
          actions: (row) => `
            <button class="btn btn-secondary btn-sm" data-action="mov" data-id="${row.id}">Movimiento</button>
            <button class="btn btn-secondary btn-sm" data-action="edit" data-id="${row.id}">Editar</button>
            ${canDelete(getUserRole()) ? `<button class="btn btn-danger btn-sm" data-action="delete" data-id="${row.id}">Eliminar</button>` : ''}
          `,
          emptyMessage: 'No se encontraron productos'
        })}
      </div>
      ${isEmpty ? '' : '<div id="pagination-container"></div>'}
    </div>
  `;

  if (!isEmpty) {
    const paginationEl = renderPagination({ page, perPage, total, onPageChange: (p) => { currentPage = p; render(container); } });
    console.log('appendChild recibe:', paginationEl);
    console.log(typeof paginationEl);
    console.log(paginationEl);
    if (paginationEl instanceof Node) {
      appendPagination('pagination-container', paginationEl);
    }
  }

  document.getElementById('btn-nuevo-producto')?.addEventListener('click', () => showProductoForm(container));
  bindEmptyAction('empty-agregar-producto', () => showProductoForm(container));
  if (!isEmpty) {
    document.getElementById('search-producto')?.addEventListener('input', debounce((e) => {
      currentSearch = e.target.value;
      currentPage = 1;
      render(container);
    }));
  }

  container.querySelectorAll('[data-action]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.id;
      if (btn.dataset.action === 'edit') showProductoForm(container, id);
      else if (btn.dataset.action === 'mov') showMovimientoForm(container, id);
      else if (btn.dataset.action === 'delete') {
        const result = await Swal.fire({ title: '¿Eliminar producto?', icon: 'warning', showCancelButton: true, confirmButtonColor: '#ef4444', background: '#1a1a1a', color: '#fff' });
        if (result.isConfirmed) { await deleteProducto(id); render(container); }
      }
    });
  });
}

async function showProductoForm(container, id = null) {
  let producto = null;
  if (id) {
    const { getProductoById } = await import('../services/inventario.service.js');
    producto = await getProductoById(id);
  }

  const categorias = await getCategorias().catch(() => []);
  const categoriaOptions = ['General', 'Proteínas', 'Creatinas', 'Accesorios', 'Suplementos', ...categorias]
    .filter((v, i, a) => a.indexOf(v) === i)
    .map(c => `<option value="${c}" ${producto?.categoria === c ? 'selected' : ''}>${c}</option>`).join('');

  const { close } = createModal({
    title: producto ? 'Editar Producto' : 'Nuevo Producto',
    content: `
      <form id="form-producto">
        <div class="form-grid">
          <div class="form-group" style="grid-column:1/-1;"><label class="form-label required">Nombre</label><input class="form-input" name="nombre" value="${producto?.nombre || ''}" required></div>
          <div class="form-group"><label class="form-label required">Categoría</label><select class="form-select" name="categoria">${categoriaOptions}</select></div>
          <div class="form-group"><label class="form-label">Código</label><input class="form-input" name="codigo" value="${producto?.codigo || ''}" placeholder="Auto si vacío"></div>
          <div class="form-group"><label class="form-label required">Precio compra (Q)</label><input type="number" step="0.01" min="0" class="form-input" name="precioCompra" value="${producto?.precioCompra ?? 0}" required></div>
          <div class="form-group"><label class="form-label required">Precio venta (Q)</label><input type="number" step="0.01" min="0" class="form-input" name="precioVenta" value="${producto?.precioVenta ?? 0}" required></div>
          <div class="form-group"><label class="form-label required">Stock actual</label><input type="number" min="0" class="form-input" name="stock" value="${producto?.stock ?? 0}" required></div>
          <div class="form-group"><label class="form-label required">Stock mínimo</label><input type="number" min="0" class="form-input" name="stockMinimo" value="${producto?.stockMinimo ?? 5}" required></div>
        </div>
      </form>
    `,
    footer: `<button class="btn btn-secondary" id="btn-cancel-prod">Cancelar</button><button class="btn btn-primary" id="btn-save-prod">Guardar</button>`
  });

  document.getElementById('btn-cancel-prod')?.addEventListener('click', close);
  document.getElementById('btn-save-prod')?.addEventListener('click', async () => {
    const data = Object.fromEntries(new FormData(document.getElementById('form-producto')));
    if (producto) await updateProducto(producto.id, data);
    else await createProducto(data);
    close();
    Swal.fire({ icon: 'success', title: producto ? 'Producto actualizado' : 'Producto agregado', timer: 1500, showConfirmButton: false, background: '#1a1a1a', color: '#fff' });
    render(container);
  });
}

function showMovimientoForm(container, productoId) {
  const { close } = createModal({
    title: 'Registrar Movimiento',
    content: `
      <form id="form-mov-inv">
        <div class="form-group"><label class="form-label required">Tipo</label><select class="form-select" name="tipo"><option value="entrada">Entrada</option><option value="salida">Salida</option></select></div>
        <div class="form-group"><label class="form-label required">Cantidad</label><input type="number" class="form-input" name="cantidad" min="1" required></div>
        <div class="form-group"><label class="form-label">Motivo</label><input class="form-input" name="motivo"></div>
      </form>
    `,
    footer: `<button class="btn btn-secondary" id="btn-cancel-mov-inv">Cancelar</button><button class="btn btn-primary" id="btn-save-mov-inv">Registrar</button>`
  });

  document.getElementById('btn-cancel-mov-inv')?.addEventListener('click', close);
  document.getElementById('btn-save-mov-inv')?.addEventListener('click', async () => {
    const data = Object.fromEntries(new FormData(document.getElementById('form-mov-inv')));
    const user = getCurrentUserData();
    try {
      await registrarMovimiento({ productoId, ...data, usuario: { uid: user.id, nombre: user.nombre } });
      close();
      render(container);
    } catch (error) {
      Swal.fire({ icon: 'error', title: error.message, background: '#1a1a1a', color: '#fff' });
    }
  });
}
