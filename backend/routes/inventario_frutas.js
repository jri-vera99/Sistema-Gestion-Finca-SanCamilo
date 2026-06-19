// ==============================================================
// routes/inventario_frutas.js — Endpoints para Inventario_Frutas
// Columnas reales en Railway:
//   id_inventario, id_tipo_fruta, id_usuario,
//   cantidad, unidad_medida, fecha_registro, modo
// Tabla Tipo_Fruta: id_tipo_fruta, nombre_fruta, descripcion
// ==============================================================

const express = require('express');
const router  = express.Router();
const { pool } = require('../db');

// ──────────────────────────────────────────────────────────────
// GET /api/inventario_frutas
// Devuelve el inventario con nombre de fruta y nombre de usuario.
// Acepta ?modo=simulado|real para filtrar.
// ──────────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const { modo } = req.query;

    let sql = `
      SELECT inv.*,
             tf.nombre_fruta  AS nombre_fruta,
             tf.descripcion   AS descripcion_fruta,
             u.nombres        AS nombre_usuario
      FROM Inventario_Frutas inv
      LEFT JOIN Tipo_Fruta tf ON inv.id_tipo_fruta = tf.id_tipo_fruta
      LEFT JOIN Usuarios   u  ON inv.id_usuario    = u.id_usuario
    `;
    const params = [];

    if (modo) {
      sql += ' WHERE inv.modo = ?';
      params.push(modo);
    }

    sql += ' ORDER BY inv.id_inventario DESC';

    const [rows] = await pool.query(sql, params);
    res.json({ success: true, total: rows.length, data: rows });

  } catch (err) {
    console.error('[GET /inventario_frutas]', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ──────────────────────────────────────────────────────────────
// POST /api/inventario_frutas
// Agrega una entrada al inventario.
// Body JSON: {
//   id_tipo_fruta, id_usuario, cantidad,
//   unidad_medida, fecha_registro, modo
// }
// ──────────────────────────────────────────────────────────────
router.post('/', async (req, res) => {
  try {
    const {
      id_tipo_fruta,
      id_usuario     = null,
      cantidad,
      unidad_medida  = 'kg',
      fecha_registro = new Date().toISOString().split('T')[0],
      modo           = 'simulado'
    } = req.body;

    // Validación de campos obligatorios
    if (!id_tipo_fruta || !cantidad) {
      return res.status(400).json({
        success: false,
        error: 'Faltan campos obligatorios: id_tipo_fruta, cantidad.'
      });
    }

    const sql = `
      INSERT INTO Inventario_Frutas
        (id_tipo_fruta, id_usuario, cantidad, unidad_medida, fecha_registro, modo)
      VALUES (?, ?, ?, ?, ?, ?)
    `;

    const [result] = await pool.query(sql, [
      id_tipo_fruta,
      id_usuario,
      parseFloat(cantidad),
      unidad_medida,
      fecha_registro,
      modo
    ]);

    res.status(201).json({
      success: true,
      message: 'Entrada de inventario registrada correctamente.',
      id_insertado: result.insertId
    });

  } catch (err) {
    console.error('[POST /inventario_frutas]', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
