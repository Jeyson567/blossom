import {
  collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc,
  serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
import { db } from '../../firebase/firebase-config.js';
import { sanitizeString } from '../utils/helpers.js';

const COLLECTION = 'productos';
const MOV_COLLECTION = 'movimientosInventario';

async function fetchAllProductos() {
  const snapshot = await getDocs(collection(db, COLLECTION));
  return snapshot.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (a.nombre || '').localeCompare(b.nombre || '', 'es'));
}

export async function getProductos(options = {}) {
  const { search, categoria, page = 1, perPage = 15 } = options;
  let productos = await fetchAllProductos();

  if (search) {
    const term = search.toLowerCase();
    productos = productos.filter(p =>
      p.nombre?.toLowerCase().includes(term) ||
      p.codigo?.toLowerCase().includes(term)
    );
  }
  if (categoria && categoria !== 'todos') {
    productos = productos.filter(p => p.categoria === categoria);
  }

  const total = productos.length;
  const start = (page - 1) * perPage;
  return { data: productos.slice(start, start + perPage), total, page, perPage };
}

export async function getProductoById(id) {
  const docSnap = await getDoc(doc(db, COLLECTION, id));
  if (!docSnap.exists()) return null;
  return { id: docSnap.id, ...docSnap.data() };
}

export async function createProducto(data) {
  const productoData = {
    codigo: data.codigo.trim().toUpperCase(),
    nombre: sanitizeString(data.nombre),
    categoria: data.categoria?.trim() || 'General',
    stock: Number(data.stock) || 0,
    stockMinimo: Number(data.stockMinimo) || 5,
    precioCompra: Number(data.precioCompra) || 0,
    precioVenta: Number(data.precioVenta) || 0,
    activo: true,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };

  const docRef = doc(collection(db, COLLECTION));
  await setDoc(docRef, productoData);
  return { id: docRef.id, ...productoData };
}

export async function updateProducto(id, data) {
  const updateData = { updatedAt: serverTimestamp() };
  const fields = ['codigo', 'nombre', 'categoria', 'stock', 'stockMinimo', 'precioCompra', 'precioVenta', 'activo'];
  fields.forEach(f => {
    if (data[f] !== undefined) updateData[f] = data[f];
  });
  if (updateData.codigo) updateData.codigo = updateData.codigo.trim().toUpperCase();
  if (updateData.nombre) updateData.nombre = sanitizeString(updateData.nombre);

  await updateDoc(doc(db, COLLECTION, id), updateData);
  return getProductoById(id);
}

export async function deleteProducto(id) {
  await deleteDoc(doc(db, COLLECTION, id));
}

export async function registrarMovimiento({ productoId, tipo, cantidad, motivo, usuario }) {
  const producto = await getProductoById(productoId);
  if (!producto) throw new Error('Producto no encontrado');

  const qty = Number(cantidad);
  const newStock = tipo === 'entrada' ? producto.stock + qty : producto.stock - qty;
  if (newStock < 0) throw new Error('Stock insuficiente');

  await updateDoc(doc(db, COLLECTION, productoId), {
    stock: newStock,
    updatedAt: serverTimestamp()
  });

  const movData = {
    productoId,
    productoNombre: producto.nombre,
    tipo,
    cantidad: qty,
    motivo: motivo?.trim() || '',
    usuarioId: usuario.uid,
    usuarioNombre: usuario.nombre,
    fecha: serverTimestamp()
  };

  const docRef = doc(collection(db, MOV_COLLECTION));
  await setDoc(docRef, movData);
  return { id: docRef.id, ...movData, nuevoStock: newStock };
}

export async function getMovimientos(productoId) {
  const snapshot = await getDocs(collection(db, MOV_COLLECTION));
  let movs = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
  if (productoId) movs = movs.filter(m => m.productoId === productoId);
  return movs.sort((a, b) => (b.fecha?.toMillis?.() || 0) - (a.fecha?.toMillis?.() || 0));
}

export async function getStockAlerts() {
  const productos = (await fetchAllProductos()).filter(p => p.activo !== false);
  return {
    bajo: productos.filter(p => p.stock > 0 && p.stock <= p.stockMinimo),
    agotado: productos.filter(p => p.stock <= 0)
  };
}

export async function getCategorias() {
  const productos = await fetchAllProductos();
  return [...new Set(productos.map(p => p.categoria).filter(Boolean))].sort();
}

export async function getAllProductos() {
  return fetchAllProductos();
}
