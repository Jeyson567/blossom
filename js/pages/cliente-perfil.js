import { getClienteById } from '../services/clientes.service.js';
import { getMembresiasByCliente } from '../services/membresias.service.js';
import { getPagosByCliente } from '../services/pagos.service.js';
import { getAccesosByCliente } from '../services/accesos.service.js';
import { renderStatusBadge } from '../components/data-table.js';
import { createModal } from '../components/modal.js';
import { formatCurrency, formatDate, formatDateTime, formatGenero } from '../utils/formatters.js';
import { getDaysRemaining } from '../utils/helpers.js';
import { navigateTo } from '../router.js';
import { ROUTES } from '../utils/constants.js';

async function loadHistorialCliente(clienteId) {
  let membresias = [];
  let pagos = [];
  let accesos = [];
  let membresiasUnavailable = false;
  let pagosUnavailable = false;
  let accesosUnavailable = false;

  try {
    membresias = await getMembresiasByCliente(clienteId);
  } catch (error) {
    console.error(error);
    console.error(error?.code);
    console.error(error?.message);
    membresias = [];
    membresiasUnavailable = true;
  }

  try {
    pagos = await getPagosByCliente(clienteId);
  } catch (error) {
    console.error(error);
    console.error(error?.code);
    console.error(error?.message);
    pagos = [];
    pagosUnavailable = true;
  }

  try {
    accesos = await getAccesosByCliente(clienteId);
  } catch (error) {
    console.error(error);
    console.error(error?.code);
    console.error(error?.message);
    accesos = [];
    accesosUnavailable = true;
  }

  return { membresias, pagos, accesos, membresiasUnavailable, pagosUnavailable, accesosUnavailable };
}

export async function render(container, clienteId) {
  if (!clienteId) {
    navigateTo(ROUTES.CLIENTES);
    return;
  }

  const cliente = await getClienteById(clienteId);
  if (!cliente) {
    container.innerHTML = '<div class="empty-state"><p>Cliente no encontrado</p></div>';
    return;
  }

  const historial = await loadHistorialCliente(clienteId);
  const { membresias, pagos, accesos } = historial;

  const diasRestantes = getDaysRemaining(cliente.fechaVencimiento);
  const membresiaActiva = membresias.find(m => m.estado === 'activa');

  container.innerHTML = `
    <div class="animate-fade-in">
      <div class="page-header">
        <div style="display:flex;align-items:center;gap:1rem;">
          <button class="btn btn-secondary btn-sm" id="btn-back">← Volver</button>
          <div>
            <h2 class="page-title">${cliente.nombreCompleto}</h2>
            <p class="page-subtitle">QR: ${cliente.qrCode || '—'}</p>
          </div>
        </div>
        <button class="btn btn-secondary btn-sm" id="btn-qr">Ver QR</button>
      </div>

      <div class="grid-2" style="margin-bottom:1.5rem;">
        <div class="card" style="display:flex;gap:1.5rem;align-items:flex-start;">
          ${cliente.fotoURL
            ? `<img src="${cliente.fotoURL}" class="avatar avatar-xl" alt="${cliente.nombreCompleto}">`
            : `<div class="avatar avatar-xl avatar-placeholder" style="width:120px;height:120px;font-size:2rem;">${cliente.nombreCompleto.charAt(0)}</div>`
          }
          <div style="flex:1;">
            <h3 style="margin-bottom:0.75rem;">Información Personal</h3>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.5rem;font-size:0.875rem;">
              <div><span style="color:var(--color-text-secondary);">Nombre:</span> ${cliente.nombreCompleto}</div>
              <div><span style="color:var(--color-text-secondary);">Teléfono:</span> ${cliente.telefono || '—'}</div>
              <div><span style="color:var(--color-text-secondary);">Sexo:</span> ${formatGenero(cliente.genero) || '—'}</div>
              <div><span style="color:var(--color-text-secondary);">Contacto emergencia:</span> ${cliente.contactoEmergencia || '—'}</div>
              <div><span style="color:var(--color-text-secondary);">Tel. emergencia:</span> ${cliente.telefonoEmergencia || '—'}</div>
              <div style="grid-column:1/-1;"><span style="color:var(--color-text-secondary);">Observaciones:</span> ${cliente.observaciones || '—'}</div>
            </div>
          </div>
        </div>

        <div class="card card-gold">
          <h3 style="margin-bottom:0.75rem;">Información Membresía</h3>
          <div style="display:flex;align-items:center;gap:1rem;margin-bottom:1rem;">
            ${renderStatusBadge(cliente.estadoMembresia)}
            ${diasRestantes !== null
              ? `<span style="font-size:0.875rem;color:var(--color-text-secondary);">${diasRestantes >= 0 ? diasRestantes + ' días restantes' : 'Vencida hace ' + Math.abs(diasRestantes) + ' días'}</span>`
              : '<span style="font-size:0.875rem;color:var(--color-text-secondary);">—</span>'}
          </div>
          <div style="font-size:0.875rem;display:grid;gap:0.35rem;">
            <div><span style="color:var(--color-text-secondary);">Plan actual:</span> ${membresiaActiva?.planNombre || 'Sin plan activo'}</div>
            <div><span style="color:var(--color-text-secondary);">Fecha inicio:</span> ${membresiaActiva ? formatDate(membresiaActiva.fechaInicio) : '—'}</div>
            <div><span style="color:var(--color-text-secondary);">Fecha vencimiento:</span> ${cliente.fechaVencimiento ? formatDate(cliente.fechaVencimiento) : '—'}</div>
            <div><span style="color:var(--color-text-secondary);">Días restantes:</span> ${diasRestantes !== null ? (diasRestantes >= 0 ? diasRestantes : 'Vencida') : '—'}</div>
          </div>
        </div>
      </div>

      <h3 style="margin-bottom:0.75rem;">Historial</h3>
      <div class="tabs" id="profile-tabs">
        <button class="tab active" data-tab="membresias">Membresías (${historial.membresiasUnavailable ? '—' : membresias.length})</button>
        <button class="tab" data-tab="pagos">Pagos (${historial.pagosUnavailable ? '—' : pagos.length})</button>
        <button class="tab" data-tab="accesos">Accesos (${historial.accesosUnavailable ? '—' : accesos.length})</button>
      </div>
      <div class="card" id="tab-content"></div>
    </div>
  `;

  renderTab('membresias', historial);
  bindEvents(container, cliente, clienteId);
}

function renderTab(tab, data) {
  const content = document.getElementById('tab-content');
  if (!content) return;

  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));

  if (tab === 'membresias') {
    if (data.membresiasUnavailable) {
      content.innerHTML = '<div class="empty-state"><p>Historial de membresías no disponible</p></div>';
    } else if (data.membresias.length) {
      content.innerHTML = data.membresias.map(m => `
        <div class="activity-item">
          <div class="activity-dot green"></div>
          <div style="flex:1;">
            <div>${m.planNombre} — ${formatCurrency(m.precio)}</div>
            <div style="font-size:0.75rem;color:var(--color-text-muted);">${formatDate(m.fechaInicio)} → ${formatDate(m.fechaVencimiento)} · ${renderStatusBadge(m.estado)}</div>
          </div>
        </div>
      `).join('');
    } else {
      content.innerHTML = '<div class="empty-state"><p>Sin membresías registradas</p></div>';
    }
  } else if (tab === 'pagos') {
    if (data.pagosUnavailable) {
      content.innerHTML = '<div class="empty-state"><p>Historial de pagos no disponible</p></div>';
    } else if (data.pagos.length) {
      content.innerHTML = data.pagos.map(p => `
        <div class="activity-item">
          <div class="activity-dot gold"></div>
          <div style="flex:1;">
            <div>${p.concepto} — ${formatCurrency(p.monto)}</div>
            <div style="font-size:0.75rem;color:var(--color-text-muted);">${formatDateTime(p.fecha)} · ${p.metodoPago}</div>
          </div>
        </div>
      `).join('');
    } else {
      content.innerHTML = '<div class="empty-state"><p>Sin pagos registrados</p></div>';
    }
  } else if (tab === 'accesos') {
    if (data.accesosUnavailable) {
      content.innerHTML = '<div class="empty-state"><p>Historial de accesos no disponible</p></div>';
    } else if (data.accesos.length) {
      content.innerHTML = data.accesos.slice(0, 50).map(a => `
        <div class="activity-item">
          <div class="activity-dot blue"></div>
          <div style="flex:1;">
            <div>${formatAccessLabel(a.estado)}</div>
            <div style="font-size:0.75rem;color:var(--color-text-muted);">${formatDateTime(a.fecha)}</div>
          </div>
        </div>
      `).join('');
    } else {
      content.innerHTML = '<div class="empty-state"><p>No existen accesos registrados</p></div>';
    }
  }
}

function formatAccessLabel(status) {
  return { permitido: 'Acceso permitido', proximo_vencer: 'Acceso con alerta', vencido: 'Acceso denegado' }[status] || status;
}

function bindEvents(container, cliente, clienteId) {
  document.getElementById('btn-back')?.addEventListener('click', () => navigateTo(ROUTES.CLIENTES));

  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', async () => {
      const historial = await loadHistorialCliente(clienteId);
      renderTab(tab.dataset.tab, historial);
    });
  });

  document.getElementById('btn-qr')?.addEventListener('click', () => {
    const { close } = createModal({
      title: 'Código QR del Cliente',
      content: `<div style="text-align:center;padding:1rem;"><p style="margin-bottom:1rem;font-size:0.875rem;">${cliente.nombreCompleto}</p><div id="qr-canvas"></div><p style="margin-top:1rem;font-size:0.75rem;color:var(--color-text-muted);">${cliente.qrCode}</p></div>`,
      footer: '<button class="btn btn-secondary" id="btn-close-qr">Cerrar</button>'
    });

    document.getElementById('btn-close-qr')?.addEventListener('click', close);

    new QRCode(document.getElementById('qr-canvas'), {
      text: cliente.qrCode,
      width: 200,
      height: 200,
      colorDark: '#c9a227',
      colorLight: '#1a1a1a'
    });
  });
}
