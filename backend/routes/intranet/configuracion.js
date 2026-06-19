// ================================================================
// routes/intranet/configuracion.js
// ================================================================
const express = require('express');
const router  = express.Router();
const { pool } = require('../../db');
const authMiddleware = require('../../middlewares/auth');
const requirePermiso = require('../../middlewares/permiso');
const auditar = require('../../middlewares/auditoria');

router.use(authMiddleware);

// GET /api/intranet/configuracion/modos
router.get('/modos', requirePermiso('configuracion', 'ver'), async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT m.id_modulo, m.nombre, m.slug, c.modo, c.subsimulacion, c.actualizado_en
      FROM Modulos m
      LEFT JOIN Configuracion_Modo c ON m.id_modulo = c.id_modulo
      WHERE m.activo = 1
      ORDER BY m.orden
    `);
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/intranet/configuracion/modos/:id_modulo
router.put('/modos/:id_modulo', requirePermiso('configuracion', 'simular'), auditar('cambiar_modo', 'configuracion'), async (req, res) => {
  try {
    const id_modulo = parseInt(req.params.id_modulo);
    const { modo, subsimulacion } = req.body;

    if (!['real', 'simulado'].includes(modo)) {
      return res.status(400).json({ success: false, error: 'Modo inválido.' });
    }

    await pool.query(`
      INSERT INTO Configuracion_Modo (id_modulo, modo, subsimulacion, actualizado_por)
      VALUES (?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE modo = VALUES(modo), subsimulacion = VALUES(subsimulacion), actualizado_por = VALUES(actualizado_por)
    `, [id_modulo, modo, modo === 'simulado' ? subsimulacion : null, req.usuario.id_usuario]);

    res.json({ success: true, message: 'Modo actualizado.' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
