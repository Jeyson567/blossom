import {
  doc, getDoc, setDoc, getDocs, collection, query, where, limit,
  serverTimestamp, writeBatch
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
import { signInWithEmailAndPassword } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import { db, auth } from '../../firebase/firebase-config.js';
import { registrarUsuarioCompleto } from './usuarios.service.js';
import { ROLES } from '../utils/constants.js';

const SISTEMA_DOC = 'sistema';
const GENERAL_DOC = 'general';
const VERSION = '1.0.0';

export const PLANES_DEFECTO = [
  { nombre: 'Diario', precio: 25, duracionDias: 1, descripcion: 'Acceso por 1 día' },
  { nombre: 'Semanal', precio: 100, duracionDias: 7, descripcion: 'Acceso por 7 días' },
  { nombre: 'Quincenal', precio: 175, duracionDias: 15, descripcion: 'Acceso por 15 días' },
  { nombre: 'Mensual', precio: 300, duracionDias: 30, descripcion: 'Acceso por 30 días' },
  { nombre: 'Trimestral', precio: 800, duracionDias: 90, descripcion: 'Acceso por 90 días' },
  { nombre: 'Semestral', precio: 1400, duracionDias: 180, descripcion: 'Acceso por 180 días' },
  { nombre: 'Anual', precio: 2500, duracionDias: 365, descripcion: 'Acceso por 365 días' }
];

const CONFIG_DEFECTO = {
  nombreGimnasio: 'Blossom Fitness Club',
  logoURL: '',
  telefono: '',
  direccion: '',
  redesSociales: { facebook: '', instagram: '', tiktok: '', youtube: '' },
  diasAlertaVencimiento: [7, 3, 0]
};

function log(msg, data) {
  console.log(`[BFC Bootstrap] ${msg}`, data ?? '');
}

/** Indica si el documento configuracion/sistema marca el sistema como listo. */
function sistemaMarcadoComoConfigurado(data) {
  if (!data) return false;
  return data.configurado === true
    || data.tieneAdmin === true
    || data.inicializado === true;
}

/**
 * Marca el sistema como configurado (bandera permanente).
 * Nunca pasar tieneAdmin: false ni configurado: false aquí.
 */
export async function marcarSistemaConfigurado(extra = {}) {
  log('Marcando sistema como configurado');
  await setDoc(doc(db, 'configuracion', SISTEMA_DOC), {
    configurado: true,
    tieneAdmin: true,
    inicializado: true,
    version: VERSION,
    fechaConfiguracion: serverTimestamp(),
    inicializadoAt: serverTimestamp(),
    ...extra
  }, { merge: true });
}

/**
 * Busca al menos un administrador activo en usuarios (requiere sesión con permisos).
 */
export async function hayAdministradorEnUsuarios() {
  try {
    const q = query(
      collection(db, 'usuarios'),
      where('rol', '==', ROLES.ADMIN),
      where('activo', '==', true),
      limit(1)
    );
    const snap = await getDocs(q);
    const existe = !snap.empty;
    log('Consulta administradores en usuarios', { existe });
    return existe;
  } catch (error) {
    console.warn('[BFC Bootstrap] No se pudo consultar usuarios:', error.message);
    return false;
  }
}

/**
 * Verifica si el sistema necesita configuración inicial (sin login).
 * Lee configuracion/sistema — regla pública de solo lectura.
 */
export async function verificarEstadoSistema() {
  log('Verificando estado del sistema...');

  try {
    const snap = await getDoc(doc(db, 'configuracion', SISTEMA_DOC));

    if (!snap.exists()) {
      log('configuracion/sistema no existe → puede requerir onboarding');
      return {
        necesitaOnboarding: true,
        configurado: false,
        tieneAdmin: false,
        motivo: 'sin_documento_sistema'
      };
    }

    const data = snap.data();
    const configurado = sistemaMarcadoComoConfigurado(data);

    log('Estado configuracion/sistema', { configurado, data });

    return {
      necesitaOnboarding: !configurado,
      configurado,
      tieneAdmin: configurado || data.tieneAdmin === true,
      motivo: configurado ? 'sistema_configurado' : 'documento_incompleto'
    };
  } catch (error) {
    console.warn('[BFC Bootstrap] Error leyendo configuracion/sistema:', error.code, error.message);
    // No asumir sistema vacío: un error de red/permisos no debe forzar onboarding
    return {
      necesitaOnboarding: false,
      configurado: false,
      tieneAdmin: false,
      error: error.message,
      motivo: 'error_lectura',
      mostrarLogin: true
    };
  }
}

/**
 * Confirmación completa: documento sistema + administrador en usuarios (con sesión).
 */
export async function confirmarSistemaConfigurado(userData = null) {
  const estado = await verificarEstadoSistema();
  if (estado.configurado) {
    return { configurado: true, reparado: false };
  }

  if (userData?.rol === ROLES.ADMIN) {
    await marcarSistemaConfigurado({ adminUid: userData.id, reparadoDesde: 'sesion_admin' });
    return { configurado: true, reparado: true };
  }

  const hayAdmin = await hayAdministradorEnUsuarios();
  if (hayAdmin) {
    await marcarSistemaConfigurado({ reparadoDesde: 'consulta_usuarios' });
    return { configurado: true, reparado: true };
  }

  return { configurado: false, reparado: false };
}

async function asegurarConfiguracionGeneral() {
  const ref = doc(db, 'configuracion', GENERAL_DOC);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    log('Creando configuracion/general');
    await setDoc(ref, { ...CONFIG_DEFECTO, createdAt: serverTimestamp() });
    return { ...CONFIG_DEFECTO };
  }
  return { ...CONFIG_DEFECTO, ...snap.data() };
}

export async function crearPlanesPorDefecto() {
  const snapshot = await getDocs(collection(db, 'planes'));
  if (!snapshot.empty) {
    log('Planes ya existen', { count: snapshot.size });
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
  }

  log('Creando planes por defecto...');
  const batch = writeBatch(db);
  const creados = [];

  PLANES_DEFECTO.forEach((plan) => {
    const ref = doc(collection(db, 'planes'));
    const data = {
      ...plan,
      activo: true,
      esDefecto: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };
    batch.set(ref, data);
    creados.push({ id: ref.id, ...data });
  });

  await batch.commit();
  log('Planes creados', { count: creados.length });
  return creados;
}

/**
 * Crea el primer administrador + configuración + planes.
 * Llamado desde el asistente de bienvenida en index.html.
 */
export async function crearAdministradorInicial({ nombre, email, password }) {
  log('Creando administrador inicial...', { email });

  const usuario = await registrarUsuarioCompleto({
    nombre,
    email,
    password,
    rol: ROLES.ADMIN
  });

  log('Auth + usuarios/{uid} creados', { uid: usuario.id });

  await signInWithEmailAndPassword(auth, email.trim(), password);
  await auth.authStateReady();
  log('Sesión iniciada en app principal');

  await asegurarConfiguracionGeneral();
  await crearPlanesPorDefecto();
  await marcarSistemaConfigurado({
    adminUid: usuario.id,
    adminEmail: email.trim().toLowerCase(),
    origen: 'onboarding_inicial'
  });

  log('Sistema inicializado completamente');
  return usuario;
}

/**
 * Ejecutar en cada arranque de app.html con usuario autenticado.
 * Asegura configuración, planes y bandera configuracion/sistema.
 */
export async function inicializarSistema(userData) {
  log('inicializarSistema() — inicio', { uid: userData?.id, rol: userData?.rol });

  const resultados = {
    configuracion: false,
    planes: false,
    sistema: false
  };

  try {
    await asegurarConfiguracionGeneral();
    resultados.configuracion = true;
    log('✓ Configuración general verificada');
  } catch (error) {
    console.error('[BFC Bootstrap] Error en configuración:', error);
    throw new Error('No se pudo inicializar la configuración: ' + error.message);
  }

  if (userData?.rol === ROLES.ADMIN) {
    try {
      await crearPlanesPorDefecto();
      resultados.planes = true;
      log('✓ Planes verificados');
    } catch (error) {
      console.error('[BFC Bootstrap] Error creando planes:', error);
    }

    try {
      await marcarSistemaConfigurado({ adminUid: userData.id, origen: 'arranque_app' });
      resultados.sistema = true;
      log('✓ Bandera configuracion/sistema actualizada');
    } catch (error) {
      console.error('[BFC Bootstrap] Error actualizando estado del sistema:', error);
    }
  }

  log('inicializarSistema() — completado', resultados);
  return resultados;
}
