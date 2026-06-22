import { ROUTES, ROUTE_PERMISSIONS } from './utils/constants.js';
import { canAccessRoute } from './utils/permissions.js';

const routes = {};

export function registerRoute(name, handler) {
  routes[name] = handler;
}

export function navigateTo(route, params = {}) {
  let hash = route;
  if (params.id) hash = `${route}/${params.id}`;
  window.location.hash = hash;
}

export function getCurrentRoute() {
  const hash = window.location.hash.slice(1) || ROUTES.DASHBOARD;
  const parts = hash.split('/');
  return { route: parts[0], id: parts[1] || null };
}

export async function handleRoute(userRole) {
  const { route, id } = getCurrentRoute();
  const baseRoute = id && route === ROUTES.CLIENTE_PERFIL ? ROUTES.CLIENTE_PERFIL : route;

  console.log(`[BFC Router] Cargando ruta: ${baseRoute}`);

  if (!ROUTE_PERMISSIONS[baseRoute] && baseRoute !== ROUTES.CLIENTE_PERFIL) {
    console.warn('[BFC Router] Ruta desconocida, volviendo a dashboard');
    navigateTo(ROUTES.DASHBOARD);
    return;
  }

  if (!canAccessRoute(userRole, baseRoute === ROUTES.CLIENTE_PERFIL ? ROUTES.CLIENTES : baseRoute)) {
    console.warn('[BFC Router] Sin permiso para ruta, volviendo a dashboard');
    navigateTo(ROUTES.DASHBOARD);
    return;
  }

  const handler = routes[baseRoute];
  if (!handler) {
    console.error('[BFC Router] Handler no registrado:', baseRoute);
    navigateTo(ROUTES.DASHBOARD);
    return;
  }

  const container = document.getElementById('page-content');
  if (!container) {
    console.error('[BFC Router] #page-content no existe en el DOM');
    return;
  }

  container.innerHTML = '<div class="page-loading"><div class="loading-spinner"></div><p>Cargando...</p></div>';

  const ROUTE_TIMEOUT_MS = 30000;

  try {
    console.log(`[BFC Router] Ejecutando handler de "${baseRoute}"...`);
    await Promise.race([
      handler(container, id),
      new Promise((_, reject) => {
        setTimeout(() => reject(new Error(`Timeout (${ROUTE_TIMEOUT_MS}ms) cargando "${baseRoute}"`)), ROUTE_TIMEOUT_MS);
      })
    ]);
    updateActiveNav(baseRoute);
    console.log(`[BFC Router] ⑥ Ruta "${baseRoute}" cargada OK`);
  } catch (error) {
    console.error(`[BFC Router] ERROR en ruta "${baseRoute}":`, error);
    console.error(error?.code);
    console.error(error?.message);
    if (error?.stack) console.error(error.stack);
    container.innerHTML = `
      <div style="padding:20px;color:#ef4444;">
        <h3 style="margin-bottom:0.75rem;">Error real detectado — ruta: ${baseRoute}</h3>
        <p style="font-size:0.875rem;margin-bottom:0.5rem;"><strong>Código:</strong> ${error?.code || '—'}</p>
        <p style="font-size:0.875rem;margin-bottom:1rem;"><strong>Mensaje:</strong> ${error?.message || error}</p>
        <pre style="font-size:0.75rem;background:#1a1a1a;padding:1rem;border-radius:8px;overflow:auto;color:#fca5a5;max-height:240px;">${error?.stack || ''}</pre>
        <button class="btn btn-secondary" id="router-retry" style="margin-top:1rem;">Reintentar</button>
      </div>
    `;
    document.getElementById('router-retry')?.addEventListener('click', () => handleRoute(userRole));
  }
}

function updateActiveNav(route) {
  document.querySelectorAll('.nav-link').forEach(link => {
    const linkRoute = link.dataset.route;
    const isActive = linkRoute === route ||
      (linkRoute === ROUTES.CLIENTES && route === ROUTES.CLIENTE_PERFIL);
    link.classList.toggle('active', isActive);
  });
}

export function initRouter(userRole) {
  window.addEventListener('hashchange', () => handleRoute(userRole));
  handleRoute(userRole);
}

export function registerAllRoutes(pageModules) {
  Object.entries(pageModules).forEach(([name, module]) => {
    registerRoute(name, module.render);
  });
}
