// ==============================================================
// routes/intranet/hospedaje.js
// ==============================================================
const express = require('express');
const router  = express.Router();
const { pool } = require('../../db');
const authMiddleware = require('../../middlewares/auth');
const requirePermiso = require('../../middlewares/permiso');
const auditar = require('../../middlewares/auditoria');

router.use(authMiddleware);

router.get('/reservas', requirePermiso('hospedaje', 'ver'), async (req, res) => {
  try {
    const { modo } = req.query;
    let sql = `
      SELECT r.*, c.nombres AS nombre_cliente, c.apellidos AS apellido_cliente, c.cedula
      FROM Reservas r
      LEFT JOIN Clientes c ON r.id_cliente = c.id_cliente
    `;
    const params = [];
    if (modo) {
      sql += ' WHERE r.modo = ?';
      params.push(modo);
    }
    sql += ' ORDER BY r.id_reserva DESC';
    const [rows] = await pool.query(sql, params);
    
    const [habitaciones] = await pool.query('SELECT * FROM Habitaciones WHERE activa = 1');
    const [clientes] = await pool.query('SELECT * FROM Clientes');
    
    res.json({ success: true, data: rows, habitaciones, clientes });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/reservas', requirePermiso('hospedaje', 'crear'), auditar('crear_reserva', 'hospedaje'), async (req, res) => {
  try {
    const { id_cliente, id_habitacion, fecha_inicio, fecha_fin, notas } = req.body;
    if (!id_cliente || !id_habitacion || !fecha_inicio || !fecha_fin) {
      return res.status(400).json({ success: false, error: 'Faltan campos obligatorios.' });
    }
    
    const [modos] = await pool.query("SELECT modo FROM Configuracion_Modo JOIN Modulos ON Modulos.id_modulo = Configuracion_Modo.id_modulo WHERE Modulos.slug = 'hospedaje'");
    const modo_actual = (modos.length && modos[0].modo) ? modos[0].modo : 'real';

    const sql = `INSERT INTO Reservas (id_cliente, id_habitacion, id_usuario, fecha_inicio, fecha_fin, estado_reserva, notas, modo) VALUES (?, ?, ?, ?, ?, 'confirmada', ?, ?)`;
    const [result] = await pool.query(sql, [id_cliente, id_habitacion, req.usuario.id_usuario, fecha_inicio, fecha_fin, notas || null, modo_actual]);
    
    res.status(201).json({ success: true, message: 'Reserva creada correctamente.', id: result.insertId });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
