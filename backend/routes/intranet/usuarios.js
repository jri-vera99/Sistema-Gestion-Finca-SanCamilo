// ================================================================
// routes/intranet/usuarios.js — Gestión de usuarios y roles
// Solo superadmin o usuarios con permiso en módulo 'usuarios'
// ================================================================

const express  = require('express');
const router   = express.Router();
const bcrypt   = require('bcrypt');
const { pool } = require('../../db');
const auth     = require('../../middlewares/auth');
const permiso  = require('../../middlewares/permiso');
const auditar  = require('../../middlewares/auditoria');

// Todos los endpoints requieren autenticación
router.use(auth);

// ----------------------------------------------------------------
// GET /api/intranet/usuarios — Lista usuarios
// ----------------------------------------------------------------
router.get('/', permiso('usuarios', 'ver'), async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT u.id_usuario, u.nombres, u.correo, u.estado, u.activo,
             u.es_superadmin, u.ultima_sesion, u.creado_en,
             r.nombre_rol, r.id_rol
      FROM Usuarios u
      JOIN Roles r ON u.id_rol = r.id_rol
      ORDER BY u.es_superadmin DESC, u.creado_en DESC
    `);
    res.json({ success: true, total: rows.length, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ----------------------------------------------------------------
// POST /api/intranet/usuarios — Crear nuevo usuario
// Body: { nombres, correo, contrasena, id_rol }
// ----------------------------------------------------------------
router.post('/', permiso('usuarios', 'crear'), auditar('crear_usuario', 'usuarios'), async (req, res) => {
  try {
    const { nombres, correo, contrasena, id_rol, estado = 'activo' } = req.body;

    if (!nombres || !correo || !contrasena || !id_rol) {
      return res.status(400).json({ success: false, error: 'Faltan campos: nombres, correo, contrasena, id_rol.' });
    }

    // Verifica que el correo no exista
    const [existe] = await pool.query('SELECT id_usuario FROM Usuarios WHERE correo = ?', [correo]);
    if (existe.length) {
      return res.status(409).json({ success: false, error: 'Ya existe un usuario con ese correo.' });
    }

    const hash = await bcrypt.hash(contrasena, 12);

    const [result] = await pool.query(
      'INSERT INTO Usuarios (nombres, correo, contrasena, id_rol, estado, activo, es_superadmin) VALUES (?, ?, ?, ?, ?, 1, 0)',
      [nombres, correo.toLowerCase().trim(), hash, id_rol, estado]
    );

    res.status(201).json({ success: true, message: 'Usuario creado.', id_insertado: result.insertId });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ----------------------------------------------------------------
// PUT /api/intranet/usuarios/:id — Actualizar usuario
// El superadmin (id=1) no puede ser modificado por otros usuarios
// ----------------------------------------------------------------
router.put('/:id', permiso('usuarios', 'editar'), auditar('editar_usuario', 'usuarios'), async (req, res) => {
  try {
    const id = parseInt(req.params.id);

    // Protección: no permitir editar el superadmin si no eres tú mismo
    if (id !== req.usuario.id_usuario) {
      const [target] = await pool.query('SELECT es_superadmin FROM Usuarios WHERE id_usuario = ?', [id]);
      if (target.length && target[0].es_superadmin && !req.usuario.es_superadmin) {
        return res.status(403).json({ success: false, error: 'No puedes modificar al superadministrador.' });
      }
    }

    const { nombres, id_rol, estado, activo } = req.body;

    await pool.query(
      'UPDATE Usuarios SET nombres = COALESCE(?, nombres), id_rol = COALESCE(?, id_rol), estado = COALESCE(?, estado), activo = COALESCE(?, activo) WHERE id_usuario = ?',
      [nombres || null, id_rol || null, estado || null, activo !== undefined ? activo : null, id]
    );

    res.json({ success: true, message: 'Usuario actualizado.' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ----------------------------------------------------------------
// PUT /api/intranet/usuarios/:id/estado — Activar/desactivar
// ----------------------------------------------------------------
router.put('/:id/estado', permiso('usuarios', 'editar'), auditar('cambiar_estado_usuario', 'usuarios'), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { activo } = req.body;

    const [target] = await pool.query('SELECT es_superadmin FROM Usuarios WHERE id_usuario = ?', [id]);
    if (!target.length) {
      return res.status(404).json({ success: false, error: 'Usuario no encontrado.' });
    }
    if (target[0].es_superadmin === 1 && activo === 0) {
      return res.status(403).json({ success: false, error: 'El superadministrador principal no puede ser desactivado.' });
    }

    await pool.query('UPDATE Usuarios SET activo = ?, estado = ? WHERE id_usuario = ?', 
      [activo ? 1 : 0, activo ? 'activo' : 'inactivo', id]);
    res.json({ success: true, message: activo ? 'Usuario activado.' : 'Usuario desactivado.' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ----------------------------------------------------------------
// PUT /api/intranet/usuarios/:id/password — Cambiar contraseña
// ----------------------------------------------------------------
router.put('/:id/password', permiso('usuarios', 'editar'), auditar('cambiar_password', 'usuarios'), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { contrasena } = req.body;

    if (id !== req.usuario.id_usuario) {
      const [target] = await pool.query('SELECT es_superadmin FROM Usuarios WHERE id_usuario = ?', [id]);
      if (target.length && target[0].es_superadmin && !req.usuario.es_superadmin) {
        return res.status(403).json({ success: false, error: 'No puedes cambiar la contraseña del superadministrador.' });
      }
    }

    if (!contrasena || contrasena.length < 8) {
      return res.status(400).json({ success: false, error: 'La contraseña debe tener al menos 8 caracteres.' });
    }

    const hash = await bcrypt.hash(contrasena, 12);
    await pool.query('UPDATE Usuarios SET contrasena = ? WHERE id_usuario = ?', [hash, id]);
    res.json({ success: true, message: 'Contraseña actualizada.' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ----------------------------------------------------------------
// GET /api/intranet/usuarios/roles — Lista todos los roles
// ----------------------------------------------------------------
router.get('/roles/lista', permiso('usuarios', 'ver'), async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM Roles WHERE activo = 1 ORDER BY id_rol');
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ----------------------------------------------------------------
// GET /api/intranet/usuarios/modulos-permisos
// Lista módulos con permisos para el formulario de roles
// ----------------------------------------------------------------
router.get('/modulos-permisos', permiso('usuarios', 'ver'), async (req, res) => {
  try {
    const [modulos]  = await pool.query('SELECT * FROM Modulos WHERE activo = 1 ORDER BY orden');
    const [permisos] = await pool.query('SELECT * FROM Permisos ORDER BY id_permiso');
    res.json({ success: true, modulos, permisos });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
