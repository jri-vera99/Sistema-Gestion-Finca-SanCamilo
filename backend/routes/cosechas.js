// ==============================================================
// routes/cosechas.js — Endpoints REST para la tabla Cosechas
// Columnas reales en Railway:
//   id_cosecha, id_colmena, id_usuario,
//   tipo_producto, cantidad, fecha_cosecha, modo
// ==============================================================

const express = require('express');
const router  = express.Router();
const { pool } = require('../db');

// ──────────────────────────────────────────────────────────────
// GET /api/cosechas
// Devuelve todas las cosechas con información de colmena y usuario.
// Acepta ?modo=simulado|real para filtrar.
// ──────────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const { modo } = req.query;

    // JOIN con Colmenas y Usuarios para enriquecer los datos
    let sql = `
      SELECT cos.*,
             u.nombres        AS nombre_usuario,
             col.ubicacion_lat  AS colmena_lat,
             col.ubicacion_long AS colmena_lng,
             col.estado_salud   AS salud_colmena
      FROM Cosechas cos
      LEFT JOIN Colmenas col ON cos.id_colmena = col.id_colmena
      LEFT JOIN Usuarios  u   ON cos.id_usuario = u.id_usuario
    `;
    const params = [];

    if (modo) {
      sql += ' WHERE cos.modo = ?';
      params.push(modo);
    }

    sql += ' ORDER BY cos.id_cosecha DESC';

    const [rows] = await pool.query(sql, params);
    res.json({ success: true, total: rows.length, data: rows });

  } catch (err) {
    console.error('[GET /cosechas]', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ──────────────────────────────────────────────────────────────
// POST /api/cosechas
// Registra una cosecha.
// Body JSON: {
//   id_colmena, id_usuario, tipo_producto,
//   cantidad, fecha_cosecha, modo
// }
// ──────────────────────────────────────────────────────────────
router.post('/', async (req, res) => {
  try {
    const {
      id_colmena,
      id_usuario    = null,
      tipo_producto,
      cantidad,
      fecha_cosecha = new Date().toISOString().split('T')[0],
      modo          = 'simulado'
    } = req.body;

    // Validación de campos obligatorios
    if (!id_colmena || !tipo_producto || !cantidad) {
      return res.status(400).json({
        success: false,
        error: 'Faltan campos obligatorios: id_colmena, tipo_producto, cantidad.'
      });
    }

    const sql = `
      INSERT INTO Cosechas
        (id_colmena, id_usuario, tipo_producto, cantidad, fecha_cosecha, modo)
      VALUES (?, ?, ?, ?, ?, ?)
    `;

    const [result] = await pool.query(sql, [
      id_colmena,
      id_usuario,
      tipo_producto,
      parseFloat(cantidad),
      fecha_cosecha,
      modo
    ]);

    res.status(201).json({
      success: true,
      message: 'Cosecha registrada correctamente.',
      id_insertado: result.insertId
    });

  } catch (err) {
    console.error('[POST /cosechas]', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
