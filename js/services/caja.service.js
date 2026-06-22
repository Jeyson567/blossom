import {
  collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc,
  Timestamp, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
import { db } from '../../firebase/firebase-config.js';
import { startOfDay } from '../utils/helpers.js';

const COLLECTION = 'cajas';

async function fetchAllCajas() {
  const snapshot = await getDocs(collection(db, COLLECTION));
  return snapshot.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (b.fecha?.toMillis?.() || 0) - (a.fecha?.toMillis?.() || 0));
}

export async function getCajaAbierta() {
  const abiertas = (await fetchAllCajas()).filter(c => c.estado === 'abierta');
  if (!abiertas.length) return null;
  const caja = abiertas[0];
  const movimientos = await getMovimientosCaja(caja.id);
  return { ...caja, movimientos };
}

export async function abrirCaja({ montoInicial, usuario }) {
  const existente = await getCajaAbierta();
  if (existente) throw new Error('Ya existe una caja abierta');

  const cajaData = {
    fecha: Timestamp.fromDate(startOfDay()),
    usuarioId: usuario.uid,
    usuarioNombre: usuario.nombre,
    montoInicial: Number(montoInicial) || 0,
    estado: 'abierta',
    createdAt: serverTimestamp()
  };

  const docRef = doc(collection(db, COLLECTION));
  await setDoc(docRef, cajaData);
  return { id: docRef.id, ...cajaData, movimientos: [] };
}

export async function cerrarCaja(cajaId, totales) {
  await updateDoc(doc(db, COLLECTION, cajaId), {
    estado: 'cerrada',
    cierre: totales,
    cerradaAt: serverTimestamp()
  });
  return getCajaById(cajaId);
}

export async function getCajaById(id) {
  const docSnap = await getDoc(doc(db, COLLECTION, id));
  if (!docSnap.exists()) return null;
  const movimientos = await getMovimientosCaja(id);
  return { id: docSnap.id, ...docSnap.data(), movimientos };
}

export async function registrarMovimientoCaja(cajaId, { tipo, concepto, monto, metodoPago, usuario }) {
  const movData = {
    tipo,
    concepto,
    monto: Number(monto),
    metodoPago: metodoPago || 'efectivo',
    usuarioId: usuario.uid,
    usuarioNombre: usuario.nombre,
    fecha: serverTimestamp()
  };

  const docRef = doc(collection(db, COLLECTION, cajaId, 'movimientos'));
  await setDoc(docRef, movData);
  return { id: docRef.id, ...movData };
}

export async function getMovimientosCaja(cajaId) {
  const snapshot = await getDocs(collection(db, COLLECTION, cajaId, 'movimientos'));
  return snapshot.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (b.fecha?.toMillis?.() || 0) - (a.fecha?.toMillis?.() || 0));
}

export async function calcularTotalesCaja(caja) {
  const movimientos = caja.movimientos || [];
  const totales = {
    efectivo: caja.montoInicial || 0,
    transferencia: 0,
    tarjeta: 0,
    qr: 0,
    ingresos: 0,
    egresos: 0
  };

  movimientos.forEach(m => {
    if (m.tipo === 'ingreso') {
      totales.ingresos += m.monto;
      totales[m.metodoPago] = (totales[m.metodoPago] || 0) + m.monto;
    } else {
      totales.egresos += m.monto;
      if (m.metodoPago === 'efectivo') totales.efectivo -= m.monto;
    }
  });

  totales.total = totales.efectivo + totales.transferencia + totales.tarjeta + totales.qr;
  return totales;
}

export async function getHistorialCajas(options = {}) {
  const { page = 1, perPage = 15 } = options;
  const all = await fetchAllCajas();
  const total = all.length;
  const start = (page - 1) * perPage;
  return { data: all.slice(start, start + perPage), total, page, perPage };
}

export async function deleteCaja(id) {
  await deleteDoc(doc(db, COLLECTION, id));
}
