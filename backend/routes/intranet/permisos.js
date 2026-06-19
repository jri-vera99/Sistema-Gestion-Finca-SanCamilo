// ================================================================
// routes/intranet/permisos.js
// ================================================================
const express = require('express');
const router  = express.Router();
const { pool } = require('../../db');
const authMiddleware = require('../../middlewares/auth');
const requirePermiso = require('../../middlewares/permiso');
const auditar = require('../../middlewares/auditoria');

router.use(authMiddleware);

// GET /api/intranet/permisos/roles/:id_rol
// Obtener permisos de un rol
router.get('/roles/:id_rol', requirePermiso('usuarios', 'ver'), async (req, res) => {
  try {
    const id_rol = parseInt(req.params.id_rol);
    const [rows] = await pool.query(`
      SELECT id_modulo, id_permiso 
      FROM Rol_Modulo_Permiso 
      WHERE id_rol = ?
    `, [id_rol]);
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/intranet/permisos/roles/:id_rol
// Actualizar permisos de un rol
router.post('/roles/:id_rol', requirePermiso('usuarios', 'editar'), auditar('editar_permisos_rol', 'usuarios'), async (req, res) => {
  try {
    const id_rol = parseInt(req.params.id_rol);
    const { permisos } = req.body; // Array de { id_modulo, id_permiso }

    if (!Array.isArray(permisos)) {
      return res.status(400).json({ success: false, error: 'Formato inválido.' });
    }

    // El superadmin (id_rol = 1) no puede tener sus permisos modificados por aquí (los tiene por bypass siempre)
    // Pero si quieren guardar, lo bloqueamos por seguridad
    if (id_rol === 1) {
      return res.status(403).json({ success: false, error: 'No se pueden modificar los permisos del Superadministrador.' });
    }

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      // Borrar anteriores
      await conn.query('DELETE FROM Rol_Modulo_Permiso WHERE id_rol = ?', [id_rol]);

      // Insertar nuevos
      if (permisos.length > 0) {
        const values = permisos.map(p => [id_rol, p.id_modulo, p.id_permiso]);
        await conn.query('INSERT IGNORE INTO Rol_Modulo_Permiso (id_rol, id_modulo, id_permiso) VALUES ?', [values]);
      }

      await conn.commit();
      res.json({ success: true, message: 'Permisos actualizados.' });
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/intranet/permisos/usuarios/:id_usuario
// Obtener permisos adicionales/denegados de un usuario
router.get('/usuarios/:id_usuario', requirePermiso('usuarios', 'ver'), async (req, res) => {
  try {
    const id_usuario = parseInt(req.params.id_usuario);
    const [rows] = await pool.query(`
      SELECT id_modulo, id_permiso, permitido 
      FROM Usuario_Permiso_Extra 
      WHERE id_usuario = ?
    `, [id_usuario]);
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/intranet/permisos/usuarios/:id_usuario
// Actualizar permisos extras de un usuario
router.post('/usuarios/:id_usuario', requirePermiso('usuarios', 'editar'), auditar('editar_permisos_usuario', 'usuarios'), async (req, res) => {
  try {
    const id_usuario = parseInt(req.params.id_usuario);
    const { permisos } = req.body; // Array de { id_modulo, id_permiso, permitido }

    if (!Array.isArray(permisos)) {
      return res.status(400).json({ success: false, error: 'Formato inválido.' });
    }

    const [target] = await pool.query('SELECT es_superadmin FROM Usuarios WHERE id_usuario = ?', [id_usuario]);
    if (target.length && target[0].es_superadmin) {
      return res.status(403).json({ success: false, error: 'El superadministrador tiene acceso total por defecto.' });
    }

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      await conn.query('DELETE FROM Usuario_Permiso_Extra WHERE id_usuario = ?', [id_usuario]);

      if (permisos.length > 0) {
        const values = permisos.map(p => [id_usuario, p.id_modulo, p.id_permiso, p.permitido ? 1 : 0]);
        await conn.query('INSERT IGNORE INTO Usuario_Permiso_Extra (id_usuario, id_modulo, id_permiso, permitido) VALUES ?', [values]);
      }

      await conn.commit();
      res.json({ success: true, message: 'Permisos individuales actualizados.' });
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
