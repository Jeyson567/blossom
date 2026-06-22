import {
  collection, doc, getDoc, getDocs, setDoc, updateDoc,
  query, where, orderBy, limit, Timestamp, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
import { db } from '../../firebase/firebase-config.js';
import { calculateExpirationDate, getMembershipStatus } from '../utils/helpers.js';
import { updateClienteMembresia } from './clientes.service.js';
import { createPago } from './pagos.service.js';
import { scheduleNotificationsForClient } from './whatsapp.service.js';

const COLLECTION = 'membresias';

export async function getMembresiasByCliente(clienteId) {
  const snapshot = await getDocs(collection(db, COLLECTION));
  return snapshot.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .filter(m => m.clienteId === clienteId)
    .sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
}

export async function getMembresiaById(id) {
  const docSnap = await getDoc(doc(db, COLLECTION, id));
  if (!docSnap.exists()) return null;
  return { id: docSnap.id, ...docSnap.data() };
}

export async function getAllMembresias() {
  const snapshot = await getDocs(collection(db, COLLECTION));
  return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function venderMembresia({ cliente, plan, fechaInicio, metodoPago, usuario }) {
  const startDate = new Date(fechaInicio);
  startDate.setHours(0, 0, 0, 0);
  const expirationDate = calculateExpirationDate(startDate, plan.duracionDias);
  expirationDate.setHours(23, 59, 59, 999);

  const membresiaData = {
    clienteId: cliente.id,
    clienteNombre: cliente.nombreCompleto,
    planId: plan.id,
    planNombre: plan.nombre,
    precio: plan.precio,
    fechaInicio: Timestamp.fromDate(startDate),
    fechaVencimiento: Timestamp.fromDate(expirationDate),
    estado: 'activa',
    qrCode: cliente.qrCode,
    vendidoPor: usuario.uid,
    vendidoPorNombre: usuario.nombre,
    createdAt: serverTimestamp()
  };

  const docRef = doc(collection(db, COLLECTION));
  await setDoc(docRef, membresiaData);

  const membresia = { id: docRef.id, ...membresiaData };

  await updateClienteMembresia(cliente.id, {
    id: docRef.id,
    fechaVencimiento: Timestamp.fromDate(expirationDate)
  });

  await createPago({
    clienteId: cliente.id,
    clienteNombre: cliente.nombreCompleto,
    concepto: `Membresía ${plan.nombre}`,
    tipo: 'membresia',
    monto: plan.precio,
    metodoPago,
    membresiaId: docRef.id,
    usuario
  });

  if (cliente.whatsapp) {
    await scheduleNotificationsForClient(cliente, expirationDate);
  }

  return membresia;
}

export async function getMembresiasVendidas(periodo = 'mes') {
  const now = new Date();
  let startDate;

  switch (periodo) {
    case 'dia':
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      break;
    case 'semana': {
      const day = now.getDay();
      const diff = now.getDate() - day + (day === 0 ? -6 : 1);
      startDate = new Date(now.setDate(diff));
      startDate.setHours(0, 0, 0, 0);
      break;
    }
    case 'anio':
      startDate = new Date(now.getFullYear(), 0, 1);
      break;
    default:
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
  }

  const q = query(
    collection(db, COLLECTION),
    where('createdAt', '>=', Timestamp.fromDate(startDate)),
    orderBy('createdAt', 'desc')
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function getMembresiasStats() {
  const snapshot = await getDocs(collection(db, COLLECTION));
  const membresias = snapshot.docs.map(d => d.data());

  const planCounts = {};
  membresias.forEach(m => {
    planCounts[m.planNombre] = (planCounts[m.planNombre] || 0) + 1;
  });

  const sorted = Object.entries(planCounts).sort((a, b) => b[1] - a[1]);
  return {
    total: membresias.length,
    masVendidas: sorted.slice(0, 5),
    menosVendidas: sorted.slice(-5).reverse()
  };
}

export async function getRecentMembresias(limitCount = 10) {
  const q = query(collection(db, COLLECTION), orderBy('createdAt', 'desc'), limit(limitCount));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
}
