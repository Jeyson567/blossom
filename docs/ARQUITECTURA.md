# Blossom Fitness Club — Arquitectura del Sistema

## 1. Visión General

Sistema web SPA (Single Page Application) con JavaScript vanilla ES6+, TailwindCSS vía CDN, y Firebase como BaaS. Arquitectura en capas: **Presentación → Servicios → Firebase**.

```
┌─────────────────────────────────────────────────────────┐
│  PRESENTACIÓN (pages/, components/)                       │
│  HTML dinámico, eventos, validación UI                  │
├─────────────────────────────────────────────────────────┤
│  SERVICIOS (services/)                                    │
│  Lógica de negocio, consultas Firestore, Storage          │
├─────────────────────────────────────────────────────────┤
│  UTILIDADES (utils/)                                      │
│  Helpers, formatters, validators, permisos                │
├─────────────────────────────────────────────────────────┤
│  FIREBASE (firebase/)                                     │
│  Auth, Firestore, Storage — configuración centralizada    │
└─────────────────────────────────────────────────────────┘
```

## 2. Estructura de Carpetas

```
blossom gym/
├── index.html                 # Login
├── app.html                   # Shell principal (sidebar + router)
├── docs/
│   └── ARQUITECTURA.md
├── assets/
│   └── images/
│       └── logo-default.svg
├── css/
│   ├── variables.css          # Tokens de diseño
│   ├── base.css               # Reset y tipografía
│   ├── components.css         # Componentes UI
│   └── layout.css             # Sidebar, header, grid
├── firebase/
│   ├── firebase-config.js     # Inicialización centralizada
│   └── firestore.rules        # Reglas de seguridad
├── js/
│   ├── app.js                 # Bootstrap de la aplicación
│   ├── router.js              # Navegación hash-based
│   ├── auth.js                # Autenticación y sesión
│   ├── components/
│   │   ├── sidebar.js
│   │   ├── header.js
│   │   ├── data-table.js
│   │   ├── modal.js
│   │   ├── pagination.js
│   │   ├── search-filter.js
│   │   └── charts.js
│   ├── pages/
│   │   ├── dashboard.js
│   │   ├── clientes.js
│   │   ├── cliente-perfil.js
│   │   ├── planes.js
│   │   ├── venta-membresia.js
│   │   ├── acceso.js
│   │   ├── whatsapp.js
│   │   ├── pagos.js
│   │   ├── caja.js
│   │   ├── inventario.js
│   │   ├── reportes.js
│   │   ├── configuracion.js
│   │   └── usuarios.js
│   ├── services/
│   │   ├── clientes.service.js
│   │   ├── membresias.service.js
│   │   ├── planes.service.js
│   │   ├── pagos.service.js
│   │   ├── accesos.service.js
│   │   ├── inventario.service.js
│   │   ├── caja.service.js
│   │   ├── config.service.js
│   │   ├── usuarios.service.js
│   │   ├── whatsapp.service.js
│   │   ├── medidas.service.js
│   │   ├── notificaciones.service.js
│   │   └── storage.service.js
│   ├── utils/
│   │   ├── constants.js
│   │   ├── helpers.js
│   │   ├── validators.js
│   │   ├── formatters.js
│   │   └── permissions.js
│   └── reports/
│       ├── pdf-export.js
│       └── excel-export.js
└── firestore.indexes.json
```

## 3. Diseño Firestore

### Colección: `usuarios`
| Campo | Tipo | Descripción |
|-------|------|-------------|
| uid | string | ID = Firebase Auth UID |
| email | string | Correo |
| nombre | string | Nombre completo |
| rol | string | `admin` \| `recepcion` |
| activo | boolean | Estado del usuario |
| createdAt | timestamp | |
| updatedAt | timestamp | |

### Colección: `clientes`
| Campo | Tipo | Descripción |
|-------|------|-------------|
| nombreCompleto | string | |
| dpi | string | Único |
| fechaNacimiento | string | ISO date |
| genero | string | |
| telefono, whatsapp, correo | string | |
| direccion | string | |
| contactoEmergencia, telefonoEmergencia | string | |
| observaciones | string | |
| fotoURL | string | Storage URL |
| pesoInicial, pesoActual, altura | number | |
| imc | number | Calculado |
| metaFisica | string | |
| qrCode | string | Código único permanente |
| membresiaActivaId | string \| null | Ref membresía activa |
| estadoMembresia | string | `activo` \| `proximo_vencer` \| `vencido` \| `sin_membresia` |
| fechaVencimiento | timestamp \| null | |
| createdAt, updatedAt | timestamp | |
| createdBy | string | UID usuario |

### Colección: `planes`
| Campo | Tipo | Descripción |
|-------|------|-------------|
| nombre | string | |
| precio | number | |
| duracionDias | number | |
| descripcion | string | |
| activo | boolean | |
| createdAt, updatedAt | timestamp | |

### Colección: `membresias`
| Campo | Tipo | Descripción |
|-------|------|-------------|
| clienteId | string | |
| clienteNombre | string | Denormalizado |
| planId | string | |
| planNombre | string | |
| precio | number | |
| fechaInicio | timestamp | |
| fechaVencimiento | timestamp | |
| estado | string | `activa` \| `vencida` \| `renovada` |
| qrCode | string | |
| vendidoPor | string | UID |
| vendidoPorNombre | string | |
| createdAt | timestamp | |

### Colección: `pagos`
| Campo | Tipo | Descripción |
|-------|------|-------------|
| clienteId | string \| null | |
| clienteNombre | string | |
| concepto | string | |
| tipo | string | `membresia` \| `inscripcion` \| `producto` \| `otro` |
| monto | number | |
| metodoPago | string | `efectivo` \| `transferencia` \| `tarjeta` \| `qr` |
| usuarioId, usuarioNombre | string | |
| membresiaId, productoId | string \| null | |
| fecha | timestamp | |
| createdAt | timestamp | |

### Colección: `accesos`
| Campo | Tipo | Descripción |
|-------|------|-------------|
| clienteId, clienteNombre | string | |
| membresiaId | string | |
| estado | string | `permitido` \| `proximo_vencer` \| `vencido` |
| fecha | timestamp | |
| escaneadoPor | string | UID |

### Colección: `productos`
| Campo | Tipo | Descripción |
|-------|------|-------------|
| codigo | string | Único |
| nombre, categoria | string | |
| stock, stockMinimo | number | |
| precioCompra, precioVenta | number | |
| activo | boolean | |
| createdAt, updatedAt | timestamp | |

### Colección: `movimientosInventario`
| Campo | Tipo | Descripción |
|-------|------|-------------|
| productoId, productoNombre | string | |
| tipo | string | `entrada` \| `salida` |
| cantidad | number | |
| motivo | string | |
| usuarioId, usuarioNombre | string | |
| fecha | timestamp | |

### Colección: `cajas`
| Campo | Tipo | Descripción |
|-------|------|-------------|
| fecha | timestamp | |
| usuarioId, usuarioNombre | string | |
| montoInicial | number | |
| estado | string | `abierta` \| `cerrada` |
| cierre | map | totales al cerrar |
| createdAt, cerradaAt | timestamp | |

**Subcolección:** `cajas/{id}/movimientos`

### Colección: `medidasCorporales`
| Campo | Tipo | Descripción |
|-------|------|-------------|
| clienteId | string | |
| peso, altura, imc | number | |
| notas | string | |
| fecha | timestamp | |
| registradoPor | string | |

### Colección: `notificaciones`
| Campo | Tipo | Descripción |
|-------|------|-------------|
| clienteId, clienteNombre | string | |
| whatsapp | string | |
| tipo | string | `7dias` \| `3dias` \| `vencimiento` \| `vencida` \| `manual` |
| mensaje | string | |
| estado | string | `pendiente` \| `enviado` |
| fechaProgramada | timestamp | |
| fechaEnviado | timestamp \| null | |

### Colección: `configuracion`
Documento único: `general`
| Campo | Tipo |
|-------|------|
| nombreGimnasio | string |
| logoURL | string |
| telefono, direccion | string |
| redesSociales | map |
| diasAlertaVencimiento | array |

### Colección: `sucursales`
| Campo | Tipo |
|-------|------|
| nombre, direccion, telefono | string |
| activa | boolean |

## 4. Índices Compuestos

Ver `firestore.indexes.json` para índices de:
- clientes: estadoMembresia + fechaVencimiento
- pagos: fecha (desc)
- accesos: fecha (desc)
- membresias: clienteId + estado
- notificaciones: estado + fechaProgramada

## 5. Flujo de Navegación

```
index.html (Login)
    │
    ├─ Auth OK ──► app.html#dashboard
    │
    └─ Auth Fail ──► Mensaje error

app.html (Router hash)
    ├── #dashboard          [admin, recepcion]
    ├── #clientes           [admin, recepcion]
    ├── #cliente/:id        [admin, recepcion]
    ├── #planes             [admin]
    ├── #venta              [admin, recepcion]
    ├── #acceso             [admin, recepcion]
    ├── #pagos              [admin, recepcion]
    ├── #caja               [admin, recepcion]
    ├── #inventario         [admin]
    ├── #reportes           [admin]
    ├── #whatsapp           [admin, recepcion]
    ├── #configuracion      [admin]
    └── #usuarios           [admin]
```

## 6. Mapa de Módulos

| Módulo | Servicio | Página | Roles |
|--------|----------|--------|-------|
| Auth | auth.js | index.html | Todos |
| Dashboard | múltiples | dashboard.js | admin, recepcion |
| Clientes | clientes.service | clientes.js | admin, recepcion |
| Perfil | clientes + medidas | cliente-perfil.js | admin, recepcion |
| Planes | planes.service | planes.js | admin |
| Venta | membresias + pagos | venta-membresia.js | admin, recepcion |
| Acceso | accesos.service | acceso.js | admin, recepcion |
| Pagos | pagos.service | pagos.js | admin, recepcion |
| Caja | caja.service | caja.js | admin, recepcion |
| Inventario | inventario.service | inventario.js | admin |
| Reportes | múltiples + reports | reportes.js | admin |
| WhatsApp | whatsapp.service | whatsapp.js | admin, recepcion |
| Config | config.service | configuracion.js | admin |
| Usuarios | usuarios.service | usuarios.js | admin |

## 7. Diseño UI/UX

### Paleta
- `--color-bg-primary`: #0a0a0a (negro profundo)
- `--color-bg-secondary`: #141414
- `--color-bg-card`: #1a1a1a
- `--color-gold`: #c9a227 (dorado elegante)
- `--color-gold-light`: #e8c547
- `--color-text-primary`: #ffffff
- `--color-text-secondary`: #a3a3a3
- `--color-border`: #2a2a2a
- Estados: verde #22c55e, amarillo #eab308, rojo #ef4444

### Componentes
- Sidebar fija 260px, colapsable en móvil
- Header con breadcrumb y usuario
- Cards con borde sutil dorado
- Tablas con hover, paginación, búsqueda instantánea
- Modales para formularios
- SweetAlert2 para confirmaciones
- Animaciones CSS transition 200ms

## 8. Plan de Implementación

| Fase | Entregables |
|------|-------------|
| 1 | Firebase config, CSS, auth, router, layout |
| 2 | Servicios Firestore completos |
| 3 | Dashboard + Clientes + Perfil |
| 4 | Planes + Venta membresía + QR |
| 5 | Acceso + Pagos + Caja |
| 6 | Inventario + Reportes |
| 7 | WhatsApp + Config + Usuarios |
