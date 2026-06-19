// ================================================================
// routes/intranet/dashboard.js — Resumen estadístico para dashboard
// ================================================================

const express  = require('express');
const router   = express.Router();
const { pool } = require('../../db');
const auth     = require('../../middlewares/auth');

router.use(auth);

// GET /api/intranet/dashboard — KPIs generales
router.get('/', async (req, res) => {
  try {
    const isSuperAdmin = req.usuario.es_superadmin === 1;
    const idRol        = req.usuario.id_rol;

    // Datos disponibles para todos (según permisos se mostrarán en frontend)
    const [colmenas] = await pool.query(
      'SELECT COUNT(*) AS total, SUM(activa=1) AS activas, SUM(estado_salud="malo") AS criticas FROM Colmenas'
    );
    const [cosechas] = await pool.query(
      'SELECT COUNT(*) AS total, SUM(cantidad) AS kg_total FROM Cosechas WHERE MONTH(fecha_cosecha) = MONTH(NOW())'
    );
    const [reservas] = await pool.query(
      `SELECT COUNT(*) AS total,
              SUM(estado_reserva = 'pendiente')  AS pendientes,
              SUM(estado_reserva = 'confirmada') AS confirmadas
       FROM Reservas WHERE MONTH(fecha_inicio) = MONTH(NOW())`
    );
    const [clientes] = await pool.query('SELECT COUNT(*) AS total FROM Clientes');
    const [solicitudes] = await pool.query(
      "SELECT COUNT(*) AS total FROM Solicitudes_Publicas WHERE estado = 'pendiente'"
    );
    const [alertas] = await pool.query(
      "SELECT COUNT(*) AS total FROM Alertas WHERE leida = 0"
    );
    const [inventario] = await pool.query(
      "SELECT COUNT(*) AS bajo_stock FROM Productos WHERE estado IN ('bajo_stock','agotado') AND activo = 1"
    );

    res.json({
      success: true,
      data: {
        colmenas:   colmenas[0],
        cosechas:   cosechas[0],
        reservas:   reservas[0],
        clientes:   clientes[0],
        solicitudes_pendientes: solicitudes[0].total,
        alertas_no_leidas:      alertas[0].total,
        productos_bajo_stock:   inventario[0].bajo_stock
      }
    });

  } catch (err) {
    console.error('[GET /dashboard]', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/intranet/dashboard/alertas — Alertas recientes
router.get('/alertas', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT a.*, col.ubicacion_lat, col.ubicacion_long
       FROM Alertas a
       LEFT JOIN Colmenas col ON a.id_colmena = col.id_colmena
       WHERE a.leida = 0
       ORDER BY a.creado_en DESC LIMIT 10`
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/intranet/dashboard/alertas/:id/leer — Marcar alerta como leída
router.put('/alertas/:id/leer', async (req, res) => {
  try {
    await pool.query('UPDATE Alertas SET leida = 1, leida_en = NOW() WHERE id_alerta = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
