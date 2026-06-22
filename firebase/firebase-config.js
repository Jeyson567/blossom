import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
import { getStorage } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-storage.js';

const firebaseConfig = {
  apiKey: 'AIzaSyAcOrYDpYRaVrDZHw-4a2zRwNVGn7i8364',
  authDomain: 'blossom-e0e70.firebaseapp.com',
  databaseURL: 'https://blossom-e0e70-default-rtdb.firebaseio.com',
  projectId: 'blossom-e0e70',
  storageBucket: 'blossom-e0e70.firebasestorage.app',
  messagingSenderId: '420244949189',
  appId: '1:420244949189:web:3327abce0501d14087c8ac'
};

const PLACEHOLDERS = ['TU_API_KEY', 'TU_PROYECTO', 'TU_MESSAGING_SENDER_ID', 'TU_APP_ID'];

export function isFirebaseConfigured() {
  return !PLACEHOLDERS.some(ph =>
    Object.values(firebaseConfig).some(v => typeof v === 'string' && v.includes(ph))
  );
}

export function getFirebaseConfigError() {
  if (!firebaseConfig.apiKey?.startsWith('AIza')) {
    return 'Firebase no está configurado. Edite firebase/firebase-config.js con su apiKey real.';
  }
  if (!firebaseConfig.projectId || firebaseConfig.projectId === 'TU_PROYECTO') {
    return 'Firebase no está configurado. Reemplace projectId en firebase/firebase-config.js.';
  }
  return null;
}

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

console.log('[BFC Boot] ① Firebase inicializado', {
  projectId: firebaseConfig.projectId,
  authDomain: firebaseConfig.authDomain
});

export { app, auth, db, storage, firebaseConfig };
export default app;
