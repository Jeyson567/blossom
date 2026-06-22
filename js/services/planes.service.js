import {
  collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc,
  serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
import { db } from '../../firebase/firebase-config.js';
import { sanitizeString } from '../utils/helpers.js';

const COLLECTION = 'planes';

async function fetchAllPlanes() {
  const snapshot = await getDocs(collection(db, COLLECTION));
  return snapshot.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (a.precio || 0) - (b.precio || 0));
}

export async function getPlanes(onlyActive = false) {
  let planes = await fetchAllPlanes();
  if (onlyActive) planes = planes.filter(p => p.activo !== false);
  return planes;
}

export async function getPlanById(id) {
  const docSnap = await getDoc(doc(db, COLLECTION, id));
  if (!docSnap.exists()) return null;
  return { id: docSnap.id, ...docSnap.data() };
}

export async function createPlan(data) {
  const planData = {
    nombre: sanitizeString(data.nombre),
    precio: Number(data.precio),
    duracionDias: Number(data.duracionDias),
    descripcion: data.descripcion?.trim() || '',
    activo: data.activo !== false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };

  const docRef = doc(collection(db, COLLECTION));
  await setDoc(docRef, planData);
  return { id: docRef.id, ...planData };
}

export async function updatePlan(id, data) {
  const updateData = { updatedAt: serverTimestamp() };
  if (data.nombre !== undefined) updateData.nombre = sanitizeString(data.nombre);
  if (data.precio !== undefined) updateData.precio = Number(data.precio);
  if (data.duracionDias !== undefined) updateData.duracionDias = Number(data.duracionDias);
  if (data.descripcion !== undefined) updateData.descripcion = data.descripcion.trim();
  if (data.activo !== undefined) updateData.activo = data.activo;

  await updateDoc(doc(db, COLLECTION, id), updateData);
  return getPlanById(id);
}

export async function deletePlan(id) {
  await deleteDoc(doc(db, COLLECTION, id));
}

export async function togglePlanStatus(id, activo) {
  await updateDoc(doc(db, COLLECTION, id), { activo, updatedAt: serverTimestamp() });
}
