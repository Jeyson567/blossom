import { formatRole } from '../utils/formatters.js';
import { logout } from '../auth.js';

const ROUTE_TITLES = {
  dashboard: 'Dashboard',
  clientes: 'Clientes',
  vencimientos: 'Vencimientos',
  cliente: 'Perfil del Cliente',
  planes: 'Membresías',
  venta: 'Venta de Membresía',
  acceso: 'Control de Acceso',
  pagos: 'Pagos',
  caja: 'Caja Diaria',
  inventario: 'Inventario',
  reportes: 'Reportes',
  whatsapp: 'WhatsApp',
  configuracion: 'Configuración',
  usuarios: 'Usuarios'
};

export function renderHeader(route, userData) {
  const title = ROUTE_TITLES[route] || 'Blossom Fitness';

  return `
    <header class="app-header">
      <div class="header-left">
        <button class="menu-toggle" id="menu-toggle" aria-label="Menú">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
            <path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z"/>
          </svg>
        </button>
        <div class="breadcrumb"><strong>${title}</strong></div>
      </div>
      <div class="header-right" style="display:flex;align-items:center;gap:1rem;">
        <span style="font-size:0.8125rem;color:var(--color-text-secondary);">${formatRole(userData.rol)}</span>
        <button class="btn btn-secondary btn-sm" id="btn-logout">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z"/></svg>
          Salir
        </button>
      </div>
    </header>
  `;
}

export function initHeader() {
  document.getElementById('btn-logout')?.addEventListener('click', async () => {
    const result = await Swal.fire({
      title: '¿Cerrar sesión?',
      text: 'Se cerrará tu sesión actual',
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#c9a227',
      cancelButtonColor: '#6b6b6b',
      confirmButtonText: 'Sí, salir',
      cancelButtonText: 'Cancelar',
      background: '#1a1a1a',
      color: '#fff'
    });
    if (result.isConfirmed) await logout();
  });
}
