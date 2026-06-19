// ================================================================
// middlewares/auditoria.js — Logging automático de acciones
// ================================================================
// Uso: router.post('/', auditar('crear_colmena','colmenas'), handler)
// Registra la acción después de que el handler responde exitosamente.

const { pool } = require('../db');

/**
 * @param {string} accion  - Nombre de la acción: 'login', 'crear_colmena', etc.
 * @param {string} modulo  - Módulo afectado: 'colmenas', 'hospedaje', etc.
 */
module.exports = function auditar(accion, modulo = null) {
  return async (req, res, next) => {
    // Capturamos el método original de res.json para interceptarlo
    const originalJson = res.json.bind(res);

    res.json = async function (data) {
      // Solo auditamos si la respuesta fue exitosa (status 2xx)
      if (res.statusCode >= 200 && res.statusCode < 300 && data?.success !== false) {
        try {
          const ip        = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || null;
          const userAgent = req.headers['user-agent'] || null;
          const idUsuario = req.usuario?.id_usuario || null;

          // Construye el detalle JSON con información relevante del request
          const detalle = {
            method: req.method,
            path:   req.originalUrl,
            body:   req.method !== 'GET' ? sanitizeBody(req.body) : undefined,
            params: req.params
          };

          await pool.query(
            'INSERT INTO Auditoria (id_usuario, accion, modulo, detalle_json, ip, user_agent) VALUES (?, ?, ?, ?, ?, ?)',
            [idUsuario, accion, modulo, JSON.stringify(detalle), ip, userAgent]
          );
        } catch (err) {
          // No interrumpir la respuesta si falla la auditoría
          console.error('[auditoria.js] Error al registrar:', err.message);
        }
      }
      return originalJson(data);
    };

    next();
  };
};

/**
 * Elimina campos sensibles del body antes de guardar en auditoría.
 */
function sanitizeBody(body) {
  if (!body) return {};
  const sanitized = { ...body };
  delete sanitized.contrasena;
  delete sanitized.password;
  delete sanitized.token;
  return sanitized;
}
