// ================================================================
// routes/public/productos.js — Catálogo público de productos
// ================================================================
// Sin autenticación — accesible desde el portal público.

const express  = require('express');
const router   = express.Router();
const { pool } = require('../../db');

// GET /api/public/productos — Lista productos visibles al público
// Acepta ?categoria=miel|cera|citrico|fruta|otro
router.get('/', async (req, res) => {
  try {
    const { categoria } = req.query;
    let sql    = `SELECT id_producto, nombre, categoria, descripcion, precio, unidad, stock, estado, imagen_url
                  FROM Productos WHERE visible_publico = 1 AND activo = 1 AND estado != 'agotado'`;
    const params = [];

    if (categoria) { sql += ' AND categoria = ?'; params.push(categoria); }
    sql += ' ORDER BY categoria, nombre';

    const [rows] = await pool.query(sql, params);
    res.json({ success: true, total: rows.length, data: rows });
  } catch (err) {
    console.error('[GET /public/productos]', err.message);
    res.status(500).json({ success: false, error: 'Error al obtener productos.' });
  }
});

module.exports = router;
