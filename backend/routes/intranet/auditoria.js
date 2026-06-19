// ================================================================
// routes/intranet/auditoria.js — Logs de auditoría (solo superadmin)
// ================================================================

const express  = require('express');
const router   = express.Router();
const { pool } = require('../../db');
const auth     = require('../../middlewares/auth');
const permiso  = require('../../middlewares/permiso');

router.use(auth);

// GET /api/intranet/auditoria
// Acepta ?modulo=colmenas&id_usuario=1&fecha_inicio=...&fecha_fin=...
router.get('/', permiso('auditoria', 'ver'), async (req, res) => {
  try {
    const { modulo, id_usuario, fecha_inicio, fecha_fin, pagina = 1 } = req.query;
    const limite = 50;
    const offset = (parseInt(pagina) - 1) * limite;

    let sql = `
      SELECT a.*, u.nombres AS nombre_usuario
      FROM Auditoria a
      LEFT JOIN Usuarios u ON a.id_usuario = u.id_usuario
      WHERE 1=1
    `;
    const params = [];

    if (modulo)      { sql += ' AND a.modulo = ?';     params.push(modulo); }
    if (id_usuario)  { sql += ' AND a.id_usuario = ?'; params.push(id_usuario); }
    if (fecha_inicio){ sql += ' AND a.creado_en >= ?';  params.push(fecha_inicio); }
    if (fecha_fin)   { sql += ' AND a.creado_en <= ?';  params.push(fecha_fin + ' 23:59:59'); }

    sql += ` ORDER BY a.creado_en DESC LIMIT ${limite} OFFSET ${offset}`;

    const [rows] = await pool.query(sql, params);

    // Total para paginación
    const [total] = await pool.query('SELECT COUNT(*) AS total FROM Auditoria');

    res.json({ success: true, total: total[0].total, pagina: parseInt(pagina), data: rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
