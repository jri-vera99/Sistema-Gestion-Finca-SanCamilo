// ================================================================
// middlewares/auth.js — Verificación de token JWT
// ================================================================
// Uso: app.use('/api/intranet', require('./middlewares/auth'));
// Si el token es válido, agrega req.usuario con los datos del usuario.
// Si no hay token o es inválido, responde 401 Unauthorized.

const jwt = require('jsonwebtoken');
const { pool } = require('../db');

module.exports = async function authMiddleware(req, res, next) {
  try {
    // El token se envía en el header Authorization: Bearer <token>
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'Acceso no autorizado. Se requiere autenticación.'
      });
    }

    const token = authHeader.split(' ')[1];

    // Verifica y decodifica el token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Verifica que el usuario siga activo en la BD
    const [rows] = await pool.query(
      'SELECT id_usuario, nombres, correo, id_rol, activo, es_superadmin FROM Usuarios WHERE id_usuario = ? AND activo = 1',
      [decoded.id_usuario]
    );

    if (!rows.length) {
      return res.status(401).json({
        success: false,
        error: 'Usuario no encontrado o desactivado.'
      });
    }

    // Inyecta datos del usuario en la petición para usar en rutas
    req.usuario = rows[0];
    next();

  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, error: 'La sesión ha expirado. Inicia sesión nuevamente.' });
    }
    if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({ success: false, error: 'Token inválido.' });
    }
    console.error('[auth.js]', err.message);
    res.status(500).json({ success: false, error: 'Error en autenticación.' });
  }
};
