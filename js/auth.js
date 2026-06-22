import {
  signInWithEmailAndPassword,
  signOut,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
import { auth, db } from '../firebase/firebase-config.js';
import { ROLES } from './utils/constants.js';

const VALID_ROLES = [ROLES.ADMIN, ROLES.RECEPCION];
const USUARIOS_COLLECTION = 'usuarios';
const AUTH_TIMEOUT_MS = 20000;
const FIRESTORE_TIMEOUT_MS = 20000;

let currentUser = null;
let currentUserData = null;
let authInitialized = false;
const authListeners = [];

export class AuthError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'AuthError';
    this.code = code;
    this.details = details;
  }
}

function log(step, data) {
  if (data !== undefined) {
    console.log(`[BFC Auth] ${step}`, data);
  } else {
    console.log(`[BFC Auth] ${step}`);
  }
}

function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`Timeout (${ms}ms): ${label}`)), ms);
    })
  ]);
}

export function getCurrentUser() {
  return currentUser;
}

export function getCurrentUserData() {
  return currentUserData;
}

export function getUserRole() {
  return currentUserData?.rol || null;
}

export function isAuthInitialized() {
  return authInitialized;
}

export function resetAuthCache() {
  authInitialized = false;
}

export function onAuthChange(callback) {
  authListeners.push(callback);
  if (authInitialized) {
    callback(currentUser, currentUserData);
  }
}

function notifyListeners() {
  authListeners.forEach(cb => cb(currentUser, currentUserData));
}

export function getLastAuthError() {
  try {
    const raw = sessionStorage.getItem('bfc_auth_error');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function clearLastAuthError() {
  sessionStorage.removeItem('bfc_auth_error');
}

function saveAuthError(payload) {
  sessionStorage.setItem('bfc_auth_error', JSON.stringify(payload));
}

/**
 * Lee el perfil del usuario en Firestore.
 * Ruta obligatoria: usuarios/{uid}
 */
export async function loadUserData(uid) {
  const firestorePath = `${USUARIOS_COLLECTION}/${uid}`;
  log('④ Firestore — leyendo documento', { path: firestorePath });

  try {
    const userRef = doc(db, USUARIOS_COLLECTION, uid);
    const userDoc = await withTimeout(
      getDoc(userRef),
      FIRESTORE_TIMEOUT_MS,
      `Firestore getDoc(${firestorePath})`
    );

    if (!userDoc.exists()) {
      log('④ Firestore — documento NO encontrado');
      return { status: 'not_found', data: null };
    }

    log('④ Firestore — documento encontrado');
    const data = userDoc.data();
    log('④ Firestore — datos', { email: data.email, rol: data.rol, activo: data.activo });

    if (data.activo === false) {
      log('⑤ Rol — usuario inactivo');
      return { status: 'inactive', data: null };
    }

    if (!data.rol || !VALID_ROLES.includes(data.rol)) {
      log('⑤ Rol — inválido', { rol: data.rol ?? 'sin rol' });
      return { status: 'invalid_role', data: null, rol: data.rol ?? null };
    }

    log('⑤ Rol cargado correctamente', { rol: data.rol });
    return {
      status: 'ok',
      data: { id: userDoc.id, ...data, activo: data.activo !== false }
    };
  } catch (error) {
    console.error('[BFC Auth] ④ Firestore — ERROR', error);
    if (error.code === 'permission-denied') {
      return { status: 'permission_denied', data: null, error };
    }
    throw error;
  }
}

function profileErrorMessage(result, authUser) {
  switch (result.status) {
    case 'not_found':
      return 'Su cuenta no está configurada en el sistema. Complete la configuración inicial o contacte al administrador.';
    case 'inactive':
      return 'Su cuenta está desactivada. Contacte al administrador.';
    case 'invalid_role':
      return `Rol no válido. Contacte al administrador del sistema.`;
    case 'permission_denied':
      return 'No tiene permisos para acceder. Verifique la configuración de Firebase con el administrador.';
    default:
      return 'No se pudo cargar su perfil. Intente iniciar sesión nuevamente.';
  }
}

function handleProfileResult(result, authUser) {
  if (result.status === 'ok') {
    return result.data;
  }
  const code = result.status === 'not_found' ? 'profile-missing'
    : result.status === 'inactive' ? 'profile-inactive'
    : result.status === 'invalid_role' ? 'invalid-role'
    : result.status === 'permission_denied' ? 'permission-denied'
    : 'unknown';
  throw new AuthError(code, profileErrorMessage(result, authUser), { uid: authUser.uid });
}

/**
 * Inicializa auth UNA sola vez usando authStateReady (evita carga infinita por doble callback).
 */
export async function initAuth() {
  if (authInitialized) {
    log('initAuth — ya inicializado, reutilizando sesión');
    return currentUser;
  }

  log('② Esperando authStateReady...');

  try {
    await withTimeout(auth.authStateReady(), AUTH_TIMEOUT_MS, 'Firebase authStateReady()');
  } catch (error) {
    console.error('[BFC Auth] ② ERROR authStateReady', error);
    authInitialized = true;
    throw error;
  }

  log('② authStateReady completado');
  console.log('[BFC Boot] ② Firestore conectado (cliente SDK listo)');

  const user = auth.currentUser;

  if (!user) {
    log('③ Sin usuario autenticado');
    currentUser = null;
    currentUserData = null;
    authInitialized = true;
    notifyListeners();
    return null;
  }

  log('③ Usuario autenticado', { uid: user.uid, email: user.email });

  let result;
  try {
    result = await loadUserData(user.uid);
  } catch (error) {
    authInitialized = true;
    saveAuthError({ status: 'firestore_error', message: error.message });
    throw error;
  }

  if (result.status === 'ok') {
    currentUser = user;
    currentUserData = result.data;
    clearLastAuthError();
    authInitialized = true;
    notifyListeners();
    log('initAuth — COMPLETADO OK', { rol: currentUserData.rol });
    return currentUser;
  }

  log('initAuth — perfil rechazado', { status: result.status });
  saveAuthError({
    status: result.status,
    message: profileErrorMessage(result, user),
    uid: user.uid
  });

  await signOut(auth);
  currentUser = null;
  currentUserData = null;
  authInitialized = true;
  notifyListeners();
  return null;
}

export async function login(email, password, remember = true) {
  authInitialized = false;
  log('Login — inicio', { email });

  const persistence = remember ? browserLocalPersistence : browserSessionPersistence;
  await setPersistence(auth, persistence);

  let credential;
  try {
    credential = await signInWithEmailAndPassword(auth, email, password);
  } catch (error) {
    console.error('[BFC Auth] Login — ERROR Firebase', error);
    throw error;
  }

  log('③ Usuario autenticado (login)', { uid: credential.user.uid, email: credential.user.email });

  const result = await loadUserData(credential.user.uid);

  try {
    const userData = handleProfileResult(result, credential.user);
    currentUser = credential.user;
    currentUserData = userData;
    authInitialized = true;
    clearLastAuthError();
    notifyListeners();
    log('Login — COMPLETADO, redirigiendo a app.html');
    return { user: currentUser, userData: currentUserData };
  } catch (error) {
    saveAuthError({ status: error.code, message: error.message });
    await signOut(auth);
    currentUser = null;
    currentUserData = null;
    authInitialized = true;
    notifyListeners();
    throw error;
  }
}

export async function logout() {
  log('Cierre de sesión', { uid: currentUser?.uid });
  await signOut(auth);
  currentUser = null;
  currentUserData = null;
  authInitialized = false;
  clearLastAuthError();
  notifyListeners();
  window.location.href = 'index.html';
}

export function requireAuth() {
  const ok = !!(currentUser && currentUserData);
  if (!ok) {
    log('requireAuth — DENEGADO (sin sesión válida)');
  }
  return ok;
}

export function getAuthErrorMessage(code) {
  const messages = {
    'auth/invalid-email': 'Correo electrónico inválido',
    'auth/user-disabled': 'Cuenta deshabilitada en Firebase Authentication',
    'auth/user-not-found': 'Credenciales incorrectas',
    'auth/wrong-password': 'Credenciales incorrectas',
    'auth/invalid-credential': 'Credenciales incorrectas',
    'auth/too-many-requests': 'Demasiados intentos. Intente más tarde',
    'auth/network-request-failed': 'Error de conexión. Verifique su internet',
    'permission-denied': 'No tiene permisos para acceder al sistema.',
    'profile-missing': 'Su cuenta no está configurada. Contacte al administrador.',
    'profile-inactive': 'Cuenta desactivada',
    'invalid-role': 'Rol no válido. Contacte al administrador.'
  };
  return messages[code] || 'Error al iniciar sesión';
}
