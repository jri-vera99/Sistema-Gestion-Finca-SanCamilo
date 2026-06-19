// ================================================================
// routes/intranet/monitoreo.js — Lecturas de sensores + endpoint IoT
// ================================================================

const express  = require('express');
const router   = express.Router();
const { pool } = require('../../db');
const auth     = require('../../middlewares/auth');
const permiso  = require('../../middlewares/permiso');

// ----------------------------------------------------------------
// POST /api/intranet/monitoreo/lectura — Endpoint para ESP32/IoT
// No requiere JWT de usuario. Usa token de dispositivo en header.
// Header: X-Device-Token: <token_dispositivo>
// Body: { id_colmena, temperatura, humedad }
// ----------------------------------------------------------------
router.post('/lectura', async (req, res) => {
  try {
    const deviceToken = req.headers['x-device-token'];

    if (!deviceToken) {
      return res.status(401).json({ success: false, error: 'Se requiere X-Device-Token.' });
    }

    // Verifica que el dispositivo esté registrado y activo
    const [dispositivo] = await pool.query(
      'SELECT id_dispositivo, id_colmena FROM Dispositivos_IoT WHERE token_api = ? AND activo = 1 LIMIT 1',
      [deviceToken]
    );

    if (!dispositivo.length) {
      return res.status(401).json({ success: false, error: 'Dispositivo no reconocido o desactivado.' });
    }

    const { temperatura, humedad, id_colmena } = req.body;
    const id_colmena_final = id_colmena || dispositivo[0].id_colmena;

    if (!temperatura || !id_colmena_final) {
      return res.status(400).json({ success: false, error: 'Campos requeridos: temperatura, id_colmena.' });
    }

    // Guarda la lectura
    await pool.query(
      'INSERT INTO Monitoreo_Colmena (id_colmena, temperatura, humedad, fecha_hora, modo) VALUES (?, ?, ?, NOW(), "real")',
      [id_colmena_final, parseFloat(temperatura), humedad ? parseFloat(humedad) : null]
    );

    // Actualiza última lectura del dispositivo
    await pool.query(
      'UPDATE Dispositivos_IoT SET ultima_lectura = NOW(), estado = "conectado" WHERE id_dispositivo = ?',
      [dispositivo[0].id_dispositivo]
    );

    // Genera alerta automática si temperatura fuera del rango normal (33-38°C)
    const temp = parseFloat(temperatura);
    if (temp < 30 || temp > 40) {
      await pool.query(
        `INSERT INTO Alertas (tipo, severidad, mensaje, id_colmena)
         VALUES ('temperatura_anormal', ?, ?, ?)`,
        [
          temp < 28 || temp > 42 ? 'critica' : 'advertencia',
          `Temperatura fuera de rango: ${temp}°C en colmena #${id_colmena_final}`,
          id_colmena_final
        ]
      );
    }

    res.json({ success: true, message: 'Lectura registrada.', timestamp: new Date().toISOString() });

  } catch (err) {
    console.error('[POST /monitoreo/lectura]', err.message);
    res.status(500).json({ success: false, error: 'Error al registrar lectura.' });
  }
});

// Rutas protegidas por JWT a partir de aquí
router.use(auth);

// GET /api/intranet/monitoreo/:id_colmena — Histórico de lecturas
// Acepta ?horas=24 (últimas N horas, default 24)
router.get('/:id_colmena', permiso('colmenas', 'ver'), async (req, res) => {
  try {
    const horas = parseInt(req.query.horas) || 24;
    const [rows] = await pool.query(
      `SELECT * FROM Monitoreo_Colmena
       WHERE id_colmena = ? AND fecha_hora >= NOW() - INTERVAL ? HOUR
       ORDER BY fecha_hora ASC`,
      [req.params.id_colmena, horas]
    );
    res.json({ success: true, total: rows.length, horas_consultadas: horas, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/intranet/monitoreo/dashboard/resumen — Resumen para dashboard
router.get('/dashboard/resumen', permiso('colmenas', 'ver'), async (req, res) => {
  try {
    const [stats] = await pool.query(`
      SELECT
        COUNT(DISTINCT id_colmena) AS colmenas_con_datos,
        ROUND(AVG(temperatura), 1) AS temp_promedio,
        ROUND(MIN(temperatura), 1) AS temp_minima,
        ROUND(MAX(temperatura), 1) AS temp_maxima,
        ROUND(AVG(humedad), 1)     AS humedad_promedio
      FROM Monitoreo_Colmena
      WHERE fecha_hora >= NOW() - INTERVAL 24 HOUR
    `);
    res.json({ success: true, data: stats[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
