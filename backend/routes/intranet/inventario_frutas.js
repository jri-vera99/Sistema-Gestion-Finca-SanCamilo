// ==============================================================
// routes/intranet/inventario_frutas.js
// ==============================================================
const express = require('express');
const router  = express.Router();
const { pool } = require('../../db');
const authMiddleware = require('../../middlewares/auth');
const requirePermiso = require('../../middlewares/permiso');
const auditar = require('../../middlewares/auditoria');

router.use(authMiddleware);

router.get('/', requirePermiso('inventario', 'ver'), async (req, res) => {
  try {
    const { modo } = req.query;
    let sql = `
      SELECT i.*, f.nombre_fruta, u.nombres AS nombre_usuario
      FROM Inventario_Frutas i
      LEFT JOIN Tipo_Fruta f ON i.id_tipo_fruta = f.id_tipo_fruta
      LEFT JOIN Usuarios u ON i.id_usuario = u.id_usuario
    `;
    const params = [];
    if (modo) {
      sql += ' WHERE i.modo = ?';
      params.push(modo);
    }
    sql += ' ORDER BY i.id_inventario DESC';
    const [rows] = await pool.query(sql, params);
    
    const [tipos] = await pool.query('SELECT * FROM Tipo_Fruta');
    res.json({ success: true, data: rows, tipos });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/', requirePermiso('inventario', 'crear'), auditar('crear_inventario', 'inventario'), async (req, res) => {
  try {
    const { id_tipo_fruta, cantidad, unidad_medida } = req.body;
    if (!id_tipo_fruta || !cantidad || !unidad_medida) {
      return res.status(400).json({ success: false, error: 'Faltan campos obligatorios.' });
    }
    
    const [modos] = await pool.query("SELECT modo FROM Configuracion_Modo JOIN Modulos ON Modulos.id_modulo = Configuracion_Modo.id_modulo WHERE Modulos.slug = 'inventario'");
    const modo_actual = (modos.length && modos[0].modo) ? modos[0].modo : 'real';

    const sql = `INSERT INTO Inventario_Frutas (id_tipo_fruta, id_usuario, cantidad, unidad_medida, modo) VALUES (?, ?, ?, ?, ?)`;
    const [result] = await pool.query(sql, [id_tipo_fruta, req.usuario.id_usuario, parseFloat(cantidad), unidad_medida, modo_actual]);
    
    res.status(201).json({ success: true, message: 'Inventario registrado.', id: result.insertId });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
