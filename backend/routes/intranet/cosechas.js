// ==============================================================
// routes/intranet/cosechas.js
// ==============================================================
const express = require('express');
const router  = express.Router();
const { pool } = require('../../db');
const authMiddleware = require('../../middlewares/auth');
const requirePermiso = require('../../middlewares/permiso');
const auditar = require('../../middlewares/auditoria');

router.use(authMiddleware);

router.get('/', requirePermiso('cosechas', 'ver'), async (req, res) => {
  try {
    const { modo } = req.query;
    let sql = `
      SELECT cos.*, u.nombres AS nombre_usuario, col.ubicacion_lat, col.ubicacion_long
      FROM Cosechas cos
      LEFT JOIN Colmenas col ON cos.id_colmena = col.id_colmena
      LEFT JOIN Usuarios u ON cos.id_usuario = u.id_usuario
    `;
    const params = [];
    if (modo) {
      sql += ' WHERE cos.modo = ?';
      params.push(modo);
    }
    sql += ' ORDER BY cos.id_cosecha DESC';
    const [rows] = await pool.query(sql, params);
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/', requirePermiso('cosechas', 'crear'), auditar('crear_cosecha', 'cosechas'), async (req, res) => {
  try {
    const { id_colmena, tipo_producto, cantidad, fecha_cosecha } = req.body;
    if (!id_colmena || !tipo_producto || !cantidad) {
      return res.status(400).json({ success: false, error: 'Faltan campos obligatorios.' });
    }

    const fecha = fecha_cosecha || new Date().toISOString().split('T')[0];
    
    // Obtener el modo actual del módulo
    const [modos] = await pool.query("SELECT modo FROM Configuracion_Modo JOIN Modulos ON Modulos.id_modulo = Configuracion_Modo.id_modulo WHERE Modulos.slug = 'cosechas'");
    const modo_actual = (modos.length && modos[0].modo) ? modos[0].modo : 'real';

    const sql = `INSERT INTO Cosechas (id_colmena, id_usuario, tipo_producto, cantidad, fecha_cosecha, modo) VALUES (?, ?, ?, ?, ?, ?)`;
    const [result] = await pool.query(sql, [id_colmena, req.usuario.id_usuario, tipo_producto, parseFloat(cantidad), fecha, modo_actual]);
    
    res.status(201).json({ success: true, message: 'Cosecha registrada.', id: result.insertId });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
