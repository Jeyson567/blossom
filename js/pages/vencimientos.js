import { getAllClientes, refreshMembershipStatuses } from '../services/clientes.service.js';
import { getAllMembresias } from '../services/membresias.service.js';
import { getConfig } from '../services/config.service.js';
import { renderStatusBadge } from '../components/data-table.js';
import { renderClienteSearchBox } from '../components/cliente-search.js';
import { exportToPDF } from '../reports/pdf-export.js';
import { exportToExcel } from '../reports/excel-export.js';
import { formatDate, formatMembershipStatus } from '../utils/formatters.js';
import { getDaysRemaining, debounce } from '../utils/helpers.js';
import { ROUTES } from '../utils/constants.js';
import { navigateTo } from '../router.js';
import { showRealError } from '../utils/debug-error.js';

const VENTA_PRESELECT_KEY = 'bfc-venta-cliente-id';

const QUICK_FILTERS = [
  { id: 'hoy', label: 'Hoy' },
  { id: 'manana', label: 'Mañana' },
  { id: '7dias', label: 'Próximos 7 días' },
  { id: '15dias', label: 'Próximos 15 días' },
  { id: '30dias', label: 'Próximos 30 días' },
  { id: 'vencidas', label: 'Vencidas' },
  { id: 'todas', label: 'Todas' }
];

const EXPORT_COLUMNS = [
  { key: 'cliente', label: 'Cliente' },
  { key: 'telefono', label: 'Teléfono' },
  { key: 'plan', label: 'Plan' },
  { key: 'fechaInicio', label: 'Inicio' },
  { key: 'fechaVencimiento', label: 'Vencimiento' },
  { key: 'diasRestantes', label: 'Días' },
  { key: 'estado', label: 'Estado' }
];

const state = {
  container: null,
  rows: [],
  filtered: [],
  quickFilter: 'todas',
  search: '',
  fechaDesde: '',
  fechaHasta: '',
  dateRangeActive: false
};

export async function render(container) {
  state.container = container;
  try {
    await refreshMembershipStatuses();
    await loadData();
    renderPage();
  } catch (error) {
    showRealError(container, error, 'js/pages/vencimientos.js', 'render');
  }
}

async function loadData() {
  const [clientes, membresias] = await Promise.all([
    getAllClientes(),
    getAllMembresias()
  ]);

  const membresiaMap = new Map();
  membresias.forEach(m => {
    if (m.estado === 'activa') membresiaMap.set(m.clienteId, m);
  });

  state.rows = clientes
    .filter(c => c.fechaVencimiento || c.estadoMembresia !== 'sin_membresia')
    .map(c => {
      const membresia = membresiaMap.get(c.id) ||
        (c.membresiaActivaId ? membresias.find(m => m.id === c.membresiaActivaId) : null);
      const dias = getDaysRemaining(c.fechaVencimiento);
      return {
        id: c.id,
        nombreCompleto: c.nombreCompleto,
        telefono: c.telefono || '—',
        planNombre: membresia?.planNombre || '—',
        fechaInicio: membresia?.fechaInicio || null,
        fechaVencimiento: c.fechaVencimiento,
        diasRestantes: dias,
        estadoMembresia: c.estadoMembresia || 'sin_membresia'
      };
    });

  applyFilters();
}

function toDateOnly(ts) {
  if (!ts) return null;
  const d = ts.toDate?.() || new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d;
}

function applyFilters() {
  let result = [...state.rows];

  if (state.search.trim()) {
    const term = state.search.trim().toLowerCase();
    result = result.filter(r =>
      r.nombreCompleto.toLowerCase().includes(term) ||
      (r.telefono || '').toLowerCase().includes(term)
    );
  }

  if (state.dateRangeActive && state.fechaDesde && state.fechaHasta) {
    const desde = new Date(state.fechaDesde);
    const hasta = new Date(state.fechaHasta);
    desde.setHours(0, 0, 0, 0);
    hasta.setHours(23, 59, 59, 999);
    result = result.filter(r => {
      const v = toDateOnly(r.fechaVencimiento);
      return v && v >= desde && v <= hasta;
    });
  } else {
    switch (state.quickFilter) {
      case 'hoy':
        result = result.filter(r => r.diasRestantes === 0);
        break;
      case 'manana':
        result = result.filter(r => r.diasRestantes === 1);
        break;
      case '7dias':
        result = result.filter(r => r.diasRestantes !== null && r.diasRestantes >= 0 && r.diasRestantes <= 7);
        break;
      case '15dias':
        result = result.filter(r => r.diasRestantes !== null && r.diasRestantes >= 0 && r.diasRestantes <= 15);
        break;
      case '30dias':
        result = result.filter(r => r.diasRestantes !== null && r.diasRestantes >= 0 && r.diasRestantes <= 30);
        break;
      case 'vencidas':
        result = result.filter(r => r.diasRestantes !== null && r.diasRestantes < 0);
        break;
      default:
        break;
    }
  }

  result.sort((a, b) => {
    const pa = sortPriority(a.diasRestantes);
    const pb = sortPriority(b.diasRestantes);
    if (pa !== pb) return pa - pb;
    return (a.diasRestantes ?? 999) - (b.diasRestantes ?? 999);
  });

  state.filtered = result;
}

function sortPriority(dias) {
  if (dias === null) return 4;
  if (dias < 0) return 0;
  if (dias === 0) return 1;
  if (dias <= 7) return 2;
  return 3;
}

function computeStats() {
  const activos = state.rows.filter(r => r.estadoMembresia === 'activo').length;
  const vencenSemana = state.rows.filter(r =>
    r.diasRestantes !== null && r.diasRestantes >= 0 && r.diasRestantes <= 7
  ).length;
  const vencidos = state.rows.filter(r => r.estadoMembresia === 'vencido' || (r.diasRestantes !== null && r.diasRestantes < 0)).length;
  const vencenHoy = state.rows.filter(r => r.diasRestantes === 0).length;
  return { activos, vencenSemana, vencidos, vencenHoy };
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

function renderDiasAlert(dias) {
  if (dias === null) return '—';
  if (dias < 0) return '<span class="ven-dias ven-dias--expired">Vencida</span>';
  if (dias === 0) return '<span class="ven-dias ven-dias--today">Hoy</span>';
  if (dias <= 3) return `<span class="ven-dias ven-dias--urgent">${dias} días</span>`;
  if (dias <= 7) return `<span class="ven-dias ven-dias--soon">${dias} días</span>`;
  return `${dias} días`;
}

function rowClass(dias) {
  if (dias !== null && dias < 0) return 'ven-row--alert';
  if (dias !== null && dias <= 3) return 'ven-row--warn';
  return '';
}

function renderTableBody() {
  if (!state.filtered.length) {
    return '<tr><td colspan="8"><div class="empty-state"><p>No hay membresías con ese criterio</p></div></td></tr>';
  }

  return state.filtered.map(row => `
    <tr class="${rowClass(row.diasRestantes)}">
      <td><strong style="font-size:0.875rem;">${row.nombreCompleto}</strong></td>
      <td>${row.telefono}</td>
      <td>${row.planNombre}</td>
      <td>${row.fechaInicio ? formatDate(row.fechaInicio) : '—'}</td>
      <td>${row.fechaVencimiento ? formatDate(row.fechaVencimiento) : '—'}</td>
      <td>${renderDiasAlert(row.diasRestantes)}</td>
      <td>${renderStatusBadge(row.estadoMembresia)}</td>
      <td>
        <div class="wa-actions" style="display:flex;gap:0.375rem;flex-wrap:wrap;">
          <button class="btn btn-success btn-sm" data-action="renovar" data-id="${row.id}">Renovar Membresía</button>
          <button class="btn btn-secondary btn-sm" data-action="ver-cliente" data-id="${row.id}">Ver Cliente</button>
        </div>
      </td>
    </tr>
  `).join('');
}

function renderPage() {
  const stats = computeStats();

  state.container.innerHTML = `
    <div class="animate-fade-in">
      <div class="page-header">
        <div>
          <h2 class="page-title">Control de Vencimientos</h2>
          <p class="page-subtitle">Vea quién vence hoy, esta semana o en un rango de fechas</p>
        </div>
      </div>

      <div class="ven-grid-4">
        ${statCard('🟢 Activos', stats.activos, 'var(--color-success)')}
        ${statCard('🟡 Vencen esta semana', stats.vencenSemana, 'var(--color-warning)')}
        ${statCard('🔴 Vencidos', stats.vencidos, 'var(--color-danger)')}
        ${statCard('📅 Vencen hoy', stats.vencenHoy, 'var(--color-info)')}
      </div>

      <div class="ven-date-bar">
        <div class="form-group">
          <label class="form-label">Del</label>
          <input type="date" class="form-input" id="ven-fecha-desde" value="${state.fechaDesde}">
        </div>
        <div class="form-group">
          <label class="form-label">Al</label>
          <input type="date" class="form-input" id="ven-fecha-hasta" value="${state.fechaHasta}">
        </div>
        <button class="btn btn-primary" id="ven-btn-buscar">Buscar</button>
        <button class="btn btn-secondary" id="ven-btn-limpiar">Limpiar fechas</button>
      </div>

      <div class="ven-toolbar">
        ${renderClienteSearchBox({ inputId: 'ven-search', placeholder: 'Buscar cliente por nombre o teléfono...' })}
        <div class="ven-export-btns">
          <button class="btn btn-secondary btn-sm" id="ven-export-pdf">📄 PDF</button>
          <button class="btn btn-secondary btn-sm" id="ven-export-excel">📊 Excel</button>
        </div>
      </div>

      <div class="ven-filters" id="ven-filters">
        ${QUICK_FILTERS.map(f => `
          <button type="button" class="ven-filter-chip ${state.quickFilter === f.id && !state.dateRangeActive ? 'active' : ''}" data-filter="${f.id}">${f.label}</button>
        `).join('')}
      </div>

      <div class="card" style="padding:0;">
        <div class="table-container" style="border:none;border-radius:0;">
          <table class="data-table">
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Teléfono</th>
                <th>Plan</th>
                <th>Fecha Inicio</th>
                <th>Fecha Vencimiento</th>
                <th>Días Restantes</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody id="ven-tbody">${renderTableBody()}</tbody>
          </table>
        </div>
      </div>
    </div>
  `;

  const searchInput = document.getElementById('ven-search');
  if (searchInput) searchInput.value = state.search;

  bindEvents();
}

function refreshTable() {
  const tbody = document.getElementById('ven-tbody');
  if (tbody) tbody.innerHTML = renderTableBody();
  bindRowActions();
}

function bindEvents() {
  document.getElementById('ven-search')?.addEventListener('input', debounce((e) => {
    state.search = e.target.value;
    applyFilters();
    refreshTable();
  }, 200));

  document.getElementById('ven-filters')?.addEventListener('click', (e) => {
    const chip = e.target.closest('[data-filter]');
    if (!chip) return;
    state.quickFilter = chip.dataset.filter;
    state.dateRangeActive = false;
    document.querySelectorAll('.ven-filter-chip').forEach(c =>
      c.classList.toggle('active', c.dataset.filter === state.quickFilter)
    );
    applyFilters();
    refreshTable();
  });

  document.getElementById('ven-btn-buscar')?.addEventListener('click', () => {
    state.fechaDesde = document.getElementById('ven-fecha-desde')?.value || '';
    state.fechaHasta = document.getElementById('ven-fecha-hasta')?.value || '';
    if (!state.fechaDesde || !state.fechaHasta) {
      Swal.fire({ icon: 'warning', title: 'Seleccione fecha inicio y fin', background: '#1a1a1a', color: '#fff' });
      return;
    }
    state.dateRangeActive = true;
    document.querySelectorAll('.ven-filter-chip').forEach(c => c.classList.remove('active'));
    applyFilters();
    refreshTable();
  });

  document.getElementById('ven-btn-limpiar')?.addEventListener('click', () => {
    state.fechaDesde = '';
    state.fechaHasta = '';
    state.dateRangeActive = false;
    const desde = document.getElementById('ven-fecha-desde');
    const hasta = document.getElementById('ven-fecha-hasta');
    if (desde) desde.value = '';
    if (hasta) hasta.value = '';
    document.querySelectorAll('.ven-filter-chip').forEach(c =>
      c.classList.toggle('active', c.dataset.filter === state.quickFilter)
    );
    applyFilters();
    refreshTable();
  });

  document.getElementById('ven-export-pdf')?.addEventListener('click', async () => {
    const config = await getConfig();
    exportToPDF({
      title: 'Control de Vencimientos',
      columns: EXPORT_COLUMNS,
      data: getExportData(),
      filename: 'vencimientos',
      gymName: config.nombreGimnasio
    });
  });

  document.getElementById('ven-export-excel')?.addEventListener('click', () => {
    exportToExcel({
      columns: EXPORT_COLUMNS,
      data: getExportData(),
      filename: 'vencimientos',
      sheetName: 'Vencimientos'
    });
  });

  bindRowActions();
}

function bindRowActions() {
  state.container.querySelectorAll('[data-action="renovar"]').forEach(btn => {
    btn.addEventListener('click', () => {
      sessionStorage.setItem(VENTA_PRESELECT_KEY, btn.dataset.id);
      navigateTo(ROUTES.VENTA);
    });
  });

  state.container.querySelectorAll('[data-action="ver-cliente"]').forEach(btn => {
    btn.addEventListener('click', () => {
      window.location.hash = `${ROUTES.CLIENTE_PERFIL}/${btn.dataset.id}`;
    });
  });
}

function getExportData() {
  return state.filtered.map(r => ({
    cliente: r.nombreCompleto,
    telefono: r.telefono,
    plan: r.planNombre,
    fechaInicio: r.fechaInicio ? formatDate(r.fechaInicio) : '—',
    fechaVencimiento: r.fechaVencimiento ? formatDate(r.fechaVencimiento) : '—',
    diasRestantes: r.diasRestantes ?? '—',
    estado: formatMembershipStatus(r.estadoMembresia)
  }));
}
