// ================================================================
// routes/public/hospedaje.js — Habitaciones disponibles (público)
// ================================================================

const express  = require('express');
const router   = express.Router();
const { pool } = require('../../db');

// GET /api/public/hospedaje — Lista habitaciones activas con disponibilidad
// Acepta ?fecha_inicio=YYYY-MM-DD&fecha_fin=YYYY-MM-DD para filtrar disponibles
router.get('/', async (req, res) => {
  try {
    const { fecha_inicio, fecha_fin } = req.query;

    let sql = `
      SELECT h.id_habitacion, h.tipo, h.capacidad, h.tarifa_base, h.descripcion, h.imagen_url
      FROM Habitaciones h
      WHERE h.activa = 1
    `;

    // Si se envían fechas, excluye habitaciones con reservas en ese período
    if (fecha_inicio && fecha_fin) {
      sql += `
        AND h.id_habitacion NOT IN (
          SELECT id_habitacion FROM Reservas
          WHERE estado_reserva NOT IN ('cancelada')
            AND fecha_inicio < ? AND fecha_fin > ?
        )
      `;
    }

    sql += ' ORDER BY h.tarifa_base ASC';

    const params = fecha_inicio && fecha_fin ? [fecha_fin, fecha_inicio] : [];
    const [rows] = await pool.query(sql, params);
    res.json({ success: true, total: rows.length, data: rows });
  } catch (err) {
    console.error('[GET /public/hospedaje]', err.message);
    res.status(500).json({ success: false, error: 'Error al obtener habitaciones.' });
  }
});

module.exports = router;
