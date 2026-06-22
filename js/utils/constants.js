export const ROLES = {
  ADMIN: 'admin',
  RECEPCION: 'recepcion'
};

export const MEMBERSHIP_STATUS = {
  ACTIVO: 'activo',
  PROXIMO_VENCER: 'proximo_vencer',
  VENCIDO: 'vencido',
  SIN_MEMBRESIA: 'sin_membresia'
};

export const ACCESS_STATUS = {
  PERMITIDO: 'permitido',
  PROXIMO_VENCER: 'proximo_vencer',
  VENCIDO: 'vencido'
};

export const PAYMENT_METHODS = {
  EFECTIVO: 'efectivo',
  TRANSFERENCIA: 'transferencia',
  TARJETA: 'tarjeta',
  QR: 'qr'
};

export const PAYMENT_TYPES = {
  MEMBRESIA: 'membresia',
  INSCRIPCION: 'inscripcion',
  PRODUCTO: 'producto',
  OTRO: 'otro'
};

export const NOTIFICATION_TYPES = {
  SIETE_DIAS: '7dias',
  TRES_DIAS: '3dias',
  VENCIMIENTO: 'vencimiento',
  VENCIDA: 'vencida',
  MANUAL: 'manual'
};

export const ITEMS_PER_PAGE = 15;

export const ALERT_DAYS = [7, 3, 0];

export const ROUTES = {
  DASHBOARD: 'dashboard',
  CLIENTES: 'clientes',
  VENCIMIENTOS: 'vencimientos',
  CLIENTE_PERFIL: 'cliente',
  PLANES: 'planes',
  VENTA: 'venta',
  ACCESO: 'acceso',
  PAGOS: 'pagos',
  CAJA: 'caja',
  INVENTARIO: 'inventario',
  REPORTES: 'reportes',
  WHATSAPP: 'whatsapp',
  CONFIGURACION: 'configuracion',
  USUARIOS: 'usuarios'
};

export const ROUTE_PERMISSIONS = {
  [ROUTES.DASHBOARD]: [ROLES.ADMIN, ROLES.RECEPCION],
  [ROUTES.CLIENTES]: [ROLES.ADMIN, ROLES.RECEPCION],
  [ROUTES.VENCIMIENTOS]: [ROLES.ADMIN, ROLES.RECEPCION],
  [ROUTES.CLIENTE_PERFIL]: [ROLES.ADMIN, ROLES.RECEPCION],
  [ROUTES.PLANES]: [ROLES.ADMIN],
  [ROUTES.VENTA]: [ROLES.ADMIN, ROLES.RECEPCION],
  [ROUTES.ACCESO]: [ROLES.ADMIN, ROLES.RECEPCION],
  [ROUTES.PAGOS]: [ROLES.ADMIN, ROLES.RECEPCION],
  [ROUTES.CAJA]: [ROLES.ADMIN, ROLES.RECEPCION],
  [ROUTES.INVENTARIO]: [ROLES.ADMIN],
  [ROUTES.REPORTES]: [ROLES.ADMIN],
  [ROUTES.WHATSAPP]: [ROLES.ADMIN, ROLES.RECEPCION],
  [ROUTES.CONFIGURACION]: [ROLES.ADMIN],
  [ROUTES.USUARIOS]: [ROLES.ADMIN]
};

export const PAYMENT_METHOD_LABELS = {
  efectivo: 'Efectivo',
  transferencia: 'Transferencia',
  tarjeta: 'Tarjeta',
  qr: 'QR'
};

export const PAYMENT_TYPE_LABELS = {
  membresia: 'Membresía',
  inscripcion: 'Inscripción',
  producto: 'Producto',
  otro: 'Otro'
};

export const GENERO_OPTIONS = [
  { value: 'masculino', label: 'Masculino' },
  { value: 'femenino', label: 'Femenino' },
  { value: 'otro', label: 'Otro' }
];
