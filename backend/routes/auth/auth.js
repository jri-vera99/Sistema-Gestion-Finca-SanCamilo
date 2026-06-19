// ================================================================
// routes/auth/auth.js — Login, logout, whoami
// ================================================================

const express = require('express');
const router  = express.Router();
const bcrypt  = require('bcrypt');
const jwt     = require('jsonwebtoken');
const { pool } = require('../../db');
const authMiddleware = require('../../middlewares/auth');
const auditar = require('../../middlewares/auditoria');

// ----------------------------------------------------------------
// POST /api/auth/login
// Body: { correo, contrasena }
// Retorna: JWT + datos básicos del usuario
// ----------------------------------------------------------------
router.post('/login', auditar('login', 'auth'), async (req, res) => {
  try {
    const { correo, contrasena } = req.body;

    if (!correo || !contrasena) {
      return res.status(400).json({ success: false, error: 'Correo y contraseña son obligatorios.' });
    }

    console.log(`[LOGIN] Intento de acceso para correo: ${correo}`);

    // Busca el usuario por correo
    const [rows] = await pool.query(
      `SELECT u.*, r.nombre_rol
       FROM Usuarios u
       JOIN Roles r ON u.id_rol = r.id_rol
       WHERE u.correo = ?
       LIMIT 1`,
      [correo.toLowerCase().trim()]
    );

    if (!rows.length) {
      console.log(`[LOGIN] Usuario no encontrado: ${correo}`);
      return res.status(401).json({ success: false, error: 'Correo o contraseña incorrectos.' });
    }

    const usuario = rows[0];

    if (usuario.estado !== 'activo' || usuario.activo !== 1) {
      console.log(`[LOGIN] Usuario inactivo: ${correo}`);
      return res.status(401).json({ success: false, error: 'Usuario inactivo.' });
    }

    console.log(`[LOGIN] Usuario encontrado: ${correo}`);

    // Verifica la contraseña con bcrypt
    const coincide = await bcrypt.compare(contrasena, usuario.contrasena);
    if (!coincide) {
      console.log(`[LOGIN] Contraseña incorrecta para: ${correo}`);
      return res.status(401).json({ success: false, error: 'Correo o contraseña incorrectos.' });
    }

    console.log(`[LOGIN] Contraseña válida para: ${correo}. Generando sesión...`);

    // Obtiene los módulos que el usuario puede ver
    let modulos = [];
    if (usuario.es_superadmin === 1) {
      const [allMods] = await pool.query(`SELECT slug, nombre, icono, orden FROM Modulos WHERE activo = 1 ORDER BY orden`);
      modulos = allMods;
    } else {
      const [userMods] = await pool.query(`
        SELECT DISTINCT m.slug, m.nombre, m.icono, m.orden
        FROM Modulos m
        JOIN Rol_Modulo_Permiso rmp ON m.id_modulo = rmp.id_modulo
        JOIN Permisos p ON rmp.id_permiso = p.id_permiso AND p.codigo = 'ver'
        WHERE rmp.id_rol = ? AND m.activo = 1
        ORDER BY m.orden
      `, [usuario.id_rol]);
      modulos = userMods;
    }

    // Genera el JWT
    const payload = {
      id_usuario:    usuario.id_usuario,
      nombres:       usuario.nombres,
      correo:        usuario.correo,
      id_rol:        usuario.id_rol,
      nombre_rol:    usuario.nombre_rol,
      es_superadmin: usuario.es_superadmin
    };

    const token = jwt.sign(payload, process.env.JWT_SECRET || 'finca_san_camilo_secreto_seguro_por_defecto', {
      expiresIn: process.env.JWT_EXPIRES_IN || '8h'
    });

    // Actualiza la fecha de última sesión
    await pool.query(
      'UPDATE Usuarios SET ultima_sesion = NOW() WHERE id_usuario = ?',
      [usuario.id_usuario]
    );

    res.json({
      success: true,
      token,
      usuario: {
        id_usuario:    usuario.id_usuario,
        nombres:       usuario.nombres,
        correo:        usuario.correo,
        nombre_rol:    usuario.nombre_rol,
        es_superadmin: usuario.es_superadmin === 1
      },
      modulos_permitidos: modulos
    });

  } catch (err) {
    console.error('[POST /auth/login] Error interno de autenticación:', err.message);
    res.status(500).json({ success: false, error: 'Error interno de autenticación.' });
  }
});

// ----------------------------------------------------------------
// GET /api/auth/me — Retorna datos del usuario autenticado actual
// ----------------------------------------------------------------
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT u.id_usuario, u.nombres, u.correo, u.activo,
              u.es_superadmin, u.ultima_sesion, r.nombre_rol
       FROM Usuarios u
       JOIN Roles r ON u.id_rol = r.id_rol
       WHERE u.id_usuario = ?`,
      [req.usuario.id_usuario]
    );

    if (!rows.length) {
      return res.status(404).json({ success: false, error: 'Usuario no encontrado.' });
    }

    // Módulos permitidos
    let modulos = [];
    const usuarioAuth = rows[0];
    if (usuarioAuth.es_superadmin === 1) {
      const [allMods] = await pool.query(`SELECT slug, nombre, icono, orden FROM Modulos WHERE activo = 1 ORDER BY orden`);
      modulos = allMods;
    } else {
      const [userMods] = await pool.query(`
        SELECT DISTINCT m.slug, m.nombre, m.icono, m.orden
        FROM Modulos m
        JOIN Rol_Modulo_Permiso rmp ON m.id_modulo = rmp.id_modulo
        JOIN Permisos p ON rmp.id_permiso = p.id_permiso AND p.codigo = 'ver'
        WHERE rmp.id_rol = ? AND m.activo = 1
        ORDER BY m.orden
      `, [usuarioAuth.id_rol]);
      modulos = userMods;
    }

    res.json({
      success: true,
      usuario: rows[0],
      modulos_permitidos: modulos
    });

  } catch (err) {
    console.error('[GET /auth/me]', err.message);
    res.status(500).json({ success: false, error: 'Error en el servidor.' });
  }
});

// ----------------------------------------------------------------
// POST /api/auth/cambiar-contrasena — Cambiar contraseña propia
// Body: { contrasena_actual, nueva_contrasena }
// ----------------------------------------------------------------
router.post('/cambiar-contrasena', authMiddleware, auditar('cambiar_contrasena', 'auth'), async (req, res) => {
  try {
    const { contrasena_actual, nueva_contrasena } = req.body;

    if (!contrasena_actual || !nueva_contrasena) {
      return res.status(400).json({ success: false, error: 'Ambas contraseñas son requeridas.' });
    }

    if (nueva_contrasena.length < 8) {
      return res.status(400).json({ success: false, error: 'La nueva contraseña debe tener al menos 8 caracteres.' });
    }

    const [rows] = await pool.query(
      'SELECT contrasena FROM Usuarios WHERE id_usuario = ?',
      [req.usuario.id_usuario]
    );

    const coincide = await bcrypt.compare(contrasena_actual, rows[0].contrasena);
    if (!coincide) {
      return res.status(401).json({ success: false, error: 'La contraseña actual es incorrecta.' });
    }

    const hash = await bcrypt.hash(nueva_contrasena, 12);
    await pool.query(
      'UPDATE Usuarios SET contrasena = ? WHERE id_usuario = ?',
      [hash, req.usuario.id_usuario]
    );

    res.json({ success: true, message: 'Contraseña actualizada correctamente.' });

  } catch (err) {
    console.error('[POST /auth/cambiar-contrasena]', err.message);
    res.status(500).json({ success: false, error: 'Error al cambiar contraseña.' });
  }
});

module.exports = router;
