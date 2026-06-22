import { getClientes, createCliente, updateCliente, deleteCliente } from '../services/clientes.service.js';
import { uploadClientPhoto, validateImageFile } from '../services/storage.service.js';
import { renderDataTable, renderPagination, renderStatusBadge, appendPagination } from '../components/data-table.js';
import { renderEmptyState, bindEmptyAction } from '../components/empty-state.js';
import { renderClienteSearchBox } from '../components/cliente-search.js';
import { createModal } from '../components/modal.js';
import { validateClienteForm, hasErrors, clearFieldErrors } from '../utils/validators.js';
import { canDelete } from '../utils/permissions.js';
import { getCurrentUserData, getUserRole } from '../auth.js';
import { ROUTES, ITEMS_PER_PAGE, GENERO_OPTIONS } from '../utils/constants.js';
import { formatGenero } from '../utils/formatters.js';
import { debounce } from '../utils/helpers.js';
import { showRealError, logFirestoreError } from '../utils/debug-error.js';

let currentPage = 1;
let currentSearch = '';
let currentEstado = 'todos';

export async function render(container) {
  console.log('[BFC Clientes] Entrando a Clientes');
  try {
    await loadClientes(container);
    console.log('[BFC Clientes] Clientes cargados');
  } catch (error) {
    showRealError(container, error, 'js/pages/clientes.js', 'render / loadClientes');
  }
}

async function loadClientes(container) {
  let data = [], total = 0, page = 1, perPage = ITEMS_PER_PAGE;

  console.log('[BFC Clientes] Consultando colección clientes');
  try {
    const result = await getClientes({
      search: currentSearch,
      estado: currentEstado,
      page: currentPage,
      perPage: ITEMS_PER_PAGE
    });
    ({ data, total, page, perPage } = result);
    console.log('[BFC Clientes] Documentos obtenidos:', total);
  } catch (error) {
    logFirestoreError('Clientes', error);
    throw error;
  }

  const isEmpty = total === 0 && !currentSearch && currentEstado === 'todos';

  container.innerHTML = `
    <div class="animate-fade-in">
      <div class="page-header">
        <div>
          <h2 class="page-title">Clientes</h2>
          <p class="page-subtitle">Registro rápido de clientes</p>
        </div>
        <button class="btn btn-primary" id="btn-nuevo-cliente">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
          Nuevo Cliente
        </button>
      </div>

      <div class="filters-bar" style="margin-bottom:1rem;">
        ${renderClienteSearchBox({ inputId: 'search-clientes', placeholder: 'Buscar por nombre o teléfono...' })}
        <select class="form-select" id="filter-estado" style="width:auto;">
          <option value="todos" ${currentEstado === 'todos' ? 'selected' : ''}>Todos</option>
          <option value="activo" ${currentEstado === 'activo' ? 'selected' : ''}>Activos</option>
          <option value="proximo_vencer" ${currentEstado === 'proximo_vencer' ? 'selected' : ''}>Próximos a vencer</option>
          <option value="vencido" ${currentEstado === 'vencido' ? 'selected' : ''}>Vencidos</option>
          <option value="sin_membresia" ${currentEstado === 'sin_membresia' ? 'selected' : ''}>Sin membresía</option>
        </select>
      </div>

      <div class="card" style="padding:0;">
        ${isEmpty ? renderEmptyState({
          icon: 'users',
          title: 'No hay clientes registrados',
          message: 'Comience registrando el primer cliente del gimnasio.',
          actionLabel: 'Nuevo Cliente',
          actionId: 'empty-crear-cliente'
        }) : renderDataTable({
          columns: [
            { key: 'nombreCompleto', label: 'Nombre' },
            { key: 'telefono', label: 'Teléfono' },
            { key: 'genero', label: 'Sexo', render: v => formatGenero(v) || '—' },
            { key: 'estadoMembresia', label: 'Estado', render: v => renderStatusBadge(v) },
            { key: 'fechaVencimiento', label: 'Vencimiento', format: 'date' }
          ],
          data,
          actions: (row) => `
            <button class="btn btn-secondary btn-sm" data-action="view" data-id="${row.id}">Ver</button>
            <button class="btn btn-secondary btn-sm" data-action="edit" data-id="${row.id}">Editar</button>
            ${canDelete(getUserRole()) ? `<button class="btn btn-danger btn-sm" data-action="delete" data-id="${row.id}">Eliminar</button>` : ''}
          `,
          emptyMessage: 'No hay registros con esa búsqueda'
        })}
      </div>
      ${!isEmpty ? '<div id="pagination-container"></div>' : ''}
    </div>
  `;

  if (!isEmpty) {
    appendPagination('pagination-container', renderPagination({
      page, perPage, total,
      onPageChange: (p) => { currentPage = p; loadClientes(container); }
    }));
  }

  bindEvents(container);
}

function bindEvents(container) {
  document.getElementById('btn-nuevo-cliente')?.addEventListener('click', () => showClienteForm(container));
  bindEmptyAction('empty-crear-cliente', () => showClienteForm(container));

  const searchInput = document.getElementById('search-clientes');
  if (searchInput) {
    searchInput.value = currentSearch;
    searchInput.addEventListener('input', debounce((e) => {
      currentSearch = e.target.value;
      currentPage = 1;
      loadClientes(container);
    }));
  }

  document.getElementById('filter-estado')?.addEventListener('change', (e) => {
    currentEstado = e.target.value;
    currentPage = 1;
    loadClientes(container);
  });

  container.querySelectorAll('[data-action]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const { id, action } = btn.dataset;
      if (action === 'view') window.location.hash = `${ROUTES.CLIENTE_PERFIL}/${id}`;
      else if (action === 'edit') showClienteForm(container, id);
      else if (action === 'delete') await handleDelete(container, id);
    });
  });
}

async function showClienteForm(container, id = null) {
  let cliente = null;
  if (id) {
    const { getClienteById } = await import('../services/clientes.service.js');
    cliente = await getClienteById(id);
  }

  const generoOptions = GENERO_OPTIONS.map(g =>
    `<option value="${g.value}" ${cliente?.genero === g.value ? 'selected' : ''}>${g.label}</option>`
  ).join('');

  const { close } = createModal({
    title: cliente ? 'Editar Cliente' : 'Nuevo Cliente',
    content: `
      <form id="form-cliente">
        <div style="display:flex;gap:1rem;margin-bottom:1rem;align-items:flex-start;">
          <div style="text-align:center;flex-shrink:0;">
            <div id="foto-preview" style="width:72px;height:72px;border-radius:50%;overflow:hidden;border:2px solid var(--color-border);">
              ${cliente?.fotoURL
                ? `<img src="${cliente.fotoURL}" style="width:100%;height:100%;object-fit:cover;">`
                : '<div class="avatar avatar-placeholder" style="width:100%;height:100%;">+</div>'}
            </div>
            <input type="file" id="foto-input" accept="image/*" style="font-size:0.7rem;margin-top:0.35rem;width:72px;">
            <p style="font-size:0.65rem;color:var(--color-text-muted);margin-top:0.25rem;">Opcional</p>
          </div>
          <div style="flex:1;" class="form-grid">
            <div class="form-group" style="grid-column:1/-1;"><label class="form-label required">Nombre completo</label><input class="form-input" name="nombreCompleto" value="${cliente?.nombreCompleto || ''}" required><div class="form-error" data-error="nombreCompleto"></div></div>
            <div class="form-group"><label class="form-label required">Teléfono</label><input class="form-input" name="telefono" value="${cliente?.telefono || ''}" required><div class="form-error" data-error="telefono"></div></div>
            <div class="form-group"><label class="form-label required">Sexo</label><select class="form-select" name="genero" required><option value="">Seleccionar</option>${generoOptions}</select><div class="form-error" data-error="genero"></div></div>
            <div class="form-group"><label class="form-label required">Contacto emergencia</label><input class="form-input" name="contactoEmergencia" value="${cliente?.contactoEmergencia || ''}" required><div class="form-error" data-error="contactoEmergencia"></div></div>
            <div class="form-group"><label class="form-label required">Tel. emergencia</label><input class="form-input" name="telefonoEmergencia" value="${cliente?.telefonoEmergencia || ''}" required><div class="form-error" data-error="telefonoEmergencia"></div></div>
          </div>
        </div>
        <div class="form-group"><label class="form-label">Observaciones</label><textarea class="form-textarea" name="observaciones" rows="2">${cliente?.observaciones || ''}</textarea></div>
      </form>
    `,
    footer: `
      <button class="btn btn-secondary" id="btn-cancel">Cancelar</button>
      <button class="btn btn-primary" id="btn-save">${cliente ? 'Guardar' : 'Registrar Cliente'}</button>
    `
  });

  document.getElementById('btn-cancel')?.addEventListener('click', close);
  document.getElementById('foto-input')?.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
      document.getElementById('foto-preview').innerHTML =
        `<img src="${URL.createObjectURL(file)}" style="width:100%;height:100%;object-fit:cover;">`;
    }
  });

  document.getElementById('btn-save')?.addEventListener('click', async () => {
    const form = document.getElementById('form-cliente');
    clearFieldErrors(form);
    const data = Object.fromEntries(new FormData(form).entries());
    const errors = validateClienteForm(data);
    if (hasErrors(errors)) {
      Object.entries(errors).forEach(([field, msg]) => {
        const el = form.querySelector(`[data-error="${field}"]`);
        if (el) { el.textContent = msg; el.style.display = 'block'; }
      });
      return;
    }

    try {
      const user = getCurrentUserData();
      let fotoURL = cliente?.fotoURL || '';
      const fotoFile = document.getElementById('foto-input')?.files[0];
      if (fotoFile) {
        const imgError = validateImageFile(fotoFile);
        if (imgError) { Swal.fire({ icon: 'error', title: imgError, background: '#1a1a1a', color: '#fff' }); return; }
      }

      if (cliente) {
        if (fotoFile) fotoURL = await uploadClientPhoto(fotoFile, cliente.id);
        await updateCliente(cliente.id, { ...data, fotoURL });
      } else {
        const nuevo = await createCliente(data, user.id);
        if (fotoFile) {
          fotoURL = await uploadClientPhoto(fotoFile, nuevo.id);
          await updateCliente(nuevo.id, { fotoURL });
        }
      }

      close();
      Swal.fire({ icon: 'success', title: cliente ? 'Cliente actualizado' : 'Cliente registrado', timer: 1200, showConfirmButton: false, background: '#1a1a1a', color: '#fff' });
      loadClientes(container);
    } catch (error) {
      Swal.fire({ icon: 'error', title: 'Error', text: error.message, background: '#1a1a1a', color: '#fff' });
    }
  });
}

async function handleDelete(container, id) {
  const result = await Swal.fire({
    title: '¿Eliminar cliente?',
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#ef4444',
    confirmButtonText: 'Eliminar',
    cancelButtonText: 'Cancelar',
    background: '#1a1a1a',
    color: '#fff'
  });
  if (result.isConfirmed) {
    await deleteCliente(id);
    loadClientes(container);
  }
}
