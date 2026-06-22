import { doc, getDoc, collection, query, limit, getDocs } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
import { app, auth, db } from '../../firebase/firebase-config.js';
import { loadUserData } from '../auth.js';
import { ROLES } from './constants.js';

/**
 * Diagnóstico automático del sistema de autenticación y acceso.
 * Ejecutar desde consola: diagnosticarSistema()
 */
export async function diagnosticarSistema() {
  console.group('[BFC] Diagnóstico del sistema');
  const results = [];

  function report(step, ok, reason = '') {
    results.push({ paso: step, ok, motivo: reason || 'OK' });
    const icon = ok ? '✅' : '❌';
    console.log(`${icon} ${step}${reason ? ': ' + reason : ''}`);
  }

  // 1. Firebase conectado
  try {
    if (app?.name && auth && db) {
      report('Firebase conectado', true);
      console.log('   Proyecto:', app.options?.projectId);
    } else {
      report('Firebase conectado', false, 'Instancias no inicializadas');
    }
  } catch (e) {
    report('Firebase conectado', false, e.message);
  }

  // 2. Usuario autenticado
  const user = auth.currentUser;
  if (user) {
    report('Usuario autenticado', true);
    console.log('   UID:', user.uid);
    console.log('   Email:', user.email);
  } else {
    report('Usuario autenticado', false, 'No hay sesión activa');
    console.groupEnd();
    console.table(results);
    return results;
  }

  // 3. Documento Firestore
  const profileResult = await loadUserData(user.uid);
  if (profileResult.status === 'ok') {
    report('Perfil de usuario', true, user.uid);
  } else if (profileResult.status === 'not_found') {
    report('Perfil de usuario', false, 'Cuenta sin configurar. Use la configuración inicial o contacte al administrador.');
  } else if (profileResult.status === 'permission_denied') {
    report('Perfil de usuario', false, 'Sin permisos de acceso. Verifique la configuración de Firebase.');
  } else {
    report('Documento Firestore existente', false, profileResult.status);
  }

  // 4. Rol válido
  if (profileResult.status === 'ok') {
    const rol = profileResult.data.rol;
    if ([ROLES.ADMIN, ROLES.RECEPCION].includes(rol)) {
      report('Rol válido', true, rol);
    } else {
      report('Rol válido', false, `Rol "${rol}" no es admin ni recepcion`);
    }
  } else {
    report('Rol válido', false, 'No se pudo leer el perfil');
  }

  // 5. Permisos — configuración
  try {
    await getDoc(doc(db, 'configuracion', 'general'));
    report('Permisos — configuración', true);
  } catch (e) {
    report('Permisos — configuración', false, e.message);
  }

  // 6. Permisos — clientes (dashboard)
  try {
    await getDocs(query(collection(db, 'clientes'), limit(1)));
    report('Dashboard accesible (consulta clientes)', true);
  } catch (e) {
    report('Dashboard accesible (consulta clientes)', false, e.message);
  }

  // 7. Permisos — pagos (dashboard)
  try {
    await getDocs(query(collection(db, 'pagos'), limit(1)));
    report('Dashboard accesible (consulta pagos)', true);
  } catch (e) {
    report('Dashboard accesible (consulta pagos)', false, e.message);
  }

  const failed = results.filter(r => !r.ok);
  if (failed.length === 0) {
    console.log('\n✅ Sistema operativo. Todos los chequeos pasaron.');
  } else {
    console.log(`\n❌ ${failed.length} problema(s) detectado(s). Revise la tabla inferior.`);
  }

  console.table(results);
  console.groupEnd();
  return results;
}

if (typeof window !== 'undefined') {
  window.diagnosticarSistema = diagnosticarSistema;
}
