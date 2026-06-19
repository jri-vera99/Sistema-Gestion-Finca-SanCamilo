// ================================================================
// routes/intranet/solicitudes.js — Gestión de solicitudes públicas
// ================================================================

const express  = require('express');
const router   = express.Router();
const { pool } = require('../../db');
const auth     = require('../../middlewares/auth');
const permiso  = require('../../middlewares/permiso');
const auditar  = require('../../middlewares/auditoria');

router.use(auth);

// GET /api/intranet/solicitudes
// Acepta ?estado=pendiente|revisada|confirmada|rechazada|finalizada
router.get('/', permiso('solicitudes', 'ver'), async (req, res) => {
  try {
    const { estado, tipo } = req.query;
    let sql = `
      SELECT sp.*, u.nombres AS nombre_asignado
      FROM Solicitudes_Publicas sp
      LEFT JOIN Usuarios u ON sp.asignado_a = u.id_usuario
      WHERE 1=1
    `;
    const params = [];
    if (estado) { sql += ' AND sp.estado = ?'; params.push(estado); }
    if (tipo)   { sql += ' AND sp.tipo = ?';   params.push(tipo); }
    sql += ' ORDER BY sp.creado_en DESC';

    const [rows] = await pool.query(sql, params);
    res.json({ success: true, total: rows.length, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/intranet/solicitudes/:id — Actualizar estado o asignación
router.put('/:id', permiso('solicitudes', 'editar'), auditar('actualizar_solicitud', 'solicitudes'), async (req, res) => {
  try {
    const { estado, asignado_a, notas_internas } = req.body;
    await pool.query(
      `UPDATE Solicitudes_Publicas SET
         estado          = COALESCE(?, estado),
         asignado_a      = COALESCE(?, asignado_a),
         notas_internas  = COALESCE(?, notas_internas)
       WHERE id_solicitud = ?`,
      [estado, asignado_a, notas_internas, req.params.id]
    );
    res.json({ success: true, message: 'Solicitud actualizada.' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
