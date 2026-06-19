// ==============================================================
// routes/intranet/dispositivos.js
// ==============================================================
const express = require('express');
const router  = express.Router();
const { pool } = require('../../db');
const authMiddleware = require('../../middlewares/auth');
const requirePermiso = require('../../middlewares/permiso');
const auditar = require('../../middlewares/auditoria');
const crypto = require('crypto');

router.use(authMiddleware);

router.get('/', requirePermiso('dispositivos', 'ver'), async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT d.*, c.ubicacion_lat FROM Dispositivos_IoT d LEFT JOIN Colmenas c ON d.id_colmena = c.id_colmena ORDER BY d.id_dispositivo DESC');
    const [colmenas] = await pool.query('SELECT id_colmena FROM Colmenas');
    res.json({ success: true, data: rows, colmenas });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/', requirePermiso('dispositivos', 'crear'), auditar('crear_dispositivo', 'dispositivos'), async (req, res) => {
  try {
    const { nombre, tipo, mac_address, estado, id_colmena } = req.body;
    if (!nombre || !tipo || !mac_address) {
      return res.status(400).json({ success: false, error: 'Nombre, tipo y MAC son obligatorios.' });
    }

    const token_api = crypto.randomBytes(16).toString('hex');
    const sql = `INSERT INTO Dispositivos_IoT (nombre, tipo, mac_address, token_api, estado, id_colmena) VALUES (?, ?, ?, ?, ?, ?)`;
    const [result] = await pool.query(sql, [nombre, tipo, mac_address, token_api, estado || 'activo', id_colmena || null]);
    
    res.status(201).json({ success: true, message: 'Dispositivo registrado.', id: result.insertId });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ success: false, error: 'Ya existe un dispositivo con esa dirección MAC o Token.' });
    }
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
