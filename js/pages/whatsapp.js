import {
  getAllNotificaciones,
  enviarManual,
  marcarEnviada,
  getWhatsAppUrl,
  generateMessagePreview
} from '../services/whatsapp.service.js';
import { getConfig } from '../services/config.service.js';
import { getAllClientes } from '../services/clientes.service.js';
import { renderClienteSearchBox, bindClienteSearch } from '../components/cliente-search.js';
import { renderEmptyState, bindEmptyAction } from '../components/empty-state.js';
import { renderStatusBadge } from '../components/data-table.js';
import { createModal } from '../components/modal.js';
import { formatDate } from '../utils/formatters.js';
import { getDaysRemaining, debounce } from '../utils/helpers.js';
import { showRealError, logFirestoreError } from '../utils/debug-error.js';
import { ROUTES } from '../utils/constants.js';

const TIPO_LABELS = {
  '7dias': '7 días antes',
  '3dias': '3 días antes',
  vencimiento: 'Hoy vence',
  vencida: 'Membresía vencida',
  manual: 'Mensaje manual',
  renovacion_especial: 'Renovación especial'
};

const FILTERS = [
  { id: 'todos', label: 'Todos' },
  { id: 'hoy', label: 'Hoy' },
  { id: '3dias', label: '3 Días' },
  { id: '7dias', label: '7 Días' },
  { id: 'vencidos', label: 'Vencidos' },
  { id: 'pendientes', label: 'Pendientes' },
  { id: 'enviados', label: 'Enviados' }
];

const state = {
  container: null,
  notificaciones: [],
  clientes: [],
  clientesMap: new Map(),
  filter: 'todos',
  search: ''
};

export async function render(container) {
  console.log('[BFC WhatsApp] Entrando a WhatsApp');
  state.container = container;
  try {
    await loadData();
    renderHub();
    console.log('[BFC WhatsApp] WhatsApp cargado');
  } catch (error) {
    showRealError(container, error, 'js/pages/whatsapp.js', 'render');
  }
}

async function loadData() {
  console.log('[BFC WhatsApp] Cargando configuración WhatsApp / colección notificaciones');
  try {
    const [notificaciones, clientes] = await Promise.all([
      getAllNotificaciones(),
      getAllClientes()
    ]);
    state.notificaciones = notificaciones;
    state.clientes = clientes;
    state.clientesMap = new Map(clientes.map(c => [c.id, c]));
  } catch (error) {
    logFirestoreError('WhatsApp', error);
    throw error;
  }
}

function startOfDay(date = new Date()) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function isSameDay(a, b) {
  return startOfDay(a).getTime() === startOfDay(b).getTime();
}

function isToday(timestamp) {
  const d = timestamp?.toDate?.();
  return d ? isSameDay(d, new Date()) : false;
}

function isEnviadoHoy(notif) {
  if (notif.estado !== 'enviado') return false;
  const fe = notif.fechaEnviado?.toDate?.();
  return fe ? isSameDay(fe, new Date()) : false;
}

/** Un cliente = un recordatorio (el más relevante para la fecha actual). */
function dedupeByClient(notifs) {
  const groups = new Map();

  for (const n of notifs) {
    const key = n.clienteId || n.clienteNombre;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(n);
  }

  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);

  return Array.from(groups.values()).map(group => {
    const due = group.filter(n => {
      const d = n.fechaProgramada?.toDate?.();
      return d && d <= todayEnd;
    });

    if (due.length) {
      return due.sort((a, b) =>
        (b.fechaProgramada?.toMillis?.() || 0) - (a.fechaProgramada?.toMillis?.() || 0)
      )[0];
    }

    return group.sort((a, b) =>
      (a.fechaProgramada?.toMillis?.() || 0) - (b.fechaProgramada?.toMillis?.() || 0)
    )[0];
  });
}

function enrichRow(notif) {
  const cliente = state.clientesMap.get(notif.clienteId) || {};
  const fechaVenc = cliente.fechaVencimiento || null;
  const dias = getDaysRemaining(fechaVenc);
  const estadoMem = cliente.estadoMembresia || 'sin_membresia';

  return {
    ...notif,
    cliente,
    fotoURL: cliente.fotoURL || '',
    telefono: cliente.telefono || notif.whatsapp || '—',
    estadoMembresia: estadoMem,
    fechaVencimiento: fechaVenc,
    diasRestantes: dias
  };
}

function applyFilters(rows) {
  let result = rows;

  if (state.search.trim()) {
    const term = state.search.trim().toLowerCase();
    result = result.filter(r =>
      (r.clienteNombre || '').toLowerCase().includes(term) ||
      (r.telefono || '').toLowerCase().includes(term)
    );
  }

  switch (state.filter) {
    case 'hoy':
      result = result.filter(r => isToday(r.fechaProgramada));
      break;
    case '3dias':
      result = result.filter(r => r.tipo === '3dias' || r.diasRestantes === 3);
      break;
    case '7dias':
      result = result.filter(r => r.tipo === '7dias' || r.diasRestantes === 7);
      break;
    case 'vencidos':
      result = result.filter(r => r.estadoMembresia === 'vencido');
      break;
    case 'pendientes':
      result = result.filter(r => r.estado === 'pendiente');
      break;
    case 'enviados':
      result = result.filter(r => r.estado === 'enviado');
      break;
    default:
      break;
  }

  return result.sort((a, b) => {
    const pa = a.estado === 'pendiente' ? 0 : 1;
    const pb = b.estado === 'pendiente' ? 0 : 1;
    if (pa !== pb) return pa - pb;
    return (a.diasRestantes ?? 999) - (b.diasRestantes ?? 999);
  });
}

function computeStats(rows) {
  const enviadosHoy = state.notificaciones.filter(isEnviadoHoy).length;
  const pendientes = rows.filter(r => r.estado === 'pendiente').length;
  const vencidos = state.clientes.filter(c => c.estadoMembresia === 'vencido').length;
  const proximos = state.clientes.filter(c =>
    ['activo', 'proximo_vencer'].includes(c.estadoMembresia) && getDaysRemaining(c.fechaVencimiento) !== null && getDaysRemaining(c.fechaVencimiento) <= 7
  ).length;

  return { enviadosHoy, pendientes, vencidos, proximos };
}

function statCard(label, value, color) {
  return `
    <div class="card stat-card">
      <div class="stat-value">${value}</div>
      <div class="stat-label">${label}</div>
      <div class="stat-icon" style="color:${color};background:${color}15;">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="6"/></svg>
      </div>
    </div>
  `;
}

function renderAvatar(row) {
  if (row.fotoURL) {
    return `<img class="wa-table-avatar" src="${row.fotoURL}" alt="">`;
  }
  const initial = (row.clienteNombre || '?').charAt(0).toUpperCase();
  return `<div class="wa-table-avatar-placeholder">${initial}</div>`;
}

function renderDiasCell(dias) {
  if (dias === null) return '—';
  if (dias < 0) return '<span style="color:var(--color-danger);font-weight:600;">Vencida</span>';
  if (dias === 0) return '<span style="color:var(--color-warning);font-weight:600;">Hoy</span>';
  if (dias <= 7) return `<span style="color:var(--color-warning);font-weight:600;">${dias} días</span>`;
  return `${dias} días`;
}

function renderTableBody(rows) {
  if (!rows.length) {
    if (state.search || state.filter !== 'todos') {
      return '<tr><td colspan="7"><div class="empty-state"><p>No se encontraron clientes con ese criterio</p></div></td></tr>';
    }
    return '';
  }

  return rows.map(row => `
    <tr>
      <td>${renderAvatar(row)}</td>
      <td>
        <div style="font-weight:600;font-size:0.875rem;">${row.clienteNombre}</div>
        <div style="font-size:0.75rem;color:var(--color-text-muted);margin-top:0.125rem;">${TIPO_LABELS[row.tipo] || ''}</div>
      </td>
      <td>${row.telefono}</td>
      <td>${renderStatusBadge(row.estadoMembresia)}</td>
      <td>${row.fechaVencimiento ? formatDate(row.fechaVencimiento) : '—'}</td>
      <td>${renderDiasCell(row.diasRestantes)}</td>
      <td>
        <div class="wa-actions">
          <button class="btn btn-success btn-sm" data-action="whatsapp" data-id="${row.id}">WhatsApp</button>
          <button class="btn btn-secondary btn-sm" data-action="ver-cliente" data-cliente-id="${row.clienteId || ''}">Ver Cliente</button>
        </div>
      </td>
    </tr>
  `).join('');
}

function renderHub() {
  const deduped = dedupeByClient(state.notificaciones).map(enrichRow);
  const rows = applyFilters(deduped);
  const stats = computeStats(deduped);
  const isEmpty = deduped.length === 0;

  state.container.innerHTML = `
    <div class="animate-fade-in">
      <div class="page-header">
        <div>
          <h2 class="page-title">Centro de Recordatorios WhatsApp</h2>
          <p class="page-subtitle">Gestione recordatorios automáticos de membresías y mensajes personalizados.</p>
        </div>
        <button class="btn btn-primary" id="wa-btn-nuevo">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
          Nuevo Mensaje
        </button>
      </div>

      <div class="wa-grid-4">
        ${statCard('📨 Mensajes Hoy', stats.enviadosHoy, 'var(--color-success)')}
        ${statCard('🟡 Pendientes', stats.pendientes, 'var(--color-warning)')}
        ${statCard('🔴 Vencidos', stats.vencidos, 'var(--color-danger)')}
        ${statCard('📅 Próximos Vencimientos', stats.proximos, 'var(--color-info)')}
      </div>

      ${isEmpty ? `
        <div class="card" style="padding:0;">
          ${renderEmptyState({
            icon: 'whatsapp',
            title: 'No hay recordatorios pendientes',
            message: 'Los recordatorios se generan al vender membresías. También puede enviar mensajes manuales.',
            actionLabel: 'Enviar mensaje manual',
            actionId: 'wa-empty-manual'
          })}
        </div>
      ` : `
        <div class="wa-search-row">
          ${renderClienteSearchBox({ inputId: 'wa-search', placeholder: 'Buscar cliente por nombre o teléfono...' })}
        </div>

        <div class="wa-filters" id="wa-filters">
          ${FILTERS.map(f => `
            <button type="button" class="wa-filter-chip ${state.filter === f.id ? 'active' : ''}" data-filter="${f.id}">${f.label}</button>
          `).join('')}
        </div>

        <div class="card" style="padding:0;">
          <div class="table-container" style="border:none;border-radius:0;">
            <table class="data-table">
              <thead>
                <tr>
                  <th style="width:52px;">Foto</th>
                  <th>Cliente</th>
                  <th>Teléfono</th>
                  <th>Estado</th>
                  <th>Vencimiento</th>
                  <th>Días restantes</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody id="wa-tbody">${renderTableBody(rows)}</tbody>
            </table>
          </div>
        </div>
      `}
    </div>
  `;

  const searchInput = document.getElementById('wa-search');
  if (searchInput) searchInput.value = state.search;

  bindEvents(deduped);
}

function refreshListOnly() {
  const deduped = dedupeByClient(state.notificaciones).map(enrichRow);
  const rows = applyFilters(deduped);
  const tbody = document.getElementById('wa-tbody');
  if (tbody) {
    tbody.innerHTML = renderTableBody(rows);
    bindTableActions(deduped);
  }
}

function bindEvents(allRows) {
  document.getElementById('wa-btn-nuevo')?.addEventListener('click', () => showNuevoMensaje());
  bindEmptyAction('wa-empty-manual', () => showNuevoMensaje());

  document.getElementById('wa-search')?.addEventListener('input', debounce((e) => {
    state.search = e.target.value;
    refreshListOnly();
  }, 200));

  document.getElementById('wa-filters')?.addEventListener('click', (e) => {
    const chip = e.target.closest('[data-filter]');
    if (!chip) return;
    state.filter = chip.dataset.filter;
    document.querySelectorAll('.wa-filter-chip').forEach(c =>
      c.classList.toggle('active', c.dataset.filter === state.filter)
    );
    refreshListOnly();
  });

  bindTableActions(allRows);
}

function bindTableActions(allRows) {
  state.container.querySelectorAll('[data-action="whatsapp"]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const row = allRows.find(r => r.id === btn.dataset.id);
      if (!row) return;
      await abrirWhatsApp(row);
    });
  });

  state.container.querySelectorAll('[data-action="ver-cliente"]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.clienteId;
      if (id) window.location.hash = `${ROUTES.CLIENTE_PERFIL}/${id}`;
    });
  });
}

async function abrirWhatsApp(row) {
  window.open(getWhatsAppUrl(row), '_blank');
  if (row.estado === 'pendiente') {
    await marcarEnviada(row.id);
    const idx = state.notificaciones.findIndex(n => n.id === row.id);
    if (idx >= 0) {
      state.notificaciones[idx] = { ...state.notificaciones[idx], estado: 'enviado' };
    }
    renderHub();
  }
}

async function showNuevoMensaje() {
  const clientes = state.clientes.filter(c => c.telefono || c.whatsapp);
  const config = await getConfig();
  let selectedCliente = null;
  let selectedTemplate = 'personalizado';

  const templateButtons = [
    { id: '7dias', label: '7 días antes' },
    { id: '3dias', label: '3 días antes' },
    { id: 'vencimiento', label: 'Hoy vence' },
    { id: 'vencida', label: 'Vencida' },
    { id: 'renovacion_especial', label: 'Renovación especial' },
    { id: 'personalizado', label: 'Mensaje personalizado' }
  ];

  const { close } = createModal({
    title: 'Nuevo Mensaje',
    size: 'modal-lg',
    content: `
      <form id="form-wa-nuevo">
        <div class="form-group">
          <label class="form-label required">Buscar cliente</label>
          ${renderClienteSearchBox({ inputId: 'wa-modal-search', placeholder: 'Nombre o teléfono...' })}
          <div class="cliente-search-results" id="wa-modal-results"></div>
          <p id="wa-modal-selected" style="font-size:0.8125rem;color:var(--color-text-secondary);margin-top:0.5rem;">Cliente: ninguno seleccionado</p>
        </div>
        <div class="form-group">
          <label class="form-label">Plantilla de mensaje</label>
          <div class="wa-template-grid" id="wa-templates">
            ${templateButtons.map(t => `
              <button type="button" class="wa-template-btn ${t.id === 'personalizado' ? 'active' : ''}" data-template="${t.id}">${t.label}</button>
            `).join('')}
          </div>
        </div>
        <div class="form-group">
          <label class="form-label required">Mensaje</label>
          <textarea class="form-textarea" id="wa-mensaje" name="mensaje" rows="6" required placeholder="Escriba su mensaje..."></textarea>
        </div>
      </form>
    `,
    footer: `
      <button class="btn btn-secondary" id="wa-modal-cancel">Cancelar</button>
      <button class="btn btn-success" id="wa-modal-send" type="button">Abrir WhatsApp</button>
    `
  });

  bindClienteSearch({
    input: document.getElementById('wa-modal-search'),
    resultsEl: document.getElementById('wa-modal-results'),
    allClientes: clientes,
    onSelect: (c) => {
      selectedCliente = c;
      document.getElementById('wa-modal-selected').textContent = `Cliente: ${c.nombreCompleto} — ${c.telefono || ''}`;
      applyTemplate();
    }
  });

  function applyTemplate() {
    const textarea = document.getElementById('wa-mensaje');
    if (!textarea || selectedTemplate === 'personalizado' || !selectedCliente) return;
    const fechaVenc = selectedCliente.fechaVencimiento?.toDate?.() || new Date();
    textarea.value = generateMessagePreview(selectedTemplate, selectedCliente, config, fechaVenc);
  }

  document.getElementById('wa-templates')?.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-template]');
    if (!btn) return;
    selectedTemplate = btn.dataset.template;
    document.querySelectorAll('.wa-template-btn').forEach(b => b.classList.toggle('active', b.dataset.template === selectedTemplate));
    if (selectedTemplate === 'personalizado') {
      document.getElementById('wa-mensaje').value = '';
    } else {
      applyTemplate();
    }
  });

  document.getElementById('wa-modal-cancel')?.addEventListener('click', close);
  document.getElementById('wa-modal-send')?.addEventListener('click', async () => {
    const mensaje = document.getElementById('wa-mensaje')?.value?.trim();
    if (!selectedCliente || !mensaje) {
      Swal.fire({ icon: 'warning', title: 'Seleccione un cliente y escriba el mensaje', background: '#1a1a1a', color: '#fff' });
      return;
    }

    const phone = selectedCliente.whatsapp || selectedCliente.telefono;
    const result = await enviarManual({ ...selectedCliente, whatsapp: phone }, mensaje);
    window.open(result.whatsappUrl, '_blank');
    close();
    await loadData();
    renderHub();
    Swal.fire({ icon: 'success', title: 'Mensaje enviado', timer: 1200, showConfirmButton: false, background: '#1a1a1a', color: '#fff' });
  });
}
