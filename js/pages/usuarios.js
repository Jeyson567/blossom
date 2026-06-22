import { getUsuarios, createUsuario, updateUsuario, toggleUsuarioStatus, deleteUsuario } from '../services/usuarios.service.js';
import { renderDataTable } from '../components/data-table.js';
import { renderEmptyState, friendlyLoadError, bindEmptyAction } from '../components/empty-state.js';
import { createModal } from '../components/modal.js';
import { formatRole } from '../utils/formatters.js';
import { getCurrentUserData } from '../auth.js';
import { renderStatusBadge } from '../components/data-table.js';

export async function render(container) {
  let usuarios = [];

  try {
    usuarios = await getUsuarios();
  } catch (error) {
    console.error('[BFC Usuarios] Error:', error);
    container.innerHTML = `
      <div class="animate-fade-in">
        <div class="page-header"><div><h2 class="page-title">Usuarios</h2></div></div>
        ${renderEmptyState({ icon: 'users', title: 'No se pudieron cargar los usuarios', message: friendlyLoadError(error) })}
      </div>`;
    return;
  }

  const currentUser = getCurrentUserData();
  const isEmpty = usuarios.length === 0;

  container.innerHTML = `
    <div class="animate-fade-in">
      <div class="page-header">
        <div>
          <h2 class="page-title">Usuarios</h2>
          <p class="page-subtitle">Administración de usuarios del sistema</p>
        </div>
        <button class="btn btn-primary" id="btn-nuevo-usuario">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
          Nuevo Usuario
        </button>
      </div>

      <div class="card" style="padding:0;">
        ${isEmpty ? renderEmptyState({
          icon: 'users',
          title: 'No hay usuarios adicionales',
          message: 'Cree cuentas para el personal de recepción o administradores adicionales.',
          actionLabel: 'Nuevo Usuario',
          actionId: 'empty-nuevo-usuario'
        }) : renderDataTable({
          columns: [
            { key: 'nombre', label: 'Nombre' },
            { key: 'email', label: 'Correo' },
            { key: 'rol', label: 'Rol', render: v => formatRole(v) },
            { key: 'activo', label: 'Estado', render: v => renderStatusBadge(v ? 'activo' : 'vencido') }
          ],
          data: usuarios,
          actions: (row) => row.id !== currentUser.id ? `
            <button class="btn btn-secondary btn-sm" data-action="edit" data-id="${row.id}">Editar</button>
            <button class="btn btn-secondary btn-sm" data-action="toggle" data-id="${row.id}">${row.activo ? 'Desactivar' : 'Activar'}</button>
            <button class="btn btn-danger btn-sm" data-action="delete" data-id="${row.id}">Eliminar</button>
          ` : '<span style="font-size:0.75rem;color:var(--color-text-muted);">Usuario actual</span>',
          emptyMessage: 'No hay usuarios registrados'
        })}
      </div>
    </div>
  `;

  document.getElementById('btn-nuevo-usuario')?.addEventListener('click', () => showUsuarioForm(container));
  bindEmptyAction('empty-nuevo-usuario', () => showUsuarioForm(container));

  container.querySelectorAll('[data-action]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.id;
      const usuario = usuarios.find(u => u.id === id);
      if (btn.dataset.action === 'edit') showUsuarioForm(container, usuario);
      else if (btn.dataset.action === 'toggle') {
        await toggleUsuarioStatus(id, !usuario.activo);
        render(container);
      } else if (btn.dataset.action === 'delete') {
        const result = await Swal.fire({ title: '¿Eliminar usuario?', icon: 'warning', showCancelButton: true, confirmButtonColor: '#ef4444', background: '#1a1a1a', color: '#fff' });
        if (result.isConfirmed) { await deleteUsuario(id); render(container); }
      }
    });
  });
}

function showUsuarioForm(container, usuario = null) {
  const { close } = createModal({
    title: usuario ? 'Editar Usuario' : 'Nuevo Usuario',
    content: `
      <form id="form-usuario">
        <div class="form-group"><label class="form-label required">Nombre</label><input class="form-input" name="nombre" value="${usuario?.nombre || ''}" required></div>
        ${!usuario ? `<div class="form-group"><label class="form-label required">Correo</label><input type="email" class="form-input" name="email" required></div>
        <div class="form-group"><label class="form-label required">Contraseña</label><input type="password" class="form-input" name="password" minlength="6" required></div>` : ''}
        <div class="form-group"><label class="form-label required">Rol</label>
          <select class="form-select" name="rol">
            <option value="recepcion" ${usuario?.rol === 'recepcion' ? 'selected' : ''}>Recepción</option>
            <option value="admin" ${usuario?.rol === 'admin' ? 'selected' : ''}>Administrador</option>
          </select>
        </div>
      </form>
    `,
    footer: `<button class="btn btn-secondary" id="btn-cancel-user">Cancelar</button><button class="btn btn-primary" id="btn-save-user">Guardar</button>`
  });

  document.getElementById('btn-cancel-user')?.addEventListener('click', close);
  document.getElementById('btn-save-user')?.addEventListener('click', async () => {
    const data = Object.fromEntries(new FormData(document.getElementById('form-usuario')));
    try {
      if (usuario) await updateUsuario(usuario.id, data);
      else await createUsuario(data);
      close();
      Swal.fire({ icon: 'success', title: usuario ? 'Usuario actualizado' : 'Usuario creado', timer: 1500, showConfirmButton: false, background: '#1a1a1a', color: '#fff' });
      render(container);
    } catch (error) {
      const msg = error.code === 'auth/email-already-in-use'
        ? 'Este correo ya está registrado.'
        : error.code === 'auth/weak-password'
        ? 'La contraseña debe tener al menos 6 caracteres.'
        : friendlyLoadError(error);
      Swal.fire({ icon: 'error', title: 'Error', text: msg, background: '#1a1a1a', color: '#fff' });
    }
  });
}
