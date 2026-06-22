import {
  initAuth,
  getCurrentUserData,
  getLastAuthError,
  clearLastAuthError
} from './auth.js';
import { initRouter, registerAllRoutes } from './router.js';
import { renderSidebar, initSidebar } from './components/sidebar.js';
import { renderHeader, initHeader } from './components/header.js';
import { getConfig } from './services/config.service.js';
import { ROUTES } from './utils/constants.js';
import { getCurrentRoute } from './router.js';
import { diagnosticarSistema } from './utils/diagnostics.js';
import { inicializarSistema } from './services/bootstrap.service.js';

import * as dashboard from './pages/dashboard.js';
import * as clientes from './pages/clientes.js';
import * as vencimientos from './pages/vencimientos.js';
import * as clientePerfil from './pages/cliente-perfil.js';
import * as planes from './pages/planes.js';
import * as venta from './pages/venta-membresia.js';
import * as acceso from './pages/acceso.js';
import * as pagos from './pages/pagos.js';
import * as caja from './pages/caja.js';
import * as inventario from './pages/inventario.js';
import * as reportes from './pages/reportes.js';
import * as whatsapp from './pages/whatsapp.js';
import * as configuracion from './pages/configuracion.js';
import * as usuarios from './pages/usuarios.js';

registerAllRoutes({
  [ROUTES.DASHBOARD]: dashboard,
  [ROUTES.CLIENTES]: clientes,
  [ROUTES.VENCIMIENTOS]: vencimientos,
  [ROUTES.CLIENTE_PERFIL]: clientePerfil,
  [ROUTES.PLANES]: planes,
  [ROUTES.VENTA]: venta,
  [ROUTES.ACCESO]: acceso,
  [ROUTES.PAGOS]: pagos,
  [ROUTES.CAJA]: caja,
  [ROUTES.INVENTARIO]: inventario,
  [ROUTES.REPORTES]: reportes,
  [ROUTES.WHATSAPP]: whatsapp,
  [ROUTES.CONFIGURACION]: configuracion,
  [ROUTES.USUARIOS]: usuarios
});

function showFatalError(title, message, error = null) {
  console.error('[BFC App] ERROR FATAL:', title, message, error);
  const appEl = document.getElementById('app');
  if (!appEl) return;

  appEl.innerHTML = `
    <div class="empty-state" style="min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:2rem;">
      <h2 style="margin-bottom:1rem;color:var(--color-danger);">${title}</h2>
      <p style="max-width:520px;text-align:center;margin-bottom:1rem;line-height:1.6;">${message}</p>
      ${error ? `<pre style="font-size:0.75rem;color:var(--color-text-muted);max-width:600px;overflow:auto;background:var(--color-bg-card);padding:1rem;border-radius:8px;">${error.stack || error.message || error}</pre>` : ''}
      <p style="font-size:0.8125rem;color:var(--color-text-secondary);margin-top:1rem;">Revise la consola (F12) para el log paso a paso.</p>
      <a href="index.html" class="btn btn-primary" style="margin-top:1.5rem;">Volver al login</a>
    </div>
  `;
}

async function initApp() {
  console.log('[BFC App] ─── INICIO ARRANQUE ───');

  let user;
  try {
    console.log('[BFC App] Paso: initAuth()...');
    user = await initAuth();
    console.log('[BFC App] initAuth() terminó', { user: user?.uid ?? null });
  } catch (error) {
    await diagnosticarSistema();
    showFatalError(
      'Error al inicializar autenticación',
      error.message,
      error
    );
    return;
  }

  if (!user || !getCurrentUserData()) {
    const lastErr = getLastAuthError();
    const msg = lastErr?.message
      || 'No hay sesión válida. Inicie sesión nuevamente.';
    console.warn('[BFC App] Sin sesión válida — redirigiendo a login', lastErr);
    showFatalError('Sesión no válida', msg);
    setTimeout(() => { window.location.href = 'index.html'; }, 4000);
    return;
  }

  const userData = getCurrentUserData();
  console.log('[BFC App] Usuario listo', { uid: userData.id, rol: userData.rol });

  try {
    console.log('[BFC App] Paso: inicializarSistema()...');
    await inicializarSistema(userData);
    console.log('[BFC App] inicializarSistema() OK');
  } catch (error) {
    console.error('[BFC App] inicializarSistema() ERROR:', error);
    showFatalError('Error al inicializar el sistema', error.message, error);
    return;
  }

  let config;
  try {
    console.log('[BFC App] Paso: getConfig()...');
    config = await getConfig();
    console.log('[BFC App] getConfig() OK');
  } catch (error) {
    console.error('[BFC App] getConfig() ERROR (usando defaults):', error);
    config = { nombreGimnasio: 'Blossom Fitness Club', logoURL: '' };
  }

  const { route } = getCurrentRoute();
  console.log('[BFC App] Ruta destino:', route);

  const appEl = document.getElementById('app');
  appEl.innerHTML = `
    ${renderSidebar(userData, config, route)}
    <div class="main-content">
      ${renderHeader(route, userData)}
      <main class="page-content" id="page-content">
        <div class="page-loading"><div class="loading-spinner"></div><p>Cargando módulo...</p></div>
      </main>
    </div>
  `;

  initSidebar();
  initHeader();

  console.log('[BFC App] Paso: initRouter() → dashboard...');
  initRouter(userData.rol);
  console.log('[BFC App] ─── ARRANQUE COMPLETADO ───');

  window.addEventListener('hashchange', () => {
    const { route: newRoute } = getCurrentRoute();
    const header = document.querySelector('.breadcrumb strong');
    if (header) {
      const titles = {
        dashboard: 'Dashboard', clientes: 'Clientes', vencimientos: 'Vencimientos', cliente: 'Perfil del Cliente',
        planes: 'Membresías', venta: 'Venta de Membresía', acceso: 'Control de Acceso',
        pagos: 'Pagos', caja: 'Caja Diaria', inventario: 'Inventario',
        reportes: 'Reportes', whatsapp: 'WhatsApp', configuracion: 'Configuración', usuarios: 'Usuarios'
      };
      header.textContent = titles[newRoute] || 'Blossom Fitness';
    }
  });
}

initApp().catch(async (error) => {
  await diagnosticarSistema();
  showFatalError('Error al cargar la aplicación', error.message, error);
});
