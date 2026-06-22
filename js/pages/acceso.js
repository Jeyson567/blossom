import { procesarEscaneoQR } from '../services/accesos.service.js';
import { getAllClientes } from '../services/clientes.service.js';
import { getCurrentUserData } from '../auth.js';
import { formatDate } from '../utils/formatters.js';
import { getDaysRemaining } from '../utils/helpers.js';
import { renderStatusBadge } from '../components/data-table.js';
import { renderClienteSearchBox, bindClienteSearch } from '../components/cliente-search.js';

let html5QrCode = null;
let scanning = false;

export async function render(container) {
  let clientes = [];
  try {
    clientes = await getAllClientes();
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
          <div style="margin-top:1rem;">
            <label class="form-label">Código QR manual</label>
            <div style="display:flex;gap:0.5rem;">
              <input type="text" class="form-input" id="qr-manual" placeholder="BFC-XXXXX-XXXXX">
              <button class="btn btn-secondary" id="btn-manual-scan">Verificar</button>
            </div>
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
        if (c.qrCode) handleScan(c.qrCode);
      }
    });
  }

  bindEvents(container);
}

function bindEvents(container) {
  document.getElementById('btn-start-scan')?.addEventListener('click', startScanner);
  document.getElementById('btn-stop-scan')?.addEventListener('click', stopScanner);
  document.getElementById('btn-manual-scan')?.addEventListener('click', () => {
    const code = document.getElementById('qr-manual').value.trim();
    if (code) handleScan(code);
  });
  document.getElementById('qr-manual')?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      const code = e.target.value.trim();
      if (code) handleScan(code);
    }
  });
}

async function startScanner() {
  if (scanning) return;

  try {
    html5QrCode = new Html5Qrcode('qr-reader');
    await html5QrCode.start(
      { facingMode: 'environment' },
      { fps: 10, qrbox: { width: 250, height: 250 } },
      (decodedText) => handleScan(decodedText),
      () => {}
    );
    scanning = true;
    document.getElementById('btn-start-scan').style.display = 'none';
    document.getElementById('btn-stop-scan').style.display = '';
  } catch (error) {
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
  }
}

async function handleScan(qrCode) {
  const user = getCurrentUserData();
  const result = await procesarEscaneoQR(qrCode, user.id);

  const resultContainer = document.getElementById('access-result');
  if (!resultContainer) return;

  if (!result.success) {
    resultContainer.innerHTML = `
      <div class="access-card access-vencido">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="var(--color-danger)" style="margin:0 auto 1rem;"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>
        <h3 style="color:var(--color-danger);margin-bottom:0.5rem;">QR No Reconocido</h3>
        <p style="color:var(--color-text-secondary);">${result.error}</p>
      </div>
    `;
    return;
  }

  const { cliente, estado, fechaVencimiento } = result;
  const dias = getDaysRemaining(fechaVencimiento);
  const statusClass = { permitido: 'access-permitido', proximo_vencer: 'access-proximo', vencido: 'access-vencido' }[estado];
  const statusColor = { permitido: 'var(--color-success)', proximo_vencer: 'var(--color-warning)', vencido: 'var(--color-danger)' }[estado];
  const statusText = { permitido: 'ACCESO PERMITIDO', proximo_vencer: 'PRÓXIMO A VENCER', vencido: 'MEMBRESÍA VENCIDA' }[estado];

  resultContainer.innerHTML = `
    <div class="access-card ${statusClass}">
      ${cliente.fotoURL
        ? `<img src="${cliente.fotoURL}" class="avatar avatar-xl" style="margin:0 auto 1rem;width:100px;height:100px;">`
        : `<div class="avatar avatar-xl avatar-placeholder" style="margin:0 auto 1rem;width:100px;height:100px;font-size:2rem;">${cliente.nombreCompleto.charAt(0)}</div>`
      }
      <h3 style="font-size:1.25rem;margin-bottom:0.25rem;">${cliente.nombreCompleto}</h3>
      <div style="font-size:1.125rem;font-weight:700;color:${statusColor};margin:1rem 0;">${statusText}</div>
      ${renderStatusBadge(estado === 'permitido' ? 'activo' : estado === 'proximo_vencer' ? 'proximo_vencer' : 'vencido')}
      <div style="margin-top:1rem;font-size:0.875rem;color:var(--color-text-secondary);">
        <p>Vencimiento: ${formatDate(fechaVencimiento)}</p>
        ${dias !== null ? `<p>${dias >= 0 ? dias + ' días restantes' : 'Vencida hace ' + Math.abs(dias) + ' días'}</p>` : ''}
      </div>
    </div>
  `;

  if (navigator.vibrate) {
    navigator.vibrate(estado === 'permitido' ? 100 : [100, 50, 100]);
  }
}
