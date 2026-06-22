import {
  collection, doc, getDocs, setDoc, updateDoc, deleteDoc,
  query, where, orderBy, Timestamp, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
import { db } from '../../firebase/firebase-config.js';
import { formatDate, formatCurrency } from '../utils/formatters.js';
import { buildWhatsAppUrl } from '../utils/helpers.js';
import { getConfig } from './config.service.js';

const COLLECTION = 'notificaciones';

const MESSAGE_TEMPLATES = {
  '7dias': (cliente, config, fechaVenc) =>
    `¡Hola ${cliente.nombreCompleto.split(' ')[0]}! 👋\n\nTe recordamos que tu membresía en *${config.nombreGimnasio}* vence el *${formatDate(fechaVenc)}*.\n\n¡Renueva a tiempo y sigue entrenando con nosotros! 💪`,

  '3dias': (cliente, config, fechaVenc) =>
    `¡Hola ${cliente.nombreCompleto.split(' ')[0]}! ⏰\n\nTu membresía en *${config.nombreGimnasio}* vence en *3 días* (${formatDate(fechaVenc)}).\n\nNo pierdas tu progreso, renueva hoy. ¡Te esperamos!`,

  'vencimiento': (cliente, config) =>
    `¡Hola ${cliente.nombreCompleto.split(' ')[0]}!\n\nTu membresía en *${config.nombreGimnasio}* *vence hoy*.\n\nPasa por recepción para renovar y continuar disfrutando de nuestras instalaciones.`,

  'vencida': (cliente, config) =>
    `¡Hola ${cliente.nombreCompleto.split(' ')[0]}! 😊\n\nNotamos que tu membresía en *${config.nombreGimnasio}* ha vencido.\n\n¡Te extrañamos! Vuelve a entrenar con nosotros. Tenemos planes especiales para ti.`,

  'renovacion_especial': (cliente, config) =>
    `¡Hola ${cliente.nombreCompleto.split(' ')[0]}! 🌟\n\nEn *${config.nombreGimnasio}* tenemos una promoción especial de renovación para ti.\n\n¡Vuelve a entrenar con nosotros! Pasa por recepción o escríbenos para más detalles. 💪`
};

export async function scheduleNotificationsForClient(cliente, fechaVencimiento) {
  const config = await getConfig();
  const expDate = fechaVencimiento instanceof Date ? fechaVencimiento : fechaVencimiento.toDate();

  const schedules = [
    { tipo: '7dias', daysBefore: 7 },
    { tipo: '3dias', daysBefore: 3 },
    { tipo: 'vencimiento', daysBefore: 0 },
    { tipo: 'vencida', daysBefore: -1 }
  ];

  for (const schedule of schedules) {
    const fechaProgramada = new Date(expDate);
    fechaProgramada.setDate(fechaProgramada.getDate() - schedule.daysBefore);
    fechaProgramada.setHours(9, 0, 0, 0);

    const mensaje = MESSAGE_TEMPLATES[schedule.tipo](cliente, config, expDate);

    const notifData = {
      clienteId: cliente.id,
      clienteNombre: cliente.nombreCompleto,
      whatsapp: cliente.whatsapp,
      tipo: schedule.tipo,
      mensaje,
      estado: 'pendiente',
      fechaProgramada: Timestamp.fromDate(fechaProgramada),
      fechaEnviado: null,
      createdAt: serverTimestamp()
    };

    const docRef = doc(collection(db, COLLECTION));
    await setDoc(docRef, notifData);
  }
}

export async function getNotificaciones(options = {}) {
  const { estado, page = 1, perPage = 15 } = options;
  const notifs = await getAllNotificaciones();

  let filtered = notifs;
  if (estado && estado !== 'todos') {
    filtered = notifs.filter(n => n.estado === estado);
  }

  const total = filtered.length;
  const start = (page - 1) * perPage;
  return { data: filtered.slice(start, start + perPage), total, page, perPage };
}

export async function getAllNotificaciones() {
  const snapshot = await getDocs(collection(db, COLLECTION));
  return snapshot.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (b.fechaProgramada?.toMillis?.() || 0) - (a.fechaProgramada?.toMillis?.() || 0));
}

export async function getNotificacionesPendientes() {
  const now = Timestamp.fromDate(new Date());
  const q = query(
    collection(db, COLLECTION),
    where('estado', '==', 'pendiente'),
    where('fechaProgramada', '<=', now),
    orderBy('fechaProgramada')
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function marcarEnviada(id) {
  await updateDoc(doc(db, COLLECTION, id), {
    estado: 'enviado',
    fechaEnviado: serverTimestamp()
  });
}

export async function enviarManual(cliente, mensaje) {
  const notifData = {
    clienteId: cliente.id,
    clienteNombre: cliente.nombreCompleto,
    whatsapp: cliente.whatsapp,
    tipo: 'manual',
    mensaje,
    estado: 'enviado',
    fechaProgramada: Timestamp.fromDate(new Date()),
    fechaEnviado: serverTimestamp(),
    createdAt: serverTimestamp()
  };

  const docRef = doc(collection(db, COLLECTION));
  await setDoc(docRef, notifData);
  return { id: docRef.id, ...notifData, whatsappUrl: buildWhatsAppUrl(cliente.whatsapp, mensaje) };
}

export function getWhatsAppUrl(notificacion) {
  return buildWhatsAppUrl(notificacion.whatsapp, notificacion.mensaje);
}

export async function deleteNotificacion(id) {
  await deleteDoc(doc(db, COLLECTION, id));
}

export function generateMessagePreview(tipo, cliente, config, fechaVenc) {
  const template = MESSAGE_TEMPLATES[tipo];
  if (!template) return '';
  return template(cliente, config, fechaVenc);
}
