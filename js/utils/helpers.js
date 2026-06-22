export function generateId() {
  return crypto.randomUUID();
}

export function generateQRCode() {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 10);
  return `BFC-${timestamp}-${random}`.toUpperCase();
}

export function calculateExpirationDate(startDate, durationDays) {
  const date = new Date(startDate);
  date.setDate(date.getDate() + durationDays);
  return date;
}

export function getDaysRemaining(expirationDate) {
  if (!expirationDate) return null;
  const exp = expirationDate instanceof Date ? expirationDate : expirationDate.toDate?.() || new Date(expirationDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  exp.setHours(0, 0, 0, 0);
  return Math.ceil((exp - today) / (1000 * 60 * 60 * 24));
}

export function getMembershipStatus(expirationDate, alertDays = [7, 3]) {
  const days = getDaysRemaining(expirationDate);
  if (days === null) return 'sin_membresia';
  if (days < 0) return 'vencido';
  if (days <= Math.max(...alertDays)) return 'proximo_vencer';
  return 'activo';
}

export function getAccessStatus(expirationDate) {
  const days = getDaysRemaining(expirationDate);
  if (days === null || days < 0) return 'vencido';
  if (days <= 7) return 'proximo_vencer';
  return 'permitido';
}

export function debounce(fn, delay = 300) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

/** Búsqueda por nombre o teléfono (tiempo real). */
export function filterClientesBySearch(clientes, term) {
  if (!term || !term.trim()) return clientes;
  const q = term.trim().toLowerCase();
  const digits = q.replace(/\D/g, '');
  return clientes.filter(c => {
    const nombre = (c.nombreCompleto || '').toLowerCase();
    const tel = (c.telefono || '').replace(/\D/g, '');
    if (nombre.includes(q)) return true;
    if (digits.length >= 2 && tel.includes(digits)) return true;
    return false;
  });
}

export function paginate(array, page, perPage) {
  const start = (page - 1) * perPage;
  return array.slice(start, start + perPage);
}

export function getTotalPages(total, perPage) {
  if (!total || total <= 0) return 0;
  return Math.ceil(total / perPage);
}

export function startOfDay(date = new Date()) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function endOfDay(date = new Date()) {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

export function startOfMonth(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function endOfMonth(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
}

export function startOfYear(date = new Date()) {
  return new Date(date.getFullYear(), 0, 1);
}

export function getWeekRange(date = new Date()) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const start = new Date(d.setDate(diff));
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

export function sanitizeString(str) {
  if (!str) return '';
  return str.trim().replace(/\s+/g, ' ');
}

export function toFirestoreDate(date) {
  if (!date) return null;
  return date instanceof Date ? date : new Date(date);
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function getInitials(name) {
  if (!name) return '?';
  return name.split(' ').filter(Boolean).map(w => w[0]).slice(0, 2).join('').toUpperCase();
}

export function formatPhoneWhatsApp(phone) {
  if (!phone) return '';
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.startsWith('502')) return cleaned;
  if (cleaned.length === 8) return `502${cleaned}`;
  return cleaned;
}

export function buildWhatsAppUrl(phone, message) {
  const formatted = formatPhoneWhatsApp(phone);
  const encoded = encodeURIComponent(message);
  return `https://wa.me/${formatted}?text=${encoded}`;
}
