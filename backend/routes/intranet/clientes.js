// ==============================================================
// routes/intranet/clientes.js
// ==============================================================
const express = require('express');
const router  = express.Router();
const { pool } = require('../../db');
const authMiddleware = require('../../middlewares/auth');
const requirePermiso = require('../../middlewares/permiso');
const auditar = require('../../middlewares/auditoria');

router.use(authMiddleware);

router.get('/', requirePermiso('clientes', 'ver'), async (req, res) => {
  try {
    const { buscar } = req.query;
    let sql = 'SELECT id_cliente, nombres, cedula, correo, telefono FROM Clientes';
    const params = [];

    if (buscar) {
      sql += ' WHERE nombres LIKE ? OR cedula LIKE ? OR correo LIKE ?';
      const term = `%${buscar}%`;
      params.push(term, term, term);
    }
    sql += ' ORDER BY id_cliente DESC';
    const [rows] = await pool.query(sql, params);
    
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/', requirePermiso('clientes', 'crear'), auditar('crear_cliente', 'clientes'), async (req, res) => {
  try {
    const { nombres, cedula, correo, telefono } = req.body;
    if (!nombres) {
      return res.status(400).json({ success: false, error: 'El nombre es obligatorio.' });
    }

    const sql = `INSERT INTO Clientes (nombres, cedula, correo, telefono) VALUES (?, ?, ?, ?)`;
    const [result] = await pool.query(sql, [nombres, cedula || null, correo || null, telefono || null]);
    
    res.status(201).json({ success: true, message: 'Cliente registrado correctamente.', id: result.insertId });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ success: false, error: 'Ya existe un cliente con esa cédula o correo.' });
    }
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
