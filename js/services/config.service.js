import { doc, getDoc, setDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
import { db } from '../../firebase/firebase-config.js';

const DOC_ID = 'general';

const DEFAULT_CONFIG = {
  nombreGimnasio: 'Blossom Fitness Club',
  logoURL: '',
  telefono: '',
  direccion: '',
  redesSociales: {
    facebook: '',
    instagram: '',
    tiktok: '',
    youtube: ''
  },
  diasAlertaVencimiento: [7, 3, 0]
};

export async function getConfig() {
  try {
    const docSnap = await getDoc(doc(db, 'configuracion', DOC_ID));
    if (!docSnap.exists()) {
      console.log('[BFC Config] Documento configuracion/general no existe, usando valores por defecto');
      return { ...DEFAULT_CONFIG };
    }
    return { ...DEFAULT_CONFIG, ...docSnap.data() };
  } catch (error) {
    console.warn('[BFC Config] Error leyendo configuración, usando valores por defecto:', error.code, error.message);
    return { ...DEFAULT_CONFIG };
  }
}

export async function initConfigIfAdmin() {
  const docSnap = await getDoc(doc(db, 'configuracion', DOC_ID));
  if (!docSnap.exists()) {
    await setDoc(doc(db, 'configuracion', DOC_ID), {
      ...DEFAULT_CONFIG,
      createdAt: serverTimestamp()
    });
  }
}

export async function updateConfig(data) {
  const updateData = {
    ...data,
    updatedAt: serverTimestamp()
  };
  await setDoc(doc(db, 'configuracion', DOC_ID), updateData, { merge: true });
  return getConfig();
}

export async function getGymName() {
  const config = await getConfig();
  return config.nombreGimnasio;
}
