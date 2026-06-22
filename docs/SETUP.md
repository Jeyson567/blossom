# Guía de Configuración — Blossom Fitness Club

## 1. Crear proyecto Firebase

1. Ir a [Firebase Console](https://console.firebase.google.com)
2. Crear proyecto: **Blossom Fitness Club**
3. Habilitar **Authentication** → Email/Password
4. Crear base de datos **Firestore** (modo producción)
5. Habilitar **Storage**

## 2. Configurar credenciales

Editar `firebase/firebase-config.js` con los datos de tu proyecto:

```javascript
const firebaseConfig = {
  apiKey: 'TU_API_KEY',
  authDomain: 'TU_PROYECTO.firebaseapp.com',
  projectId: 'TU_PROYECTO',
  storageBucket: 'TU_PROYECTO.appspot.com',
  messagingSenderId: 'TU_MESSAGING_SENDER_ID',
  appId: 'TU_APP_ID'
};
```

## 3. Desplegar reglas de seguridad

```bash
firebase deploy --only firestore:rules
firebase deploy --only storage
firebase deploy --only firestore:indexes
```

Archivos:
- `firebase/firestore.rules`
- `firebase/storage.rules`
- `firestore.indexes.json`

## Instalación desde cero (automática)

1. Configurar `firebase/firebase-config.js` con credenciales de Firebase
2. Habilitar **Authentication** (correo/contraseña) y crear **Firestore**
3. Publicar reglas: `firebase deploy --only firestore:rules`
4. Abrir `index.html` en el navegador
5. Si es el primer arranque, aparece **"Bienvenido a Blossom Fitness Club"**
6. Completar nombre, correo y contraseña del administrador
7. El sistema crea automáticamente:
   - Usuario en Authentication
   - Documento `usuarios/{uid}`
   - `configuracion/general`
   - `configuracion/sistema`
   - 7 planes de membresía por defecto
8. Inicia sesión y comienza a trabajar

**No es necesario** crear colecciones ni documentos manualmente en Firestore.

`setup.html` redirige a `index.html` (onboarding integrado).

## 4. Crear usuario administrador inicial

Tiene **dos opciones**:

### Opción A — Página de configuración inicial (recomendada)

1. Desplegar reglas actualizadas: `firebase deploy --only firestore:rules`
2. Abrir `setup.html` en el navegador
3. Completar el formulario — crea Auth + Firestore automáticamente
4. Iniciar sesión en `index.html`

### Opción B — Firebase Console (manual)

Ver sección 8 abajo para crear Auth y Firestore por separado.

## 5. Crear más usuarios después

Una vez dentro como administrador: menú **Usuarios → Nuevo Usuario**.
La función `registrarUsuarioCompleto()` crea Auth + Firestore en un solo paso.

## 6. Primer acceso

Servir los archivos con cualquier servidor HTTP local:

```bash
# Con Python
python -m http.server 8080

# Con Node (npx)
npx serve .

# Con PHP
php -S localhost:8080
```

Abrir: `http://localhost:8080`

## 6. Primer acceso

1. Ir a `index.html`
2. Iniciar sesión con el usuario administrador
3. Configurar el gimnasio en **Configuración**
4. Crear planes de membresía en **Planes**
5. Crear usuarios de recepción en **Usuarios**

## 7. Roles

| Rol | Permisos |
|-----|----------|
| `admin` | Acceso total al sistema |
| `recepcion` | Clientes, ventas, acceso, pagos, caja, WhatsApp |

## 8. Solución de problemas de login

### Abrir consola (F12) y ejecutar:

```javascript
diagnosticarSistema()
```

### Errores comunes

| Síntoma | Causa | Solución |
|---------|-------|----------|
| "Perfil no configurado" | Usuario en Auth pero sin documento en Firestore | Crear `usuarios/{UID}` con el UID de Authentication como ID del documento |
| "Permiso denegado" | Reglas Firestore no desplegadas | `firebase deploy --only firestore:rules` |
| Documento creado con email como ID | Ruta incorrecta | El ID del documento DEBE ser el UID, no el correo |
| `activo: false` | Cuenta desactivada | Cambiar `activo` a `true` en Firestore |
| Rol inválido | Campo `rol` incorrecto | Usar exactamente `admin` o `recepcion` |
| Login OK pero app no carga | Error post-login en dashboard | Revisar consola; ejecutar `diagnosticarSistema()` |

### Estructura correcta del documento usuario

```
Colección: usuarios
ID del documento: [UID de Firebase Authentication — NO el email]

Campos obligatorios:
  email: "admin@blossomfitness.com"
  nombre: "Administrador"
  rol: "admin"          ← exactamente "admin" o "recepcion"
  activo: true          ← boolean true, no omitir
```

## 9. Notas de producción

- Usar HTTPS obligatorio para cámara QR y Firebase Auth
- Configurar dominio autorizado en Firebase Authentication
- Realizar respaldos periódicos de Firestore
- Monitorear uso de Storage para fotografías de clientes
