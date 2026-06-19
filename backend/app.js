// ================================================================
// app.js — Servidor principal — Finca Agroecológica San Camilo
// Sistema de gestión de apiario, productos y hospedaje — Ambuquí
// ================================================================
//
// RUTAS PÚBLICAS (sin autenticación):
//   GET  /api/public/productos
//   GET  /api/public/hospedaje
//   POST /api/public/solicitudes
//   POST /api/public/solicitudes/galeria
//
// AUTENTICACIÓN:
//   POST /api/auth/login
//   GET  /api/auth/me
//   POST /api/auth/cambiar-contrasena
//
// INTRANET (requieren JWT):
//   /api/intranet/dashboard
//   /api/intranet/colmenas        (+ /simular, /:id/alertas)
//   /api/intranet/monitoreo       (incluye endpoint IoT por X-Device-Token)
//   /api/intranet/usuarios
//   /api/intranet/solicitudes
//   /api/intranet/auditoria
//
//   Rutas heredadas (compatibilidad con código anterior):
//   /api/cosechas, /api/reservas, /api/inventario_frutas, /api/clientes
//
// ESTADO:
//   GET /api/health
// ================================================================

require('dotenv').config();

const express    = require('express');
const cors       = require('cors');
const bodyParser = require('body-parser');
const path       = require('path');
const fs         = require('fs');

const { testConnection } = require('./db');

// ── Rutas de autenticación ──────────────────────────────────────
const authRouter = require('./routes/auth/auth');

// ── Rutas públicas (sin JWT) ────────────────────────────────────
const publicProductosRouter  = require('./routes/public/productos');
const publicHospedajeRouter  = require('./routes/public/hospedaje');
const publicSolicitudesRouter= require('./routes/public/solicitudes');

// ── Rutas intranet (requieren JWT — se valida en cada router) ───
const dashboardRouter   = require('./routes/intranet/dashboard');
const colmenasRouter    = require('./routes/intranet/colmenas');
const monitoreoRouter   = require('./routes/intranet/monitoreo');
const usuariosRouter    = require('./routes/intranet/usuarios');
const permisosRouter    = require('./routes/intranet/permisos');
const configuracionRouter = require('./routes/intranet/configuracion');
const solicitudesRouter = require('./routes/intranet/solicitudes');
const auditoriaRouter   = require('./routes/intranet/auditoria');
const intranetCosechasRouter = require('./routes/intranet/cosechas');
const intranetInventarioRouter = require('./routes/intranet/inventario_frutas');
const intranetHospedajeRouter = require('./routes/intranet/hospedaje');
const intranetClientesRouter = require('./routes/intranet/clientes');
const intranetDispositivosRouter = require('./routes/intranet/dispositivos');
const intranetReportesRouter = require('./routes/intranet/reportes');

// ── Rutas heredadas (compatibilidad) ────────────────────────────
const cosechasRouter        = require('./routes/cosechas');
const reservasRouter        = require('./routes/reservas');
const inventarioRouter      = require('./routes/inventario_frutas');
const clientesRouter        = require('./routes/clientes');

// ================================================================
const app  = express();
const PORT = process.env.PORT || 3000;

// ── Crear carpeta de uploads si no existe ───────────────────────
const uploadDir = process.env.UPLOAD_DIR || './uploads';
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

// ================================================================
// Middlewares globales
// ================================================================
app.use(cors({ origin: '*', methods: ['GET','POST','PUT','DELETE','OPTIONS'], allowedHeaders: ['Content-Type','Authorization','X-Device-Token'] }));
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));

// Servir archivos subidos (comprobantes)
app.use('/uploads', express.static(path.join(__dirname, uploadDir)));

// Servir portal público desde frontend/public/
app.use('/', express.static(path.join(__dirname, '../frontend/public')));

// Servir intranet desde frontend/intranet/ (bajo /intranet/)
app.use('/intranet', express.static(path.join(__dirname, '../frontend/intranet')));

// ================================================================
// Rutas API
// ================================================================

// Auth
app.use('/api/auth',              authRouter);

// Público
app.use('/api/public/productos',  publicProductosRouter);
app.use('/api/public/hospedaje',  publicHospedajeRouter);
app.use('/api/public/solicitudes',publicSolicitudesRouter);

// Intranet
app.use('/api/intranet/dashboard',   dashboardRouter);
app.use('/api/intranet/colmenas',    colmenasRouter);
app.use('/api/intranet/monitoreo',   monitoreoRouter);
app.use('/api/intranet/usuarios',    usuariosRouter);
app.use('/api/intranet/permisos',    permisosRouter);
app.use('/api/intranet/configuracion', configuracionRouter);
app.use('/api/intranet/solicitudes', solicitudesRouter);
app.use('/api/intranet/auditoria',   auditoriaRouter);
app.use('/api/intranet/cosechas', intranetCosechasRouter);
app.use('/api/intranet/inventario_frutas', intranetInventarioRouter);
app.use('/api/intranet/hospedaje', intranetHospedajeRouter);
app.use('/api/intranet/clientes', intranetClientesRouter);
app.use('/api/intranet/dispositivos', intranetDispositivosRouter);
app.use('/api/intranet/reportes', intranetReportesRouter);

// Compatibilidad con rutas anteriores
app.use('/api/cosechas',         cosechasRouter);
app.use('/api/reservas',         reservasRouter);
app.use('/api/inventario_frutas',inventarioRouter);
app.use('/api/clientes',         clientesRouter);

// ================================================================
// GET /api/health — Estado del sistema
// ================================================================
app.get('/api/health', async (req, res) => {
  try {
    const { pool } = require('./db');
    const [version] = await pool.query('SELECT VERSION() AS v');
    res.json({
      success:    true,
      sistema:    'Finca Agroecológica San Camilo',
      ubicacion:  'Ambuquí, Ecuador',
      version:    '2.0.0',
      db_version: version[0].v,
      timestamp:  new Date().toISOString()
    });
  } catch (err) {
    res.status(503).json({
      success: false,
      error:   'Conexión con la base de datos no disponible.',
      detalle: err.message
    });
  }
});

// ================================================================
// SPA fallback — /intranet/* → intranet/login.html
// Permite navegación directa a páginas de la intranet
// ================================================================
app.get('/intranet/*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/intranet/login.html'));
});

// ================================================================
// 404
// ================================================================
app.use((req, res) => {
  res.status(404).json({ success: false, error: `Ruta no encontrada: ${req.method} ${req.originalUrl}` });
});

// ================================================================
// Error handler global
// ================================================================
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error('[ERROR]', err.stack);
  res.status(500).json({ success: false, error: 'Error interno del servidor.', detalle: err.message });
});

// ================================================================
// Inicio del servidor
// ================================================================
async function startServer() {
  console.log('\n  Finca Agroecológica San Camilo — Sistema de Gestión');
  console.log('  ─────────────────────────────────────────────────────');
  console.log(`  BD: ${process.env.DB_HOST || 'no configurado'}:${process.env.DB_PORT || 3306}`);

  await testConnection();

  app.listen(PORT, () => {
    console.log(`\n  Servidor activo en  http://localhost:${PORT}`);
    console.log(`  Portal público:     http://localhost:${PORT}/`);
    console.log(`  Intranet (login):   http://localhost:${PORT}/intranet/login.html`);
    console.log(`  Health check:       http://localhost:${PORT}/api/health`);
    console.log('  ─────────────────────────────────────────────────────\n');
  });
}

startServer();
