import { getPlanes, createPlan, updatePlan, deletePlan, togglePlanStatus } from '../services/planes.service.js';
import { renderDataTable } from '../components/data-table.js';
import { createModal } from '../components/modal.js';
import { renderEmptyState, bindEmptyAction } from '../components/empty-state.js';
import { validatePlanForm, hasErrors } from '../utils/validators.js';
import { formatCurrency } from '../utils/formatters.js';
import { canDelete } from '../utils/permissions.js';
import { getUserRole } from '../auth.js';
import { debounce } from '../utils/helpers.js';

let currentSearch = '';

export async function render(container) {
  let planes = [];
  try {
    planes = await getPlanes();
  } catch (error) {
    console.error('[BFC Membresías]', error);
    if (error.code === 'permission-denied') throw error;
    planes = [];
  }

  if (currentSearch) {
    const q = currentSearch.toLowerCase();
    planes = planes.filter(p => p.nombre?.toLowerCase().includes(q));
  }

  const isEmpty = planes.length === 0 && !currentSearch;

  container.innerHTML = `
    <div class="animate-fade-in">
      <div class="page-header">
        <div>
          <h2 class="page-title">Membresías</h2>
          <p class="page-subtitle">Planes de Blossom Fitness Club</p>
        </div>
        <button class="btn btn-primary" id="btn-nuevo-plan">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
          Nueva Membresía
        </button>
      </div>

      <div class="filters-bar" style="margin-bottom:1rem;">
        <div class="search-box" style="flex:1;max-width:320px;">
          <svg class="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0016 9.5 6.5 6.5 0 109.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>
          <input type="text" class="form-input" id="search-planes" placeholder="Buscar plan..." value="${currentSearch}">
        </div>
      </div>

      <div class="card" style="padding:0;">
        ${isEmpty ? renderEmptyState({
          icon: 'plans',
          title: 'No existen planes registrados',
          message: 'Cree los planes de membresía del gimnasio.',
          actionLabel: 'Crear Primer Plan',
          actionId: 'empty-crear-plan'
        }) : renderDataTable({
          columns: [
            { key: 'nombre', label: 'Nombre' },
            { key: 'duracionDias', label: 'Duración', render: v => `${v} días` },
            { key: 'precio', label: 'Precio', format: 'currency' },
            { key: 'activo', label: 'Estado', render: v => `<span class="badge ${v !== false ? 'badge-success' : 'badge-neutral'}">${v !== false ? 'Activo' : 'Inactivo'}</span>` }
          ],
          data: planes,
          actions: (row) => `
            <button class="btn btn-secondary btn-sm" data-action="edit" data-id="${row.id}">Editar</button>
            <button class="btn btn-secondary btn-sm" data-action="toggle" data-id="${row.id}">${row.activo !== false ? 'Desactivar' : 'Activar'}</button>
            ${canDelete(getUserRole()) ? `<button class="btn btn-danger btn-sm" data-action="delete" data-id="${row.id}">Eliminar</button>` : ''}
          `,
          emptyMessage: 'No hay registros'
        })}
      </div>
    </div>
  `;

  document.getElementById('btn-nuevo-plan')?.addEventListener('click', () => showPlanForm(container));
  bindEmptyAction('empty-crear-plan', () => showPlanForm(container));
  document.getElementById('search-planes')?.addEventListener('input', debounce((e) => {
    currentSearch = e.target.value;
    render(container);
  }));

  container.querySelectorAll('[data-action]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const { id, action } = btn.dataset;
      if (action === 'edit') showPlanForm(container, id);
      else if (action === 'toggle') {
        const { getPlanById } = await import('../services/planes.service.js');
        const plan = await getPlanById(id);
        await togglePlanStatus(id, !plan.activo);
        render(container);
      } else if (action === 'delete') {
        const ok = await Swal.fire({ title: '¿Eliminar plan?', icon: 'warning', showCancelButton: true, confirmButtonColor: '#ef4444', background: '#1a1a1a', color: '#fff' });
        if (ok.isConfirmed) { await deletePlan(id); render(container); }
      }
    });
  });
}

async function showPlanForm(container, id = null) {
  let plan = null;
  if (id) {
    const { getPlanById } = await import('../services/planes.service.js');
    plan = await getPlanById(id);
  }

  const { close } = createModal({
    title: plan ? 'Editar Membresía' : 'Nueva Membresía',
    content: `
      <form id="form-plan">
        <div class="form-group"><label class="form-label required">Nombre</label><input class="form-input" name="nombre" value="${plan?.nombre || ''}" required><div class="form-error" data-error="nombre"></div></div>
        <div class="form-grid">
          <div class="form-group"><label class="form-label required">Precio (Q)</label><input type="number" step="0.01" class="form-input" name="precio" value="${plan?.precio ?? ''}" required><div class="form-error" data-error="precio"></div></div>
          <div class="form-group"><label class="form-label required">Duración (días)</label><input type="number" class="form-input" name="duracionDias" value="${plan?.duracionDias ?? ''}" required><div class="form-error" data-error="duracionDias"></div></div>
        </div>
        <div class="form-group"><label style="display:flex;align-items:center;gap:0.5rem;cursor:pointer;"><input type="checkbox" name="activo" ${plan?.activo !== false ? 'checked' : ''}> Activo</label></div>
      </form>
    `,
    footer: `<button class="btn btn-secondary" id="btn-cancel-plan">Cancelar</button><button class="btn btn-primary" id="btn-save-plan">Guardar</button>`
  });

  document.getElementById('btn-cancel-plan')?.addEventListener('click', close);
  document.getElementById('btn-save-plan')?.addEventListener('click', async () => {
    const form = document.getElementById('form-plan');
    const data = Object.fromEntries(new FormData(form));
    data.activo = form.querySelector('[name="activo"]').checked;
    const errors = validatePlanForm(data);
    if (hasErrors(errors)) {
      Object.entries(errors).forEach(([field, msg]) => {
        const el = form.querySelector(`[data-error="${field}"]`);
        if (el) { el.textContent = msg; el.style.display = 'block'; }
      });
      return;
    }
    if (plan) await updatePlan(plan.id, data);
    else await createPlan(data);
    close();
    Swal.fire({ icon: 'success', title: 'Guardado', timer: 1200, showConfirmButton: false, background: '#1a1a1a', color: '#fff' });
    render(container);
  });
}
