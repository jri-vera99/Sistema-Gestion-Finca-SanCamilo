// ================================================================
// routes/public/solicitudes.js — Solicitudes del portal público
// ================================================================
// Sin autenticación. Clientes externos envían solicitudes de:
//   - compra de productos
//   - reserva de hospedaje
//   - contacto
// Las solicitudes quedan en estado 'pendiente' para gestión interna.

const express  = require('express');
const router   = express.Router();
const multer   = require('multer');
const path     = require('path');
const { v4: uuidv4 } = require('uuid');
const { pool } = require('../../db');

// Configuración de multer para comprobantes de pago
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = process.env.UPLOAD_DIR || './uploads';
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `comprobante_${uuidv4()}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB máximo
  fileFilter: (req, file, cb) => {
    const allowed = ['.jpg', '.jpeg', '.png', '.pdf', '.webp'];
    if (allowed.includes(path.extname(file.originalname).toLowerCase())) {
      cb(null, true);
    } else {
      cb(new Error('Solo se permiten archivos JPG, PNG, PDF o WebP.'));
    }
  }
});

// ----------------------------------------------------------------
// POST /api/public/solicitudes
// Body form-data o JSON:
//   tipo: 'compra' | 'reserva' | 'contacto'
//   nombre_solicitante, correo, telefono, mensaje
//   modo_pago: 'comprobante' | 'en_sitio'
//   comprobante: (archivo) — solo si modo_pago = 'comprobante'
//   productos: [{id_producto, cantidad}] — si tipo = 'compra'
//   id_habitacion, fecha_inicio, fecha_fin — si tipo = 'reserva'
// ----------------------------------------------------------------
router.post('/', upload.single('comprobante'), async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const {
      tipo,
      nombre_solicitante,
      correo,
      telefono,
      mensaje,
      modo_pago = 'en_sitio',
      id_habitacion,
      fecha_inicio,
      fecha_fin
    } = req.body;

    // Validación básica
    if (!tipo || !nombre_solicitante || !correo) {
      await conn.rollback();
      return res.status(400).json({
        success: false,
        error: 'Campos requeridos: tipo, nombre_solicitante, correo.'
      });
    }

    if (!['compra', 'reserva', 'contacto'].includes(tipo)) {
      await conn.rollback();
      return res.status(400).json({ success: false, error: 'Tipo inválido.' });
    }

    const comprobante_url = req.file ? `/uploads/${req.file.filename}` : null;

    // Insertar solicitud principal
    const [result] = await conn.query(
      `INSERT INTO Solicitudes_Publicas
         (tipo, nombre_solicitante, correo, telefono, mensaje,
          modo_pago, comprobante_url, estado, modo)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'pendiente', 'real')`,
      [tipo, nombre_solicitante, correo.toLowerCase().trim(),
       telefono || null, mensaje || null, modo_pago, comprobante_url]
    );

    const id_solicitud = result.insertId;

    // Si es reserva, también crear pre-reserva si tiene habitación y fechas
    if (tipo === 'reserva' && id_habitacion && fecha_inicio && fecha_fin) {
      // Verifica que el cliente exista o lo crea
      let id_cliente = null;
      const [clientes] = await conn.query(
        'SELECT id_cliente FROM Clientes WHERE correo = ? LIMIT 1',
        [correo.toLowerCase().trim()]
      );

      if (clientes.length) {
        id_cliente = clientes[0].id_cliente;
      } else {
        const [nuevoCliente] = await conn.query(
          'INSERT INTO Clientes (nombres, correo, telefono) VALUES (?, ?, ?)',
          [nombre_solicitante, correo.toLowerCase().trim(), telefono || null]
        );
        id_cliente = nuevoCliente.insertId;
      }

      // Crea la reserva en estado 'pendiente'
      const [reserva] = await conn.query(
        `INSERT INTO Reservas
           (id_cliente, id_habitacion, fecha_inicio, fecha_fin, estado_reserva, total, modo)
         VALUES (?, ?, ?, ?, 'pendiente', 0, 'real')`,
        [id_cliente, id_habitacion, fecha_inicio, fecha_fin]
      );

      // Vincula la solicitud con la reserva
      await conn.query(
        'UPDATE Solicitudes_Publicas SET id_reserva = ? WHERE id_solicitud = ?',
        [reserva.insertId, id_solicitud]
      );
    }

    // Si tiene productos, guardar detalle
    let productos = [];
    try { productos = JSON.parse(req.body.productos || '[]'); } catch {}
    for (const p of productos) {
      if (p.id_producto && p.cantidad) {
        await conn.query(
          'INSERT INTO Solicitud_Detalle (id_solicitud, id_producto, cantidad) VALUES (?, ?, ?)',
          [id_solicitud, p.id_producto, p.cantidad]
        );
      }
    }

    await conn.commit();

    res.status(201).json({
      success: true,
      message: 'Solicitud recibida correctamente. Nos pondremos en contacto pronto.',
      id_solicitud
    });

  } catch (err) {
    await conn.rollback();
    console.error('[POST /public/solicitudes]', err.message);
    res.status(500).json({ success: false, error: 'Error al procesar la solicitud.' });
  } finally {
    conn.release();
  }
});

// GET /api/public/galeria — Galería pública de imágenes
router.get('/galeria', async (req, res) => {
  try {
    const { categoria } = req.query;
    let sql = 'SELECT url, titulo, alt_text, categoria FROM Galeria WHERE activo = 1';
    const params = [];
    if (categoria) { sql += ' AND categoria = ?'; params.push(categoria); }
    sql += ' ORDER BY orden ASC';
    const [rows] = await pool.query(sql, params);
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Error al obtener galería.' });
  }
});

module.exports = router;
