import { buscarClientePorCodigo, getAllClientes } from '../services/clientes.service.js';
import { registrarAcceso } from '../services/accesos.service.js';
import { getCurrentUserData } from '../auth.js';
import { formatDate } from '../utils/formatters.js';
import { getDaysRemaining, getAccessStatus } from '../utils/helpers.js';
import { renderStatusBadge } from '../components/data-table.js';
import { renderClienteSearchBox, bindClienteSearch } from '../components/cliente-search.js';

let html5QrCode = null;
let scanning = false;
let lastScanCode = '';
let lastScanTime = 0;

export async function render(container) {
  let clientes = [];
  try {
    clientes = await getAllClientes();
    console.log('[BFC Acceso] Módulo cargado. Clientes disponibles:', clientes.length);
  } catch (e) {
    console.warn('[BFC Acceso] Clientes no cargados:', e.message);
  }

  container.innerHTML = `
    <div class="animate-fade-in">
      <div class="page-header">
        <div>
          <h2 class="page-title">Control de Acceso</h2>
          <p class="page-subtitle">Escaneo QR o búsqueda por nombre / teléfono</p>
        </div>
        <div style="display:flex;gap:0.5rem;">
          <button class="btn btn-primary" id="btn-start-scan">Iniciar Cámara</button>
          <button class="btn btn-danger" id="btn-stop-scan" style="display:none;">Detener</button>
        </div>
      </div>

      <div class="card" style="margin-bottom:1rem;">
        <label class="form-label">Buscar cliente</label>
        ${renderClienteSearchBox({ inputId: 'acceso-cliente-search', placeholder: 'Nombre o teléfono...' })}
        <div class="cliente-search-results" id="acceso-cliente-results"></div>
      </div>

      <div class="grid-2">
        <div class="card">
          <div id="qr-reader" style="width:100%;min-height:280px;"></div>
          <div style="margin-top:1rem;padding-top:1rem;border-top:1px solid var(--color-border);">
            <label class="form-label">Modo prueba — Pegar código manualmente</label>
            <div style="display:flex;gap:0.5rem;flex-wrap:wrap;">
              <input type="text" class="form-input" id="qr-manual" placeholder="BFC-XXXXX-XXXXX" style="flex:1;min-width:180px;">
              <button class="btn btn-secondary" id="btn-buscar-cliente">Buscar Cliente</button>
            </div>
            <p style="font-size:0.75rem;color:var(--color-text-muted);margin-top:0.5rem;">
              Si encuentra al cliente aquí, el problema está en la lectura de cámara. Si no, el problema está en la consulta.
            </p>
          </div>
        </div>

        <div id="access-result">
          <div class="card" style="text-align:center;padding:3rem;">
            <p style="color:var(--color-text-secondary);">Escanee o busque un cliente para verificar acceso</p>
          </div>
        </div>
      </div>
    </div>
  `;

  if (clientes.length) {
    bindClienteSearch({
      input: document.getElementById('acceso-cliente-search'),
      resultsEl: document.getElementById('acceso-cliente-results'),
      allClientes: clientes,
      onSelect: (c) => {
        console.log('[BFC Acceso] Cliente seleccionado por búsqueda:', c.nombreCompleto, '| qrCode:', c.qrCode);
        if (c.qrCode) onScanSuccess(c.qrCode, 'busqueda-nombre');
      }
    });
  }

  bindEvents(container);
}

function bindEvents(container) {
  document.getElementById('btn-start-scan')?.addEventListener('click', startScanner);
  document.getElementById('btn-stop-scan')?.addEventListener('click', stopScanner);
  document.getElementById('btn-buscar-cliente')?.addEventListener('click', () => {
    const code = document.getElementById('qr-manual')?.value?.trim();
    console.log('[BFC Acceso] Modo prueba — búsqueda manual');
    if (code) onScanSuccess(code, 'manual');
    else Swal.fire({ icon: 'info', title: 'Pegue un código QR', background: '#1a1a1a', color: '#fff' });
  });
  document.getElementById('qr-manual')?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      const code = e.target.value.trim();
      if (code) onScanSuccess(code, 'manual-enter');
    }
  });
}

async function startScanner() {
  if (scanning) return;
  console.log('[BFC Acceso] Paso 1: Iniciando lector de cámara...');

  try {
    html5QrCode = new Html5Qrcode('qr-reader');
    await html5QrCode.start(
      { facingMode: 'environment' },
      { fps: 10, qrbox: { width: 250, height: 250 } },
      (decodedText) => onScanSuccess(decodedText, 'camara'),
      () => {}
    );
    scanning = true;
    document.getElementById('btn-start-scan').style.display = 'none';
    document.getElementById('btn-stop-scan').style.display = '';
    console.log('[BFC Acceso] Lector de cámara activo');
  } catch (error) {
    console.error('[BFC Acceso] Error de cámara:', error);
    Swal.fire({
      icon: 'error',
      title: 'Error de cámara',
      text: 'No se pudo acceder a la cámara. Verifique los permisos.',
      background: '#1a1a1a',
      color: '#fff'
    });
  }
}

async function stopScanner() {
  if (html5QrCode && scanning) {
    await html5QrCode.stop();
    scanning = false;
    document.getElementById('btn-start-scan').style.display = '';
    document.getElementById('btn-stop-scan').style.display = 'none';
    console.log('[BFC Acceso] Lector de cámara detenido');
  }
}

/** Callback del lector QR — Paso 2: procesamiento del código leído. */
function onScanSuccess(decodedText, origen = 'camara') {
  console.log('QR detectado');
  console.log(decodedText);
  console.log('[BFC Acceso] Origen:', origen);

  const now = Date.now();
  if (decodedText === lastScanCode && now - lastScanTime < 2500) {
    console.log('[BFC Acceso] Escaneo duplicado ignorado');
    return;
  }
  lastScanCode = decodedText;
  lastScanTime = now;

  buscarClientePorCodigoYMostrar(decodedText);
}

/** Paso 3 y 4: consulta Firestore + mostrar resultado en pantalla. */
async function buscarClientePorCodigoYMostrar(decodedText) {
  const resultContainer = document.getElementById('access-result');
  if (!resultContainer) return;

  resultContainer.innerHTML = `
    <div class="card" style="text-align:center;padding:2rem;">
      <div class="loading-spinner" style="margin:0 auto 1rem;"></div>
      <p style="color:var(--color-text-secondary);">Buscando cliente...</p>
    </div>
  `;

  try {
    const { cliente, codigoBuscado } = await buscarClientePorCodigo(decodedText);

    if (!cliente) {
      console.log('[BFC Acceso] Paso 4: Mostrar — cliente no encontrado');
      mostrarNoEncontrado(codigoBuscado || decodedText);
      return;
    }

    console.log('[BFC Acceso] Paso 4: Mostrar — cliente encontrado');
    mostrarCliente(cliente);

    try {
      const user = getCurrentUserData();
      console.log('[BFC Acceso] Registrando acceso en Firestore...');
      await registrarAcceso(cliente, user.id);
      console.log('[BFC Acceso] Acceso registrado correctamente');
    } catch (regError) {
      console.error('[BFC Acceso] Error al registrar acceso (cliente sí encontrado):', regError);
      console.error(regError?.code);
      console.error(regError?.message);
    }
  } catch (error) {
    console.error('[BFC Acceso] Error en consulta:', error);
    console.error(error?.code);
    console.error(error?.message);
    resultContainer.innerHTML = `
      <div class="access-card access-vencido">
        <h3 style="color:var(--color-danger);margin-bottom:0.5rem;">Error al buscar cliente</h3>
        <p style="color:var(--color-text-secondary);font-size:0.875rem;">${error.message}</p>
        <p style="font-size:0.75rem;color:var(--color-text-muted);margin-top:0.5rem;">Código leído: ${decodedText}</p>
      </div>
    `;
  }
}

function mostrarNoEncontrado(codigo) {
  const resultContainer = document.getElementById('access-result');
  if (!resultContainer) return;

  resultContainer.innerHTML = `
    <div class="access-card access-vencido">
      <svg width="48" height="48" viewBox="0 0 24 24" fill="var(--color-danger)" style="margin:0 auto 1rem;display:block;"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>
      <h3 style="color:var(--color-danger);margin-bottom:0.5rem;">Cliente no encontrado</h3>
      <p style="color:var(--color-text-secondary);font-size:0.875rem;">Código leído: <strong style="color:var(--color-text-primary);">${codigo}</strong></p>
      <p style="font-size:0.75rem;color:var(--color-text-muted);margin-top:0.75rem;">Campo buscado en Firestore: <code>qrCode</code></p>
    </div>
  `;

  if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
}

function mostrarCliente(cliente) {
  const resultContainer = document.getElementById('access-result');
  if (!resultContainer) return;

  const fechaVencimiento = cliente.fechaVencimiento?.toDate?.() || null;
  const dias = getDaysRemaining(cliente.fechaVencimiento);
  const estadoAcceso = getAccessStatus(fechaVencimiento);
  const statusClass = { permitido: 'access-permitido', proximo_vencer: 'access-proximo', vencido: 'access-vencido' }[estadoAcceso];
  const statusColor = { permitido: 'var(--color-success)', proximo_vencer: 'var(--color-warning)', vencido: 'var(--color-danger)' }[estadoAcceso];
  const statusText = { permitido: 'ACCESO PERMITIDO', proximo_vencer: 'PRÓXIMO A VENCER', vencido: 'MEMBRESÍA VENCIDA' }[estadoAcceso];

  resultContainer.innerHTML = `
    <div class="access-card ${statusClass}">
      ${cliente.fotoURL
        ? `<img src="${cliente.fotoURL}" class="avatar avatar-xl" style="margin:0 auto 1rem;width:100px;height:100px;display:block;">`
        : `<div class="avatar avatar-xl avatar-placeholder" style="margin:0 auto 1rem;width:100px;height:100px;font-size:2rem;">${cliente.nombreCompleto.charAt(0)}</div>`
      }
      <h3 style="font-size:1.25rem;margin-bottom:0.25rem;">${cliente.nombreCompleto}</h3>
      <p style="font-size:0.875rem;color:var(--color-text-secondary);margin-bottom:0.75rem;">${cliente.telefono || '—'}</p>
      <div style="font-size:1.125rem;font-weight:700;color:${statusColor};margin:0.75rem 0;">${statusText}</div>
      <div style="margin-bottom:0.75rem;">${renderStatusBadge(cliente.estadoMembresia || 'sin_membresia')}</div>
      <div style="font-size:0.875rem;color:var(--color-text-secondary);text-align:left;max-width:280px;margin:0 auto;">
        <p><strong>Vencimiento:</strong> ${fechaVencimiento ? formatDate(fechaVencimiento) : '—'}</p>
        <p><strong>Días restantes:</strong> ${
          dias === null ? '—'
            : dias < 0 ? `<span style="color:var(--color-danger);">Vencida hace ${Math.abs(dias)} días</span>`
            : dias === 0 ? '<span style="color:var(--color-warning);">Vence hoy</span>'
            : `${dias} días`
        }</p>
        <p style="font-size:0.75rem;color:var(--color-text-muted);margin-top:0.5rem;">QR: ${cliente.qrCode}</p>
      </div>
    </div>
  `;

  if (navigator.vibrate) {
    navigator.vibrate(estadoAcceso === 'permitido' ? 100 : [100, 50, 100]);
  }
}
