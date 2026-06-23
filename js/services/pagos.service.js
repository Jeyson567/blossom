import {
  collection, doc, getDocs, setDoc, deleteDoc,
  Timestamp, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
import { db } from '../../firebase/firebase-config.js';
import { startOfDay, endOfDay, startOfMonth, endOfMonth, startOfYear, getWeekRange } from '../utils/helpers.js';

const COLLECTION = 'pagos';

async function fetchAllPagos() {
  const snapshot = await getDocs(collection(db, COLLECTION));
  return snapshot.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (b.fecha?.toMillis?.() || 0) - (a.fecha?.toMillis?.() || 0));
}

export async function createPago({
  clienteId, clienteNombre, concepto, tipo, monto, metodoPago,
  membresiaId, productoId, productoNombre, cantidad, ganancia, precioCompraUnitario, usuario
}) {
  const now = new Date();
  const qty = Number(cantidad) || 1;
  const pagoData = {
    clienteId: clienteId || null,
    clienteNombre: clienteNombre || '—',
    concepto,
    tipo: tipo || 'otro',
    monto: Number(monto),
    metodoPago,
    usuarioId: usuario.uid,
    usuarioNombre: usuario.nombre,
    membresiaId: membresiaId || null,
    productoId: productoId || null,
    productoNombre: productoNombre || null,
    cantidad: tipo === 'producto' ? qty : null,
    ganancia: ganancia != null ? Number(ganancia) : null,
    precioCompraUnitario: precioCompraUnitario != null ? Number(precioCompraUnitario) : null,
    fecha: Timestamp.fromDate(now),
    createdAt: serverTimestamp()
  };

  const docRef = doc(collection(db, COLLECTION));
  await setDoc(docRef, pagoData);
  return { id: docRef.id, ...pagoData };
}

export async function getPagos(options = {}) {
  const { page = 1, perPage = 15, tipo, metodoPago, fechaDesde, fechaHasta } = options;
  let pagos = await fetchAllPagos();

  if (tipo && tipo !== 'todos') pagos = pagos.filter(p => p.tipo === tipo);
  if (metodoPago && metodoPago !== 'todos') pagos = pagos.filter(p => p.metodoPago === metodoPago);
  if (fechaDesde) {
    const desde = new Date(fechaDesde);
    pagos = pagos.filter(p => p.fecha?.toDate?.() >= desde);
  }
  if (fechaHasta) {
    const hasta = new Date(fechaHasta);
    hasta.setHours(23, 59, 59, 999);
    pagos = pagos.filter(p => p.fecha?.toDate?.() <= hasta);
  }

  const total = pagos.length;
  const start = (page - 1) * perPage;
  return { data: pagos.slice(start, start + perPage), total, page, perPage };
}

export async function getPagosByCliente(clienteId) {
  const pagos = await fetchAllPagos();
  return pagos.filter(p => p.clienteId === clienteId);
}

export async function getIngresosPorRango(inicio, fin) {
  const pagos = await fetchAllPagos();
  const filtered = pagos.filter(p => {
    const f = p.fecha?.toDate?.();
    return f && f >= inicio && f <= fin;
  });
  const total = filtered.reduce((sum, p) => sum + (p.monto || 0), 0);
  return { total, count: filtered.length, pagos: filtered };
}

export async function getIngresosDelDia() {
  return getIngresosPorRango(startOfDay(), endOfDay());
}

export async function getIngresosDelMes() {
  return getIngresosPorRango(startOfMonth(), endOfMonth());
}

export async function getIngresosMensuales(year) {
  const meses = [];
  for (let m = 0; m < 12; m++) {
    const inicio = new Date(year, m, 1);
    const fin = new Date(year, m + 1, 0, 23, 59, 59, 999);
    const { total } = await getIngresosPorRango(inicio, fin);
    meses.push({ mes: m, total });
  }
  return meses;
}

export async function getIngresosPorPeriodo(periodo) {
  const now = new Date();
  let inicio, fin;

  switch (periodo) {
    case 'dia':
      inicio = startOfDay(now);
      fin = endOfDay(now);
      break;
    case 'semana': {
      const day = now.getDay();
      const diff = now.getDate() - day + (day === 0 ? -6 : 1);
      inicio = new Date(now.getFullYear(), now.getMonth(), diff);
      inicio.setHours(0, 0, 0, 0);
      fin = endOfDay(now);
      break;
    }
    case 'anio':
      inicio = startOfYear(now);
      fin = endOfDay(now);
      break;
    default:
      inicio = startOfMonth(now);
      fin = endOfMonth(now);
  }

  return getIngresosPorRango(inicio, fin);
}

export async function getRecentPagos(limitCount = 10) {
  const pagos = await fetchAllPagos();
  return pagos.slice(0, limitCount);
}

export async function deletePago(id) {
  await deleteDoc(doc(db, COLLECTION, id));
}

export async function getAllPagos() {
  return fetchAllPagos();
}

function calcGananciasFromPagos(pagos) {
  const membresias = pagos.filter(p => p.tipo === 'membresia' || p.tipo === 'inscripcion');
  const productos = pagos.filter(p => p.tipo === 'producto');
  const otros = pagos.filter(p => !['membresia', 'inscripcion', 'producto'].includes(p.tipo));

  const ingresosMembresias = membresias.reduce((s, p) => s + (p.monto || 0), 0);
  const ingresosProductos = productos.reduce((s, p) => s + (p.monto || 0), 0);
  const ingresosOtros = otros.reduce((s, p) => s + (p.monto || 0), 0);
  const gananciaProductos = productos.reduce((s, p) => s + (p.ganancia ?? ((p.monto || 0) - (p.precioCompraUnitario || 0) * (p.cantidad || 1))), 0);
  const gananciaMembresias = ingresosMembresias;
  const gananciaNeta = gananciaMembresias + gananciaProductos + ingresosOtros;

  return {
    ingresosMembresias,
    ingresosProductos,
    ingresosOtros,
    gananciaProductos,
    gananciaMembresias,
    gananciaNeta,
    totalIngresos: ingresosMembresias + ingresosProductos + ingresosOtros
  };
}

export async function getGananciasPorRango(inicio, fin) {
  const pagos = await fetchAllPagos();
  const filtered = pagos.filter(p => {
    const f = p.fecha?.toDate?.();
    return f && f >= inicio && f <= fin;
  });
  return calcGananciasFromPagos(filtered);
}

export async function getGananciasDashboard() {
  const { start: weekStart, end: weekEnd } = getWeekRange();
  const [hoy, semana, mes, anio] = await Promise.all([
    getGananciasPorRango(startOfDay(), endOfDay()),
    getGananciasPorRango(weekStart, weekEnd),
    getGananciasPorRango(startOfMonth(), endOfMonth()),
    getGananciasPorRango(startOfYear(), endOfDay())
  ]);
  return { hoy, semana, mes, anio };
}
