import {
  collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc,
  query, orderBy, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
import { createUserWithEmailAndPassword } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import { initializeApp, deleteApp } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import { db, app } from '../../firebase/firebase-config.js';
import { sanitizeString } from '../utils/helpers.js';

const COLLECTION = 'usuarios';

export async function getUsuarios() {
  const q = query(collection(db, COLLECTION), orderBy('nombre'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function getUsuarioById(uid) {
  const docSnap = await getDoc(doc(db, COLLECTION, uid));
  if (!docSnap.exists()) return null;
  return { id: docSnap.id, ...docSnap.data() };
}

export async function createUsuario({ email, password, nombre, rol }) {
  return registrarUsuarioCompleto({ email, password, nombre, rol });
}

/**
 * Crea usuario en Firebase Authentication Y documento en Firestore usuarios/{uid}.
 * Usado por el panel de administración y por setup.html (primer administrador).
 */
export async function registrarUsuarioCompleto({ email, password, nombre, rol }) {
  const secondaryApp = initializeApp(app.options, `Secondary-${Date.now()}`);
  const secondaryAuth = getAuth(secondaryApp);
  const secondaryDb = getFirestore(secondaryApp);

  try {
    const credential = await createUserWithEmailAndPassword(secondaryAuth, email, password);
    const uid = credential.user.uid;

    const userData = {
      email: email.trim().toLowerCase(),
      nombre: sanitizeString(nombre),
      rol: rol || 'recepcion',
      activo: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    // Firestore con la sesión del usuario recién creado (necesario para setup.html y reglas bootstrap)
    await setDoc(doc(secondaryDb, COLLECTION, uid), userData);
    return { id: uid, ...userData };
  } finally {
    await deleteApp(secondaryApp);
  }
}

/**
 * Crea solo el documento Firestore para un UID ya existente en Authentication.
 * Útil cuando el usuario fue creado manualmente en Firebase Console.
 */
export async function crearPerfilFirestore(uid, { email, nombre, rol, activo = true }) {
  const userData = {
    email: email.trim().toLowerCase(),
    nombre: sanitizeString(nombre),
    rol: rol || 'recepcion',
    activo,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };

  await setDoc(doc(db, COLLECTION, uid), userData);
  return { id: uid, ...userData };
}

export async function updateUsuario(uid, data) {
  const updateData = { updatedAt: serverTimestamp() };
  if (data.nombre !== undefined) updateData.nombre = sanitizeString(data.nombre);
  if (data.rol !== undefined) updateData.rol = data.rol;
  if (data.activo !== undefined) updateData.activo = data.activo;

  await updateDoc(doc(db, COLLECTION, uid), updateData);
  return getUsuarioById(uid);
}

export async function toggleUsuarioStatus(uid, activo) {
  await updateDoc(doc(db, COLLECTION, uid), { activo, updatedAt: serverTimestamp() });
}

export async function deleteUsuario(uid) {
  await deleteDoc(doc(db, COLLECTION, uid));
}
