// ================================================================
// routes/intranet/colmenas.js — Módulo Apiario / Colmenas
// ================================================================

const express  = require('express');
const router   = express.Router();
const { pool } = require('../../db');
const auth     = require('../../middlewares/auth');
const permiso  = require('../../middlewares/permiso');
const auditar  = require('../../middlewares/auditoria');

router.use(auth);

// GET /api/intranet/colmenas — Lista con usuario responsable
// Acepta ?modo=real|simulado
router.get('/', permiso('colmenas', 'ver'), async (req, res) => {
  try {
    const { modo } = req.query;
    let sql = `
      SELECT c.*,
             u.nombres AS nombre_responsable,
             u.correo  AS correo_responsable,
             (SELECT COUNT(*) FROM Monitoreo_Colmena m WHERE m.id_colmena = c.id_colmena) AS total_lecturas,
             (SELECT temperatura FROM Monitoreo_Colmena m2
              WHERE m2.id_colmena = c.id_colmena ORDER BY m2.fecha_hora DESC LIMIT 1) AS ultima_temperatura,
             (SELECT humedad FROM Monitoreo_Colmena m3
              WHERE m3.id_colmena = c.id_colmena ORDER BY m3.fecha_hora DESC LIMIT 1) AS ultima_humedad
      FROM Colmenas c
      LEFT JOIN Usuarios u ON c.id_usuario_responsable = u.id_usuario
      WHERE c.activa = 1
    `;
    const params = [];
    if (modo) { sql += ' AND c.modo = ?'; params.push(modo); }
    sql += ' ORDER BY c.id_colmena DESC';

    const [rows] = await pool.query(sql, params);
    res.json({ success: true, total: rows.length, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/intranet/colmenas/:id — Detalle de una colmena
router.get('/:id', permiso('colmenas', 'ver'), async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT c.*, u.nombres AS nombre_responsable
      FROM Colmenas c
      LEFT JOIN Usuarios u ON c.id_usuario_responsable = u.id_usuario
      WHERE c.id_colmena = ?
    `, [req.params.id]);

    if (!rows.length) return res.status(404).json({ success: false, error: 'Colmena no encontrada.' });

    // Últimas 50 lecturas de monitoreo
    const [lecturas] = await pool.query(
      'SELECT * FROM Monitoreo_Colmena WHERE id_colmena = ? ORDER BY fecha_hora DESC LIMIT 50',
      [req.params.id]
    );

    res.json({ success: true, data: rows[0], lecturas });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/intranet/colmenas — Crear colmena
router.post('/', permiso('colmenas', 'crear'), auditar('crear_colmena', 'colmenas'), async (req, res) => {
  try {
    const {
      id_usuario_responsable, ubicacion_lat, ubicacion_long,
      estado_salud = 'bueno', dias_activas = 0, edad_reina = 0,
      ultima_extraccion = null, observaciones = null, modo = 'real'
    } = req.body;

    if (!ubicacion_lat || !ubicacion_long) {
      return res.status(400).json({ success: false, error: 'ubicacion_lat y ubicacion_long son obligatorios.' });
    }

    const [result] = await pool.query(
      `INSERT INTO Colmenas
         (id_usuario_responsable, ubicacion_lat, ubicacion_long,
          estado_salud, dias_activas, edad_reina, ultima_extraccion,
          observaciones, modo, creado_por)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id_usuario_responsable || null, parseFloat(ubicacion_lat), parseFloat(ubicacion_long),
       estado_salud, parseInt(dias_activas), parseInt(edad_reina),
       ultima_extraccion || null, observaciones || null, modo, req.usuario.id_usuario]
    );

    res.status(201).json({ success: true, message: 'Colmena registrada.', id_insertado: result.insertId });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/intranet/colmenas/:id — Actualizar colmena
router.put('/:id', permiso('colmenas', 'editar'), auditar('editar_colmena', 'colmenas'), async (req, res) => {
  try {
    const { estado_salud, dias_activas, edad_reina, ultima_extraccion, observaciones, id_usuario_responsable } = req.body;
    await pool.query(
      `UPDATE Colmenas SET
         estado_salud = COALESCE(?, estado_salud),
         dias_activas = COALESCE(?, dias_activas),
         edad_reina   = COALESCE(?, edad_reina),
         ultima_extraccion = COALESCE(?, ultima_extraccion),
         observaciones = COALESCE(?, observaciones),
         id_usuario_responsable = COALESCE(?, id_usuario_responsable)
       WHERE id_colmena = ?`,
      [estado_salud, dias_activas, edad_reina, ultima_extraccion, observaciones, id_usuario_responsable, req.params.id]
    );
    res.json({ success: true, message: 'Colmena actualizada.' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/intranet/colmenas/:id — Desactivar colmena
router.delete('/:id', permiso('colmenas', 'eliminar'), auditar('desactivar_colmena', 'colmenas'), async (req, res) => {
  try {
    await pool.query('UPDATE Colmenas SET activa = 0 WHERE id_colmena = ?', [req.params.id]);
    res.json({ success: true, message: 'Colmena desactivada.' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/intranet/colmenas/simular — Genera colmenas simuladas
router.post('/simular', permiso('colmenas', 'simular'), auditar('simular_colmenas', 'colmenas'), async (req, res) => {
  try {
    const cantidad = Math.min(parseInt(req.body.cantidad) || 5, 20);
    const subsim   = req.body.subsimulacion || null; // 'critica', 'alta_produccion', 'baja_produccion'

    const [usuarios] = await pool.query('SELECT id_usuario FROM Usuarios WHERE activo = 1 LIMIT 10');
    const estados    = subsim === 'critica'
      ? ['malo']
      : subsim === 'alta_produccion'
        ? ['bueno', 'bueno', 'bueno']
        : ['bueno', 'bueno', 'regular', 'malo'];

    const insertadas = [];
    for (let i = 1; i <= cantidad; i++) {
      const lat       = (-0.35 + Math.random() * 0.1).toFixed(6); // Ambuquí ~0.35°N
      const lng       = (-77.95 + Math.random() * 0.1).toFixed(6);
      const salud     = estados[Math.floor(Math.random() * estados.length)];
      const dias      = Math.floor(Math.random() * 400) + 30;
      const reina     = Math.floor(Math.random() * 4);
      const responsable = usuarios.length ? usuarios[Math.floor(Math.random() * usuarios.length)].id_usuario : null;

      const [result] = await pool.query(
        `INSERT INTO Colmenas
           (id_usuario_responsable, ubicacion_lat, ubicacion_long,
            estado_salud, dias_activas, edad_reina, modo, creado_por)
         VALUES (?, ?, ?, ?, ?, ?, 'simulado', ?)`,
        [responsable, lat, lng, salud, dias, reina, req.usuario.id_usuario]
      );

      // Genera lecturas de monitoreo simuladas (últimas 10)
      for (let j = 0; j < 10; j++) {
        const temp = salud === 'malo'
          ? (22 + Math.random() * 5).toFixed(1)   // temperatura baja = problema
          : (33 + Math.random() * 5).toFixed(1);  // normal: 33-38°C
        const hum = (50 + Math.random() * 30).toFixed(1);
        const fecha = new Date(Date.now() - j * 3600000).toISOString().replace('T', ' ').substring(0, 19);
        await pool.query(
          'INSERT INTO Monitoreo_Colmena (id_colmena, fecha_hora, temperatura, humedad, modo) VALUES (?, ?, ?, ?, "simulado")',
          [result.insertId, fecha, temp, hum]
        );
      }

      insertadas.push({ id: result.insertId, lat, lng, salud });
    }

    res.status(201).json({ success: true, message: `${cantidad} colmenas simuladas generadas.`, data: insertadas });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/intranet/colmenas/:id/alertas — Alertas de una colmena
router.get('/:id/alertas', permiso('colmenas', 'ver'), async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM Alertas WHERE id_colmena = ? ORDER BY creado_en DESC LIMIT 20',
      [req.params.id]
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
