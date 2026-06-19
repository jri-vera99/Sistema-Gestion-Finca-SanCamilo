// ================================================================
// middlewares/permiso.js — Guard de módulos y permisos
// ================================================================
// Uso: router.get('/', require('../middlewares/permiso')('colmenas','ver'), handler)
// Verifica que el usuario tenga el permiso requerido para el módulo.
// El superadmin siempre pasa.

const { pool } = require('../db');

/**
 * @param {string} slugModulo  - Slug del módulo: 'colmenas', 'hospedaje', etc.
 * @param {string} codigoPermiso - Permiso requerido: 'ver', 'crear', 'editar', 'eliminar', 'exportar', 'simular'
 */
module.exports = function requirePermiso(slugModulo, codigoPermiso = 'ver') {
  return async (req, res, next) => {
    try {
      // req.usuario es inyectado por auth.js
      if (!req.usuario) {
        return res.status(401).json({ success: false, error: 'No autenticado.' });
      }

      // El superadmin tiene acceso a todo sin consultar permisos
      if (req.usuario.es_superadmin === 1) {
        return next();
      }

      // Consulta si el rol del usuario tiene el permiso en el módulo
      const [rows] = await pool.query(`
        SELECT rmp.id
        FROM Rol_Modulo_Permiso rmp
        JOIN Modulos  m ON rmp.id_modulo  = m.id_modulo  AND m.slug  = ?
        JOIN Permisos p ON rmp.id_permiso = p.id_permiso AND p.codigo = ?
        WHERE rmp.id_rol = ?
        LIMIT 1
      `, [slugModulo, codigoPermiso, req.usuario.id_rol]);

      if (rows.length) {
        // Verificar que no tenga un permiso individual que lo deniegue
        const [extra] = await pool.query(`
          SELECT permitido
          FROM Usuario_Permiso_Extra upe
          JOIN Modulos  m ON upe.id_modulo  = m.id_modulo  AND m.slug  = ?
          JOIN Permisos p ON upe.id_permiso = p.id_permiso AND p.codigo = ?
          WHERE upe.id_usuario = ?
          LIMIT 1
        `, [slugModulo, codigoPermiso, req.usuario.id_usuario]);

        if (extra.length && extra[0].permitido === 0) {
          return res.status(403).json({
            success: false,
            error: `No tienes permiso para "${codigoPermiso}" en el módulo "${slugModulo}".`
          });
        }

        return next();
      }

      // Verificar permisos individuales que concedan acceso
      const [extraGrant] = await pool.query(`
        SELECT permitido
        FROM Usuario_Permiso_Extra upe
        JOIN Modulos  m ON upe.id_modulo  = m.id_modulo  AND m.slug  = ?
        JOIN Permisos p ON upe.id_permiso = p.id_permiso AND p.codigo = ?
        WHERE upe.id_usuario = ? AND upe.permitido = 1
        LIMIT 1
      `, [slugModulo, codigoPermiso, req.usuario.id_usuario]);

      if (extraGrant.length) {
        return next();
      }

      return res.status(403).json({
        success: false,
        error: `No tienes acceso al módulo "${slugModulo}".`
      });

    } catch (err) {
      console.error('[permiso.js]', err.message);
      res.status(500).json({ success: false, error: 'Error al verificar permisos.' });
    }
  };
};
