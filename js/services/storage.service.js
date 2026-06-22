import { ref, uploadBytes, getDownloadURL, deleteObject } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-storage.js';
import { storage } from '../../firebase/firebase-config.js';

export async function uploadClientPhoto(file, clienteId) {
  const extension = file.name.split('.').pop();
  const path = `clientes/${clienteId}/foto.${extension}`;
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, file);
  return getDownloadURL(storageRef);
}

export async function uploadLogo(file) {
  const extension = file.name.split('.').pop();
  const path = `configuracion/logo.${extension}`;
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, file);
  return getDownloadURL(storageRef);
}

export async function deleteFile(filePath) {
  try {
    const storageRef = ref(storage, filePath);
    await deleteObject(storageRef);
  } catch {
    // File may not exist
  }
}

export function validateImageFile(file) {
  const allowed = ['image/jpeg', 'image/png', 'image/webp'];
  if (!allowed.includes(file.type)) {
    return 'Formato no permitido. Use JPG, PNG o WebP';
  }
  if (file.size > 5 * 1024 * 1024) {
    return 'La imagen no debe superar 5MB';
  }
  return null;
}
