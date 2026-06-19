// ==============================================================
// routes/reservas.js — Endpoints REST para la tabla Reservas
// Columnas reales en Railway:
//   id_reserva, id_cliente, id_habitacion, id_usuario,
//   fecha_inicio, fecha_fin, estado_reserva, total, modo
// ==============================================================

const express = require('express');
const router  = express.Router();
const { pool } = require('../db');

// ──────────────────────────────────────────────────────────────
// GET /api/reservas
// Devuelve todas las reservas con datos del cliente y habitación.
// Acepta ?modo=simulado|real para filtrar.
// ──────────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const { modo } = req.query;

    // JOIN con Clientes y Habitaciones para enriquecer la respuesta
    let sql = `
      SELECT r.*,
             c.nombres        AS nombre_cliente,
             c.correo         AS correo_cliente,
             h.tipo           AS tipo_habitacion,
             h.tarifa_base    AS tarifa_habitacion
      FROM Reservas r
      LEFT JOIN Clientes    c ON r.id_cliente    = c.id_cliente
      LEFT JOIN Habitaciones h ON r.id_habitacion = h.id_habitacion
    `;
    const params = [];

    if (modo) {
      sql += ' WHERE r.modo = ?';
      params.push(modo);
    }

    sql += ' ORDER BY r.id_reserva DESC';

    const [rows] = await pool.query(sql, params);
    res.json({ success: true, total: rows.length, data: rows });

  } catch (err) {
    console.error('[GET /reservas]', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ──────────────────────────────────────────────────────────────
// POST /api/reservas
// Crea una reserva nueva.
// Body JSON: {
//   id_cliente, id_habitacion, id_usuario,
//   fecha_inicio, fecha_fin, estado_reserva, total, modo
// }
// ──────────────────────────────────────────────────────────────
router.post('/', async (req, res) => {
  try {
    const {
      id_cliente,
      id_habitacion,
      id_usuario       = null,
      fecha_inicio,
      fecha_fin,
      estado_reserva   = 'pendiente',
      total            = 0,
      modo             = 'simulado'
    } = req.body;

    // Validación de campos obligatorios
    if (!id_cliente || !id_habitacion || !fecha_inicio || !fecha_fin) {
      return res.status(400).json({
        success: false,
        error: 'Faltan campos obligatorios: id_cliente, id_habitacion, fecha_inicio, fecha_fin.'
      });
    }

    const sql = `
      INSERT INTO Reservas
        (id_cliente, id_habitacion, id_usuario,
         fecha_inicio, fecha_fin, estado_reserva, total, modo)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const [result] = await pool.query(sql, [
      id_cliente,
      id_habitacion,
      id_usuario,
      fecha_inicio,
      fecha_fin,
      estado_reserva,
      parseFloat(total),
      modo
    ]);

    res.status(201).json({
      success: true,
      message: 'Reserva creada correctamente.',
      id_insertado: result.insertId
    });

  } catch (err) {
    console.error('[POST /reservas]', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ──────────────────────────────────────────────────────────────
// POST /api/reservas/simular
// Genera N reservas simuladas usando clientes y habitaciones existentes.
// Body: { cantidad }
// ──────────────────────────────────────────────────────────────
router.post('/simular', async (req, res) => {
  try {
    const cantidad = Math.min(parseInt(req.body.cantidad) || 3, 10);

    // Obtiene registros existentes para armar las relaciones
    const [clientes]     = await pool.query('SELECT id_cliente FROM Clientes LIMIT 20');
    const [habitaciones] = await pool.query('SELECT id_habitacion, tarifa_base FROM Habitaciones LIMIT 20');
    const [usuarios]     = await pool.query('SELECT id_usuario FROM Usuarios LIMIT 10');

    if (!clientes.length || !habitaciones.length) {
      return res.status(400).json({
        success: false,
        error: 'No hay clientes o habitaciones registradas para simular reservas.'
      });
    }

    const estados    = ['pendiente', 'confirmada', 'cancelada'];
    const insertadas = [];

    for (let i = 0; i < cantidad; i++) {
      const cliente    = clientes[Math.floor(Math.random() * clientes.length)];
      const habitacion = habitaciones[Math.floor(Math.random() * habitaciones.length)];
      const usuario    = usuarios.length
        ? usuarios[Math.floor(Math.random() * usuarios.length)]
        : { id_usuario: null };
      const estado = estados[Math.floor(Math.random() * estados.length)];

      // fecha_inicio: en los próximos 30 días, fecha_fin: 1-7 días después
      const diasInicio  = Math.floor(Math.random() * 30);
      const diasEstancia = Math.floor(Math.random() * 7) + 1;
      const inicio = new Date();
      inicio.setDate(inicio.getDate() + diasInicio);
      const fin = new Date(inicio);
      fin.setDate(fin.getDate() + diasEstancia);

      // Calcula total aproximado (tarifa × noches)
      const tarifaBase = parseFloat(habitacion.tarifa_base) || 50;
      const totalCalc  = (tarifaBase * diasEstancia).toFixed(2);

      const [result] = await pool.query(
        `INSERT INTO Reservas
           (id_cliente, id_habitacion, id_usuario,
            fecha_inicio, fecha_fin, estado_reserva, total, modo)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          cliente.id_cliente,
          habitacion.id_habitacion,
          usuario.id_usuario,
          inicio.toISOString().split('T')[0],
          fin.toISOString().split('T')[0],
          estado,
          totalCalc,
          'simulado'
        ]
      );
      insertadas.push({ id: result.insertId, estado, total: totalCalc });
    }

    res.status(201).json({
      success: true,
      message: `${cantidad} reservas simuladas generadas.`,
      data: insertadas
    });

  } catch (err) {
    console.error('[POST /reservas/simular]', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
