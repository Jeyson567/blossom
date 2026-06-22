import {
  getCajaAbierta, abrirCaja, cerrarCaja, registrarMovimientoCaja,
  calcularTotalesCaja, getHistorialCajas
} from '../services/caja.service.js';
import { getCurrentUserData, getUserRole } from '../auth.js';
import { canDelete } from '../utils/permissions.js';
import { formatCurrency, formatDate, formatDateTime } from '../utils/formatters.js';
import { createModal } from '../components/modal.js';
import { renderDataTable, renderPagination } from '../components/data-table.js';
import { renderEmptyState, bindEmptyAction } from '../components/empty-state.js';
import { PAYMENT_METHOD_LABELS, ITEMS_PER_PAGE } from '../utils/constants.js';

let currentPage = 1;

export async function render(container) {
  try {
    const cajaAbierta = await getCajaAbierta();
    if (cajaAbierta) {
      await renderCajaAbierta(container, cajaAbierta);
    } else {
      await renderSinCaja(container);
    }
  } catch (error) {
    console.error('[BFC Caja]', error);
    if (error.code === 'permission-denied') throw error;
    await renderSinCaja(container);
  }
}

async function renderSinCaja(container) {
  let historial = { data: [], total: 0, page: 1, perPage: ITEMS_PER_PAGE };
  try {
    historial = await getHistorialCajas({ page: currentPage, perPage: ITEMS_PER_PAGE });
  } catch (e) {
    console.warn('[BFC Caja] Historial no disponible:', e.message);
  }

  container.innerHTML = `
    <div class="animate-fade-in">
      <div class="page-header">
        <div>
          <h2 class="page-title">Caja Diaria</h2>
          <p class="page-subtitle">No hay caja abierta</p>
        </div>
        <button class="btn btn-primary" id="btn-abrir-caja">Abrir Caja</button>
      </div>

      <div class="card" style="margin-bottom:1.5rem;">
        ${renderEmptyState({
          icon: 'cash',
          title: 'No hay caja abierta',
          message: 'Abra la caja del día con el monto inicial en efectivo para registrar movimientos.',
          actionLabel: 'Abrir Caja',
          actionId: 'empty-abrir-caja'
        })}
      </div>

      <h3 style="margin-bottom:1rem;font-size:1rem;">Historial de Cajas</h3>
      <div class="card" style="padding:0;" id="historial-table"></div>
      <div id="pagination-container"></div>
    </div>
  `;

  renderHistorial(historial);
  document.getElementById('btn-abrir-caja')?.addEventListener('click', () => showAbrirCaja(container));
  bindEmptyAction('empty-abrir-caja', () => showAbrirCaja(container));
}

async function renderCajaAbierta(container, caja) {
  const totales = await calcularTotalesCaja(caja);

  container.innerHTML = `
    <div class="animate-fade-in">
      <div class="page-header">
        <div>
          <h2 class="page-title">Caja Diaria</h2>
          <p class="page-subtitle">Abierta por ${caja.usuarioNombre} — ${formatDate(caja.fecha)}</p>
        </div>
        <div style="display:flex;gap:0.5rem;">
          <button class="btn btn-secondary" id="btn-movimiento">Registrar Movimiento</button>
          <button class="btn btn-danger" id="btn-cerrar-caja">Cerrar Caja</button>
        </div>
      </div>

      <div class="grid-stats" style="margin-bottom:1.5rem;">
        <div class="card stat-card"><div class="stat-value">${formatCurrency(totales.efectivo)}</div><div class="stat-label">Efectivo</div></div>
        <div class="card stat-card"><div class="stat-value">${formatCurrency(totales.transferencia)}</div><div class="stat-label">Transferencias</div></div>
        <div class="card stat-card"><div class="stat-value">${formatCurrency(totales.tarjeta)}</div><div class="stat-label">Tarjetas</div></div>
        <div class="card stat-card"><div class="stat-value">${formatCurrency(totales.total)}</div><div class="stat-label">Total en Caja</div></div>
      </div>

      <div class="grid-2">
        <div class="card">
          <h3 style="margin-bottom:1rem;font-size:1rem;">Resumen</h3>
          <div style="font-size:0.875rem;display:grid;gap:0.5rem;">
            <div style="display:flex;justify-content:space-between;"><span>Monto inicial:</span><span>${formatCurrency(caja.montoInicial)}</span></div>
            <div style="display:flex;justify-content:space-between;"><span>Ingresos:</span><span style="color:var(--color-success);">+${formatCurrency(totales.ingresos)}</span></div>
            <div style="display:flex;justify-content:space-between;"><span>Egresos:</span><span style="color:var(--color-danger);">-${formatCurrency(totales.egresos)}</span></div>
            <div style="display:flex;justify-content:space-between;font-weight:700;border-top:1px solid var(--color-border);padding-top:0.5rem;"><span>Total:</span><span style="color:var(--color-gold);">${formatCurrency(totales.total)}</span></div>
          </div>
        </div>
        <div class="card">
          <h3 style="margin-bottom:1rem;font-size:1rem;">Movimientos (${caja.movimientos?.length || 0})</h3>
          <div style="max-height:300px;overflow-y:auto;">
            ${caja.movimientos?.length ? caja.movimientos.map(m => `
              <div class="activity-item">
                <div class="activity-dot ${m.tipo === 'ingreso' ? 'green' : 'red'}"></div>
                <div style="flex:1;">
                  <div style="font-size:0.875rem;">${m.concepto}</div>
                  <div style="font-size:0.75rem;color:var(--color-text-muted);">${formatDateTime(m.fecha)} · ${PAYMENT_METHOD_LABELS[m.metodoPago] || m.metodoPago}</div>
                </div>
                <div style="font-weight:600;color:${m.tipo === 'ingreso' ? 'var(--color-success)' : 'var(--color-danger)'};">
                  ${m.tipo === 'ingreso' ? '+' : '-'}${formatCurrency(m.monto)}
                </div>
              </div>
            `).join('') : '<div class="empty-state"><p>Sin movimientos</p></div>'}
          </div>
        </div>
      </div>
    </div>
  `;

  document.getElementById('btn-movimiento')?.addEventListener('click', () => showMovimientoForm(container, caja));
  document.getElementById('btn-cerrar-caja')?.addEventListener('click', () => showCerrarCaja(container, caja, totales));
}

function showAbrirCaja(container) {
  const { close } = createModal({
    title: 'Abrir Caja',
    content: `
      <form id="form-abrir-caja">
        <div class="form-group">
          <label class="form-label required">Monto inicial (Q)</label>
          <input type="number" step="0.01" class="form-input" name="montoInicial" value="0" required>
        </div>
      </form>
    `,
    footer: `<button class="btn btn-secondary" id="btn-cancel-abrir">Cancelar</button><button class="btn btn-primary" id="btn-confirm-abrir">Abrir Caja</button>`
  });

  document.getElementById('btn-cancel-abrir')?.addEventListener('click', close);
  document.getElementById('btn-confirm-abrir')?.addEventListener('click', async () => {
    const montoInicial = document.querySelector('[name="montoInicial"]').value;
    const user = getCurrentUserData();
    await abrirCaja({ montoInicial, usuario: { uid: user.id, nombre: user.nombre } });
    close();
    Swal.fire({ icon: 'success', title: 'Caja abierta', timer: 1500, showConfirmButton: false, background: '#1a1a1a', color: '#fff' });
    render(container);
  });
}

function showMovimientoForm(container, caja) {
  const metodoOptions = Object.entries(PAYMENT_METHOD_LABELS).map(([k, v]) => `<option value="${k}">${v}</option>`).join('');

  const { close } = createModal({
    title: 'Registrar Movimiento',
    content: `
      <form id="form-movimiento">
        <div class="form-group"><label class="form-label required">Tipo</label><select class="form-select" name="tipo"><option value="ingreso">Ingreso</option><option value="egreso">Egreso</option></select></div>
        <div class="form-group"><label class="form-label required">Concepto</label><input class="form-input" name="concepto" required></div>
        <div class="form-grid">
          <div class="form-group"><label class="form-label required">Monto (Q)</label><input type="number" step="0.01" class="form-input" name="monto" required></div>
          <div class="form-group"><label class="form-label">Método</label><select class="form-select" name="metodoPago">${metodoOptions}</select></div>
        </div>
      </form>
    `,
    footer: `<button class="btn btn-secondary" id="btn-cancel-mov">Cancelar</button><button class="btn btn-primary" id="btn-save-mov">Registrar</button>`
  });

  document.getElementById('btn-cancel-mov')?.addEventListener('click', close);
  document.getElementById('btn-save-mov')?.addEventListener('click', async () => {
    const form = document.getElementById('form-movimiento');
    const data = Object.fromEntries(new FormData(form));
    const user = getCurrentUserData();

    await registrarMovimientoCaja(caja.id, {
      ...data,
      usuario: { uid: user.id, nombre: user.nombre }
    });

    close();
    render(container);
  });
}

async function showCerrarCaja(container, caja, totales) {
  const { close } = createModal({
    title: 'Cerrar Caja',
    size: 'modal-lg',
    content: `
      <div style="font-size:0.875rem;display:grid;gap:0.75rem;">
        <div style="display:flex;justify-content:space-between;"><span>Efectivo:</span><strong>${formatCurrency(totales.efectivo)}</strong></div>
        <div style="display:flex;justify-content:space-between;"><span>Transferencias:</span><strong>${formatCurrency(totales.transferencia)}</strong></div>
        <div style="display:flex;justify-content:space-between;"><span>Tarjetas:</span><strong>${formatCurrency(totales.tarjeta)}</strong></div>
        <div style="display:flex;justify-content:space-between;"><span>QR:</span><strong>${formatCurrency(totales.qr)}</strong></div>
        <div style="display:flex;justify-content:space-between;border-top:1px solid var(--color-border);padding-top:0.75rem;font-size:1rem;"><span>Total:</span><strong style="color:var(--color-gold);">${formatCurrency(totales.total)}</strong></div>
        <div class="form-group" style="margin-top:1rem;">
          <label class="form-label">Efectivo contado (Q)</label>
          <input type="number" step="0.01" class="form-input" id="efectivo-contado" value="${totales.efectivo}">
        </div>
        <div id="diferencia" style="text-align:center;padding:0.5rem;border-radius:var(--radius-sm);"></div>
      </div>
    `,
    footer: `<button class="btn btn-secondary" id="btn-cancel-cerrar">Cancelar</button><button class="btn btn-danger" id="btn-confirm-cerrar">Cerrar Caja</button>`
  });

  const updateDiferencia = () => {
    const contado = Number(document.getElementById('efectivo-contado').value) || 0;
    const diff = contado - totales.efectivo;
    const el = document.getElementById('diferencia');
    if (diff === 0) {
      el.innerHTML = '<span class="badge badge-success">Cuadre exacto</span>';
    } else {
      el.innerHTML = `<span class="badge ${diff > 0 ? 'badge-warning' : 'badge-danger'}">Diferencia: ${formatCurrency(diff)}</span>`;
    }
  };

  document.getElementById('efectivo-contado')?.addEventListener('input', updateDiferencia);
  updateDiferencia();

  document.getElementById('btn-cancel-cerrar')?.addEventListener('click', close);
  document.getElementById('btn-confirm-cerrar')?.addEventListener('click', async () => {
    const efectivoContado = Number(document.getElementById('efectivo-contado').value) || 0;
    await cerrarCaja(caja.id, {
      ...totales,
      efectivoContado,
      diferencia: efectivoContado - totales.efectivo
    });
    close();
    Swal.fire({ icon: 'success', title: 'Caja cerrada', timer: 1500, showConfirmButton: false, background: '#1a1a1a', color: '#fff' });
    render(container);
  });
}

function renderHistorial(historial) {
  const table = document.getElementById('historial-table');
  if (!table) return;

  table.innerHTML = renderDataTable({
    columns: [
      { key: 'fecha', label: 'Fecha', format: 'date' },
      { key: 'usuarioNombre', label: 'Usuario' },
      { key: 'montoInicial', label: 'Monto Inicial', format: 'currency' },
      { key: 'estado', label: 'Estado', render: v => `<span class="badge ${v === 'abierta' ? 'badge-success' : 'badge-neutral'}">${v === 'abierta' ? 'Abierta' : 'Cerrada'}</span>` },
      { key: 'cierre', label: 'Total Cierre', render: v => v ? formatCurrency(v.total) : '—' }
    ],
    data: historial.data,
    emptyMessage: 'Sin historial de cajas'
  });
}
