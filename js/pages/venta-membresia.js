import { getAllClientes } from '../services/clientes.service.js';
import { getPlanes } from '../services/planes.service.js';
import { venderMembresia } from '../services/membresias.service.js';
import { getCurrentUserData } from '../auth.js';
import { formatCurrency, formatDate } from '../utils/formatters.js';
import { calculateExpirationDate } from '../utils/helpers.js';
import { PAYMENT_METHODS, PAYMENT_METHOD_LABELS, ROUTES } from '../utils/constants.js';
import { renderEmptyState, bindEmptyAction } from '../components/empty-state.js';
import { renderClienteSearchBox, bindClienteSearch } from '../components/cliente-search.js';
import { navigateTo } from '../router.js';

let selectedCliente = null;
let selectedPlan = null;
let allClientes = [];
let allPlanes = [];

export async function render(container) {
  try {
    [allClientes, allPlanes] = await Promise.all([getAllClientes(), getPlanes(true)]);
  } catch (error) {
    if (error.code === 'permission-denied') throw error;
    allClientes = [];
    allPlanes = [];
  }

  selectedCliente = null;
  selectedPlan = null;

  const metodoOptions = Object.values(PAYMENT_METHODS).map(m =>
    `<option value="${m}">${PAYMENT_METHOD_LABELS[m]}</option>`
  ).join('');

  container.innerHTML = `
    <div class="animate-fade-in">
      <div class="page-header">
        <div>
          <h2 class="page-title">Venta de Membresía</h2>
          <p class="page-subtitle">Registro rápido en recepción</p>
        </div>
      </div>

      <div class="grid-2">
        <div class="card">
          <h3 style="margin-bottom:0.75rem;font-size:1rem;">1. Buscar cliente</h3>
          ${allClientes.length
            ? `${renderClienteSearchBox({ inputId: 'venta-cliente-search', placeholder: 'Nombre o teléfono...' })}
               <div class="cliente-search-results" id="venta-cliente-results"></div>
               <p id="venta-cliente-pick" style="font-size:0.8125rem;color:var(--color-text-muted);margin-top:0.5rem;">Ningún cliente seleccionado</p>`
            : renderEmptyState({
                icon: 'users',
                title: 'No hay clientes',
                actionLabel: 'Crear Cliente',
                actionId: 'empty-venta-cliente'
              })
          }
        </div>

        <div class="card">
          <h3 style="margin-bottom:0.75rem;font-size:1rem;">2. Seleccionar plan</h3>
          <div id="planes-list" style="display:grid;gap:0.5rem;">
            ${allPlanes.length
              ? allPlanes.map(p => `
                <button type="button" class="plan-pick-btn" data-plan-id="${p.id}">
                  <span><strong>${p.nombre}</strong> · ${p.duracionDias} días</span>
                  <span style="color:var(--color-gold);font-weight:700;">${formatCurrency(p.precio)}</span>
                </button>`).join('')
              : renderEmptyState({ icon: 'plans', title: 'No hay planes activos', actionLabel: 'Ir a Membresías', actionId: 'empty-venta-plan' })
            }
          </div>
        </div>
      </div>

      <div class="card" style="margin-top:1rem;">
        <div class="form-grid">
          <div class="form-group">
            <label class="form-label">Fecha inicio</label>
            <input type="date" class="form-input" id="fecha-inicio" value="${new Date().toISOString().split('T')[0]}">
          </div>
          <div class="form-group">
            <label class="form-label">Vencimiento</label>
            <div id="fecha-vencimiento" class="form-input" style="background:var(--color-bg-input);">—</div>
          </div>
          <div class="form-group">
            <label class="form-label">Método de pago</label>
            <select class="form-select" id="metodo-pago">${metodoOptions}</select>
          </div>
          <div class="form-group">
            <label class="form-label">Total</label>
            <div id="total-venta" style="font-size:1.5rem;font-weight:700;color:var(--color-gold);">Q 0.00</div>
          </div>
        </div>
        <button class="btn btn-primary" id="btn-confirmar-venta" disabled style="margin-top:0.75rem;">Confirmar venta</button>
      </div>
    </div>
  `;

  bindEvents(container);
  applyPreselectedCliente();
}

function applyPreselectedCliente() {
  const preId = sessionStorage.getItem('bfc-venta-cliente-id');
  if (!preId || !allClientes.length) return;
  sessionStorage.removeItem('bfc-venta-cliente-id');
  const cliente = allClientes.find(c => c.id === preId);
  if (!cliente) return;
  selectedCliente = cliente;
  const pick = document.getElementById('venta-cliente-pick');
  const search = document.getElementById('venta-cliente-search');
  if (pick) {
    pick.innerHTML = `<strong style="color:var(--color-gold);">${cliente.nombreCompleto}</strong> · ${cliente.telefono || ''}`;
  }
  if (search) search.value = cliente.nombreCompleto;
  updateResumen();
}

function bindEvents(container) {
  bindEmptyAction('empty-venta-cliente', () => navigateTo(ROUTES.CLIENTES));
  bindEmptyAction('empty-venta-plan', () => navigateTo(ROUTES.PLANES));

  if (allClientes.length) {
    bindClienteSearch({
      input: document.getElementById('venta-cliente-search'),
      resultsEl: document.getElementById('venta-cliente-results'),
      allClientes,
      onSelect: (c) => {
        selectedCliente = c;
        document.getElementById('venta-cliente-pick').innerHTML =
          `<strong style="color:var(--color-gold);">${c.nombreCompleto}</strong> · ${c.telefono || ''}`;
        updateResumen();
      }
    });
  }

  container.querySelectorAll('.plan-pick-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      container.querySelectorAll('.plan-pick-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      selectedPlan = allPlanes.find(p => p.id === btn.dataset.planId);
      updateResumen();
    });
  });

  document.getElementById('fecha-inicio')?.addEventListener('change', updateResumen);

  document.getElementById('btn-confirmar-venta')?.addEventListener('click', async () => {
    if (!selectedCliente || !selectedPlan) return;

    const ok = await Swal.fire({
      title: 'Confirmar venta',
      html: `<p>${selectedCliente.nombreCompleto}</p><p>${selectedPlan.nombre} — <strong>${formatCurrency(selectedPlan.precio)}</strong></p>`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#c9a227',
      background: '#1a1a1a',
      color: '#fff'
    });
    if (!ok.isConfirmed) return;

    try {
      const user = getCurrentUserData();
      await venderMembresia({
        cliente: selectedCliente,
        plan: selectedPlan,
        fechaInicio: document.getElementById('fecha-inicio').value,
        metodoPago: document.getElementById('metodo-pago').value,
        usuario: { uid: user.id, nombre: user.nombre }
      });

      await Swal.fire({
        title: '¡Venta exitosa!',
        html: `<div id="qr-venta" style="margin:1rem auto;"></div>`,
        icon: 'success',
        confirmButtonColor: '#c9a227',
        background: '#1a1a1a',
        color: '#fff'
      });

      new QRCode(document.getElementById('qr-venta'), {
        text: selectedCliente.qrCode,
        width: 160,
        height: 160,
        colorDark: '#c9a227',
        colorLight: '#1a1a1a'
      });

      render(container);
    } catch (error) {
      Swal.fire({ icon: 'error', title: 'Error', text: error.message, background: '#1a1a1a', color: '#fff' });
    }
  });
}

function updateResumen() {
  const total = selectedPlan ? formatCurrency(selectedPlan.precio) : 'Q 0.00';
  document.getElementById('total-venta').textContent = total;

  const fechaInicio = document.getElementById('fecha-inicio')?.value;
  if (selectedPlan && fechaInicio) {
    document.getElementById('fecha-vencimiento').textContent =
      formatDate(calculateExpirationDate(fechaInicio, selectedPlan.duracionDias));
  }

  document.getElementById('btn-confirmar-venta').disabled = !(selectedCliente && selectedPlan);
}
