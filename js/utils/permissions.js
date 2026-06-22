import { ROUTE_PERMISSIONS, ROLES } from './constants.js';

export function canAccessRoute(rol, route) {
  const allowed = ROUTE_PERMISSIONS[route];
  if (!allowed) return false;
  return allowed.includes(rol);
}

export function isAdmin(rol) {
  return rol === ROLES.ADMIN;
}

export function canDelete(rol) {
  return rol === ROLES.ADMIN;
}

export function canConfigure(rol) {
  return rol === ROLES.ADMIN;
}

export function canManageUsers(rol) {
  return rol === ROLES.ADMIN;
}

export function canManageInventory(rol) {
  return rol === ROLES.ADMIN;
}

export function canViewReports(rol) {
  return rol === ROLES.ADMIN;
}

export function filterNavByRole(navItems, rol) {
  return navItems.filter(item => {
    if (!item.route) return true;
    return canAccessRoute(rol, item.route);
  });
}
