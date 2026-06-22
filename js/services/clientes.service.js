import {
  collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc,
  serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
import { db } from '../../firebase/firebase-config.js';
import { generateQRCode, getMembershipStatus, sanitizeString, filterClientesBySearch } from '../utils/helpers.js';
import { MEMBERSHIP_STATUS } from '../utils/constants.js';

const COLLECTION = 'clientes';

async function fetchAllClientes() {
  const snapshot = await getDocs(collection(db, COLLECTION));
  return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
}

function sortByNombre(clientes) {
  return [...clientes].sort((a, b) =>
    (a.nombreCompleto || '').localeCompare(b.nombreCompleto || '', 'es')
  );
}

export async function getClientes(options = {}) {
  const { estado, search, page = 1, perPage = 15 } = options;
  let clientes = sortByNombre(await fetchAllClientes());

  if (estado && estado !== 'todos') {
    clientes = clientes.filter(c => c.estadoMembresia === estado);
  }
  if (search) {
    clientes = filterClientesBySearch(clientes, search);
  }

  const total = clientes.length;
  const start = (page - 1) * perPage;
  return { data: clientes.slice(start, start + perPage), total, page, perPage };
}

export async function getClienteById(id) {
  const docSnap = await getDoc(doc(db, COLLECTION, id));
  if (!docSnap.exists()) return null;
  return { id: docSnap.id, ...docSnap.data() };
}

export async function getClienteByQR(qrCode) {
  const clientes = await fetchAllClientes();
  return clientes.find(c => c.qrCode === qrCode) || null;
}

export async function createCliente(data, userId) {
  const clienteData = {
    nombreCompleto: sanitizeString(data.nombreCompleto),
    telefono: data.telefono?.trim() || '',
    genero: data.genero || '',
    contactoEmergencia: data.contactoEmergencia?.trim() || '',
    telefonoEmergencia: data.telefonoEmergencia?.trim() || '',
    observaciones: data.observaciones?.trim() || '',
    fotoURL: data.fotoURL || '',
    whatsapp: data.telefono?.trim() || '',
    qrCode: generateQRCode(),
    membresiaActivaId: null,
    estadoMembresia: MEMBERSHIP_STATUS.SIN_MEMBRESIA,
    fechaVencimiento: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    createdBy: userId
  };

  const docRef = doc(collection(db, COLLECTION));
  await setDoc(docRef, clienteData);
  return { id: docRef.id, ...clienteData };
}

export async function updateCliente(id, data) {
  const updateData = { updatedAt: serverTimestamp() };
  const fields = [
    'nombreCompleto', 'telefono', 'genero', 'contactoEmergencia',
    'telefonoEmergencia', 'observaciones', 'fotoURL'
  ];

  fields.forEach(field => {
    if (data[field] !== undefined) {
      updateData[field] = typeof data[field] === 'string' ? sanitizeString(data[field]) : data[field];
    }
  });

  if (data.telefono !== undefined) {
    updateData.whatsapp = data.telefono?.trim() || '';
  }

  await updateDoc(doc(db, COLLECTION, id), updateData);
  return getClienteById(id);
}

export async function deleteCliente(id) {
  await deleteDoc(doc(db, COLLECTION, id));
}

export async function updateClienteMembresia(clienteId, membresiaData) {
  const estado = getMembershipStatus(membresiaData.fechaVencimiento);
  await updateDoc(doc(db, COLLECTION, clienteId), {
    membresiaActivaId: membresiaData.id,
    estadoMembresia: estado,
    fechaVencimiento: membresiaData.fechaVencimiento,
    updatedAt: serverTimestamp()
  });
}

export async function getClientesStats() {
  const clientes = await fetchAllClientes();
  const activos = clientes.filter(c => c.estadoMembresia === 'activo').length;
  const vencidos = clientes.filter(c => c.estadoMembresia === 'vencido').length;
  const proximos = clientes.filter(c => c.estadoMembresia === 'proximo_vencer').length;

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const nuevos = clientes.filter(c => {
    const created = c.createdAt?.toDate?.();
    return created && created >= startOfMonth;
  }).length;

  return { total: clientes.length, activos, vencidos, proximos, nuevos };
}

export async function getClientesPorVencer(dias) {
  const clientes = await fetchAllClientes();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(today);
  target.setDate(target.getDate() + dias);

  return clientes
    .filter(c => ['activo', 'proximo_vencer'].includes(c.estadoMembresia))
    .filter(c => {
      if (!c.fechaVencimiento) return false;
      const exp = c.fechaVencimiento.toDate();
      exp.setHours(0, 0, 0, 0);
      if (dias === 0) return exp.getTime() === today.getTime();
      return exp >= today && exp <= target;
    })
    .sort((a, b) => a.fechaVencimiento.toDate() - b.fechaVencimiento.toDate());
}

export async function refreshMembershipStatuses() {
  const clientes = await fetchAllClientes();
  const updates = clientes
    .filter(c => c.fechaVencimiento)
    .map(c => {
      const newStatus = getMembershipStatus(c.fechaVencimiento);
      if (newStatus !== c.estadoMembresia) {
        return updateDoc(doc(db, COLLECTION, c.id), { estadoMembresia: newStatus });
      }
      return null;
    })
    .filter(Boolean);

  await Promise.all(updates);
}

export async function getAllClientes() {
  return sortByNombre(await fetchAllClientes());
}
