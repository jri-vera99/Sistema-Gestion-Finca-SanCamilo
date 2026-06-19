// ==============================================================
// routes/colmenas.js — Endpoints REST para la tabla Colmenas
// Columnas reales en Railway:
//   id_colmena, id_usuario_responsable, ubicacion_lat, ubicacion_long,
//   estado_salud, dias_activas, edad_reina, ultima_extraccion, modo
// ==============================================================

const express = require('express');
const router  = express.Router();
const { pool } = require('../db');

// ──────────────────────────────────────────────────────────────
// GET /api/colmenas
// Devuelve todas las colmenas con el correo del usuario responsable.
// Acepta ?modo=simulado|real para filtrar.
// ──────────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const { modo } = req.query;

    // JOIN con Usuarios para mostrar quién es el responsable
    let sql = `
      SELECT c.*,
             u.nombres AS nombre_responsable,
             u.correo  AS correo_responsable
      FROM Colmenas c
      LEFT JOIN Usuarios u ON c.id_usuario_responsable = u.id_usuario
    `;
    const params = [];

    if (modo) {
      sql += ' WHERE c.modo = ?';
      params.push(modo);
    }

    sql += ' ORDER BY c.id_colmena DESC';

    const [rows] = await pool.query(sql, params);
    res.json({ success: true, total: rows.length, data: rows });

  } catch (err) {
    console.error('[GET /colmenas]', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ──────────────────────────────────────────────────────────────
// POST /api/colmenas
// Inserta una colmena nueva.
// Body JSON: {
//   id_usuario_responsable, ubicacion_lat, ubicacion_long,
//   estado_salud, dias_activas, edad_reina, ultima_extraccion, modo
// }
// ──────────────────────────────────────────────────────────────
router.post('/', async (req, res) => {
  try {
    const {
      id_usuario_responsable,
      ubicacion_lat,
      ubicacion_long,
      estado_salud      = 'bueno',
      dias_activas      = 0,
      edad_reina        = 0,
      ultima_extraccion = null,
      modo              = 'simulado'
    } = req.body;

    // Validación: la colmena necesita al menos una ubicación
    if (!ubicacion_lat || !ubicacion_long) {
      return res.status(400).json({
        success: false,
        error: 'Los campos ubicacion_lat y ubicacion_long son obligatorios.'
      });
    }

    const sql = `
      INSERT INTO Colmenas
        (id_usuario_responsable, ubicacion_lat, ubicacion_long,
         estado_salud, dias_activas, edad_reina, ultima_extraccion, modo)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const [result] = await pool.query(sql, [
      id_usuario_responsable || null,
      parseFloat(ubicacion_lat),
      parseFloat(ubicacion_long),
      estado_salud,
      parseInt(dias_activas),
      parseInt(edad_reina),
      ultima_extraccion || null,
      modo
    ]);

    res.status(201).json({
      success: true,
      message: 'Colmena creada correctamente.',
      id_insertado: result.insertId
    });

  } catch (err) {
    console.error('[POST /colmenas]', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ──────────────────────────────────────────────────────────────
// POST /api/colmenas/simular
// Genera automáticamente N colmenas con datos aleatorios simulados.
// Body: { cantidad }  (máx 20)
// ──────────────────────────────────────────────────────────────
router.post('/simular', async (req, res) => {
  try {
    const cantidad = Math.min(parseInt(req.body.cantidad) || 5, 20);

    // Obtiene un usuario responsable existente para asignarle las colmenas
    const [usuarios] = await pool.query('SELECT id_usuario FROM Usuarios LIMIT 10');
    const estados    = ['bueno', 'bueno', 'regular', 'malo'];

    const insertadas = [];

    for (let i = 1; i <= cantidad; i++) {
      // Coordenadas aleatorias dentro de un rango de Ecuador (país de ejemplo)
      const lat  = (-2 + Math.random() * 4).toFixed(6);   // Entre -2° y 2°
      const lng  = (-80 + Math.random() * 5).toFixed(6);  // Entre -80° y -75°
      const salud      = estados[Math.floor(Math.random() * estados.length)];
      const dias       = Math.floor(Math.random() * 365) + 1;
      const edadReina  = Math.floor(Math.random() * 5);
      const responsable = usuarios.length
        ? usuarios[Math.floor(Math.random() * usuarios.length)].id_usuario
        : null;

      const [result] = await pool.query(
        `INSERT INTO Colmenas
           (id_usuario_responsable, ubicacion_lat, ubicacion_long,
            estado_salud, dias_activas, edad_reina, modo)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [responsable, lat, lng, salud, dias, edadReina, 'simulado']
      );
      insertadas.push({ id: result.insertId, lat, lng, salud });
    }

    res.status(201).json({
      success: true,
      message: `${cantidad} colmenas simuladas generadas.`,
      data: insertadas
    });

  } catch (err) {
    console.error('[POST /colmenas/simular]', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
