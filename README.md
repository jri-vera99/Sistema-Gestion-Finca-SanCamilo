# Sistema de Gestión — Finca Agroecológica San Camilo
## Ambuquí, Ecuador

Sistema web de gestión agroecológica para apiario, producción de frutas y hospedaje rural.

---

## Estructura del Proyecto

```
Sistema-Gestion-Citrus/
│
├── backend/
│   ├── app.js                        — Servidor Express principal
│   ├── db.js                         — Pool MySQL (Railway)
│   ├── package.json                  — Dependencias
│   ├── .env.example                  — Variables de entorno (plantilla)
│   │
│   ├── middlewares/
│   │   ├── auth.js                   — Validación JWT
│   │   ├── permiso.js                — Control de acceso por módulo
│   │   └── auditoria.js              — Logging de acciones
│   │
│   └── routes/
│       ├── auth/auth.js              — Login, whoami, cambio de contraseña
│       ├── public/
│       │   ├── productos.js          — Catálogo público
│       │   ├── hospedaje.js          — Disponibilidad pública
│       │   └── solicitudes.js        — Formularios del portal + galería
│       └── intranet/
│           ├── dashboard.js          — KPIs y alertas
│           ├── colmenas.js           — Gestión apiario + simulación
│           ├── monitoreo.js          — Sensores + endpoint IoT (ESP32)
│           ├── usuarios.js           — CRUD usuarios y roles
│           ├── solicitudes.js        — Gestión solicitudes internas
│           └── auditoria.js          — Logs de auditoría
│
├── frontend/
│   ├── public/                       — Portal público (turístico/comercial)
│   │   ├── index.html                — Página de inicio
│   │   ├── reservar.html             — Solicitud de reserva/compra
│   │   └── assets/
│   │       ├── css/public.css        — Estilos portal público
│   │       └── js/public.js          — Lógica del portal
│   │
│   └── intranet/                     — Panel administrativo
│       ├── login.html                — Acceso interno
│       ├── dashboard.html            — Dashboard con KPIs y gráficos
│       ├── colmenas.html             — Apiario con mapa Leaflet
│       └── assets/
│           ├── css/intranet.css      — Estilos panel admin
│           └── js/
│               ├── auth.js           — Sesión JWT + sidebar dinámico
│               └── api.js            — Cliente HTTP + utilidades
│
└── migrations/
    └── 001_sistema_completo.sql      — Migración incremental de BD
```

---

## Base de Datos (Railway MySQL)

### Tablas originales (sin modificar estructura principal)
`Roles`, `Usuarios`, `Colmenas`, `Monitoreo_Colmena`, `Cosechas`,
`Tipo_Fruta`, `Inventario_Frutas`, `Clientes`, `Habitaciones`,
`Servicios`, `Reservas`, `Reserva_Servicio`

### Tablas nuevas agregadas por migración
`Modulos`, `Permisos`, `Rol_Modulo_Permiso`, `Usuario_Permiso_Extra`,
`Configuracion_Modo`, `Dispositivos_IoT`, `Alertas`, `Auditoria`,
`Productos`, `Solicitudes_Publicas`, `Solicitud_Detalle`, `Pagos`,
`Tickets_Mantenimiento`, `Galeria`

---

## Instalación

### 1. Configurar variables de entorno

```powershell
cd backend
copy .env.example .env
```

Edita `.env`:

```env
DB_HOST=tu-host.railway.app
DB_PORT=3306
DB_USER=root
DB_PASSWORD=tu_password_aqui
DB_NAME=railway
PORT=3000
JWT_SECRET=genera_una_clave_larga_y_aleatoria_aqui
JWT_EXPIRES_IN=8h
```

### 2. Instalar dependencias

```powershell
cd backend
npm install
```

### 3. Ejecutar migración SQL en Railway

Abre el panel SQL de Railway (o DBeaver/TablePlus) y ejecuta el contenido
completo de `migrations/001_sistema_completo.sql`.

> La migración es idempotente (usa `IF NOT EXISTS`) — puede ejecutarse de nuevo
> sin riesgo. No elimina tablas ni datos existentes.

### 4. Iniciar el servidor

```powershell
cd backend
node app.js
```

---

## Accesos

| Destino | URL |
|---------|-----|
| Portal público | http://localhost:3000/ |
| Solicitar reserva | http://localhost:3000/reservar.html |
| Login intranet | http://localhost:3000/intranet/login.html |
| Dashboard | http://localhost:3000/intranet/dashboard.html |
| Apiario / Colmenas | http://localhost:3000/intranet/colmenas.html |
| Health check API | http://localhost:3000/api/health |


## Enlaces del sistema desplegado

- Portal público: https://sistema-gestion-finca-sancamilo-production.up.railway.app/
- Intranet administrativa: https://sistema-gestion-finca-sancamilo-production.up.railway.app/intranet/login.html
- Repositorio GitHub: https://github.com/jri-vera99/Sistema-Gestion-Finca-SanCamilo

> Cambia la contraseña en tu primer inicio de sesión desde el panel.

---

## Referencia de API

### Públicas (sin autenticación)

```
GET  /api/public/productos            Catálogo de productos
GET  /api/public/hospedaje            Habitaciones disponibles
POST /api/public/solicitudes          Enviar solicitud pública
GET  /api/public/solicitudes/galeria  Galería de imágenes
```

### Autenticación

```
POST /api/auth/login                  { correo, contrasena } → JWT
GET  /api/auth/me                     Datos de sesión actual (requiere JWT)
POST /api/auth/cambiar-contrasena     { contrasena_actual, nueva_contrasena }
```

### Intranet (requieren JWT en header Authorization: Bearer <token>)

```
GET  /api/intranet/dashboard          KPIs generales
GET  /api/intranet/dashboard/alertas  Alertas no leídas
GET  /api/intranet/colmenas           Lista colmenas (acepta ?modo=real|simulado)
POST /api/intranet/colmenas           Crear colmena
PUT  /api/intranet/colmenas/:id       Actualizar colmena
DELETE /api/intranet/colmenas/:id     Desactivar colmena
POST /api/intranet/colmenas/simular   { cantidad, subsimulacion? }
GET  /api/intranet/monitoreo/:id      Lecturas de colmena (acepta ?horas=24)
POST /api/intranet/monitoreo/lectura  Endpoint IoT (usa X-Device-Token en header)
GET  /api/intranet/usuarios           Lista usuarios
POST /api/intranet/usuarios           Crear usuario
PUT  /api/intranet/usuarios/:id       Actualizar usuario
DELETE /api/intranet/usuarios/:id     Desactivar usuario
GET  /api/intranet/solicitudes        Solicitudes públicas (acepta ?estado=pendiente)
PUT  /api/intranet/solicitudes/:id    Actualizar estado/asignación
GET  /api/intranet/auditoria          Logs de auditoría (acepta ?modulo, ?id_usuario)
GET  /api/health                      Estado del servidor y BD
```

### Endpoint IoT para ESP32

```
POST /api/intranet/monitoreo/lectura
Headers: X-Device-Token: <token_del_dispositivo>
Body: { "id_colmena": 1, "temperatura": 35.2, "humedad": 65.1 }
```

El dispositivo debe estar registrado en la tabla `Dispositivos_IoT` con su `token_api`.
Genera alertas automáticas si la temperatura está fuera del rango 30–40 °C.

---

## Seguridad

- Contraseñas con bcrypt (cost factor 12)
- JWT con expiración configurable (default 8h)
- Permisos validados en backend (no solo en frontend)
- Superadmin indestructible: campo `es_superadmin = 1`
- Archivos `.env` no deben subirse a repositorios
- CORS configurado — ajustar en producción a dominio específico

---

## Paleta Visual

| Rol | Color |
|-----|-------|
| Verde olivo (primario) | `#5C6B3A` |
| Verde bosque (sidebar) | `#2D3524` |
| Dorado miel (acento) | `#C9963D` |
| Crema cálido (fondo público) | `#FAF7F0` |
| Café tierra (texto) | `#2C2416` |
| Naranja cítrico | `#E8873A` |

---

*Sistema de gestión propietario — Finca Agroecológica San Camilo, Ambuquí, Ecuador*
