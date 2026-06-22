import {
  collection, doc, getDocs, setDoc, deleteDoc,
  query, where, orderBy, limit, Timestamp, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
import { db } from '../../firebase/firebase-config.js';
import { getAccessStatus } from '../utils/helpers.js';
import { getClienteByQR } from './clientes.service.js';

const COLLECTION = 'accesos';

export async function registrarAcceso(cliente, escaneadoPor) {
  const fechaVencimiento = cliente.fechaVencimiento?.toDate?.() || null;
  const estado = getAccessStatus(fechaVencimiento);

  const accesoData = {
    clienteId: cliente.id,
    clienteNombre: cliente.nombreCompleto,
    membresiaId: cliente.membresiaActivaId || null,
    estado,
    fecha: Timestamp.fromDate(new Date()),
    escaneadoPor
  };

  const docRef = doc(collection(db, COLLECTION));
  await setDoc(docRef, accesoData);
  return { id: docRef.id, ...accesoData, cliente };
}

export async function procesarEscaneoQR(qrCode, escaneadoPor) {
  const cliente = await getClienteByQR(qrCode);
  if (!cliente) {
    return { success: false, error: 'Código QR no reconocido' };
  }

  const acceso = await registrarAcceso(cliente, escaneadoPor);
  const fechaVencimiento = cliente.fechaVencimiento?.toDate?.() || null;

  return {
    success: true,
    acceso,
    cliente,
    estado: acceso.estado,
    fechaVencimiento
  };
}

export async function getAccesosByCliente(clienteId) {
  const snapshot = await getDocs(collection(db, COLLECTION));
  return snapshot.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .filter(a => a.clienteId === clienteId)
    .sort((a, b) => (b.fecha?.toMillis?.() || 0) - (a.fecha?.toMillis?.() || 0));
}

export async function getRecentAccesos(limitCount = 10) {
  const q = query(collection(db, COLLECTION), orderBy('fecha', 'desc'), limit(limitCount));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function getAccesos(options = {}) {
  const { page = 1, perPage = 15 } = options;
  const q = query(collection(db, COLLECTION), orderBy('fecha', 'desc'));
  const snapshot = await getDocs(q);
  const all = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
  const total = all.length;
  const start = (page - 1) * perPage;
  return { data: all.slice(start, start + perPage), total, page, perPage };
}

export async function deleteAcceso(id) {
  await deleteDoc(doc(db, COLLECTION, id));
}
