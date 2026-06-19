// ==============================================================
// routes/clientes.js — Endpoint de solo lectura para Clientes
// Columnas reales en Railway:
//   id_cliente, nombres, cedula, correo, telefono
// ==============================================================

const express = require('express');
const router  = express.Router();
const { pool } = require('../db');

// ──────────────────────────────────────────────────────────────
// GET /api/clientes
// Lista todos los clientes registrados.
// Acepta ?buscar=texto para buscar por nombre, cédula o correo.
// ──────────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const { buscar } = req.query;

    let sql    = 'SELECT id_cliente, nombres, cedula, correo, telefono FROM Clientes';
    const params = [];

    if (buscar) {
      // Búsqueda por nombre, cédula o correo
      sql += ' WHERE nombres LIKE ? OR cedula LIKE ? OR correo LIKE ?';
      const term = `%${buscar}%`;
      params.push(term, term, term);
    }

    sql += ' ORDER BY id_cliente DESC';

    const [rows] = await pool.query(sql, params);
    res.json({ success: true, total: rows.length, data: rows });

  } catch (err) {
    console.error('[GET /clientes]', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
