export function formatCurrency(amount) {
  const num = Number(amount) || 0;
  return new Intl.NumberFormat('es-GT', {
    style: 'currency',
    currency: 'GTQ',
    minimumFractionDigits: 2
  }).format(num);
}

export function formatDate(date) {
  if (!date) return '—';
  const d = date instanceof Date ? date : date.toDate?.() || new Date(date);
  return new Intl.DateTimeFormat('es-GT', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  }).format(d);
}

export function formatDateTime(date) {
  if (!date) return '—';
  const d = date instanceof Date ? date : date.toDate?.() || new Date(date);
  return new Intl.DateTimeFormat('es-GT', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(d);
}

export function formatTime(date) {
  if (!date) return '—';
  const d = date instanceof Date ? date : date.toDate?.() || new Date(date);
  return new Intl.DateTimeFormat('es-GT', {
    hour: '2-digit',
    minute: '2-digit'
  }).format(d);
}

export function formatDateInput(date) {
  if (!date) return '';
  const d = date instanceof Date ? date : date.toDate?.() || new Date(date);
  return d.toISOString().split('T')[0];
}

export function formatRelativeTime(date) {
  if (!date) return '';
  const d = date instanceof Date ? date : date.toDate?.() || new Date(date);
  const now = new Date();
  const diff = now - d;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return 'Ahora';
  if (minutes < 60) return `Hace ${minutes} min`;
  if (hours < 24) return `Hace ${hours}h`;
  if (days < 7) return `Hace ${days}d`;
  return formatDate(d);
}

export function capitalize(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export function formatRole(rol) {
  const roles = { admin: 'Administrador', recepcion: 'Recepción' };
  return roles[rol] || rol;
}

export function formatMembershipStatus(status) {
  const labels = {
    activo: 'Activo',
    proximo_vencer: 'Próximo a vencer',
    vencido: 'Vencido',
    sin_membresia: 'Sin membresía',
    activa: 'Activa',
    vencida: 'Vencida',
    renovada: 'Renovada'
  };
  return labels[status] || status;
}

export function formatAccessStatus(status) {
  const labels = {
    permitido: 'Acceso permitido',
    proximo_vencer: 'Próximo a vencer',
    vencido: 'Membresía vencida'
  };
  return labels[status] || status;
}

export function formatGenero(genero) {
  const labels = { masculino: 'Masculino', femenino: 'Femenino', otro: 'Otro' };
  return labels[genero] || genero;
}

export function formatNumber(num) {
  return new Intl.NumberFormat('es-GT').format(num || 0);
}
