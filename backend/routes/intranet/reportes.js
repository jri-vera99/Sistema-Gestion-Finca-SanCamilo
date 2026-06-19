// ==============================================================
// routes/intranet/reportes.js
// ==============================================================
const express = require('express');
const router  = express.Router();
const { pool } = require('../../db');
const authMiddleware = require('../../middlewares/auth');
const requirePermiso = require('../../middlewares/permiso');
const auditar = require('../../middlewares/auditoria');

router.use(authMiddleware);

// Helper to get data based on type
async function getReportData(tipo, fecha_inicio, fecha_fin) {
  let sql = '';
  let params = [];
  
  const f_inicio = fecha_inicio ? fecha_inicio + ' 00:00:00' : '2000-01-01 00:00:00';
  const f_fin = fecha_fin ? fecha_fin + ' 23:59:59' : '2100-12-31 23:59:59';
  
  if (tipo === 'produccion') {
    sql = `SELECT c.id_cosecha, col.id_colmena, c.tipo_producto, c.cantidad, c.fecha_cosecha, c.modo 
           FROM Cosechas c LEFT JOIN Colmenas col ON c.id_colmena = col.id_colmena 
           WHERE c.fecha_cosecha BETWEEN ? AND ? ORDER BY c.fecha_cosecha DESC`;
    params = [f_inicio, f_fin];
  } else if (tipo === 'hospedaje') {
    sql = `SELECT r.id_reserva, c.nombres, c.apellidos, r.id_habitacion, r.fecha_inicio, r.fecha_fin, r.estado_reserva 
           FROM Reservas r LEFT JOIN Clientes c ON r.id_cliente = c.id_cliente 
           WHERE r.creado_en BETWEEN ? AND ? ORDER BY r.creado_en DESC`;
    params = [f_inicio, f_fin];
  } else if (tipo === 'inventario') {
    sql = `SELECT i.id_inventario, f.nombre_fruta, i.cantidad, i.unidad_medida, i.fecha_registro 
           FROM Inventario_Frutas i LEFT JOIN Tipo_Fruta f ON i.id_tipo_fruta = f.id_tipo_fruta 
           WHERE i.fecha_registro BETWEEN ? AND ? ORDER BY i.fecha_registro DESC`;
    params = [f_inicio, f_fin];
  } else if (tipo === 'solicitudes') {
    sql = `SELECT id_solicitud, tipo, nombre_solicitante, correo, estado, creado_en 
           FROM Solicitudes_Publicas WHERE creado_en BETWEEN ? AND ? ORDER BY creado_en DESC`;
    params = [f_inicio, f_fin];
  } else {
    throw new Error('Tipo de reporte desconocido');
  }
  
  const [rows] = await pool.query(sql, params);
  return rows;
}

// Para CSV
router.get('/csv', requirePermiso('reportes', 'exportar'), auditar('generar_reporte', 'reportes'), async (req, res) => {
  try {
    const { tipo, fecha_inicio, fecha_fin } = req.query;
    const data = await getReportData(tipo, fecha_inicio, fecha_fin);
    
    if (!data.length) return res.status(404).send('No hay datos en este rango.');

    const headers = Object.keys(data[0]).join(',');
    const rows = data.map(row => Object.values(row).map(v => `"${v || ''}"`).join(',')).join('\n');
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="reporte_${tipo}.csv"`);
    res.send(`${headers}\n${rows}`);
  } catch (err) {
    res.status(500).send('Error generando CSV: ' + err.message);
  }
});

// Para Excel (HTML Table masquerading as XLS)
router.get('/excel', requirePermiso('reportes', 'exportar'), auditar('generar_reporte', 'reportes'), async (req, res) => {
  try {
    const { tipo, fecha_inicio, fecha_fin } = req.query;
    const data = await getReportData(tipo, fecha_inicio, fecha_fin);
    
    if (!data.length) return res.status(404).send('No hay datos en este rango.');

    const headers = Object.keys(data[0]);
    let html = '<html xmlns:x="urn:schemas-microsoft-com:office:excel"><body><table border="1"><thead><tr>';
    headers.forEach(h => html += `<th>${h}</th>`);
    html += '</tr></thead><tbody>';
    
    data.forEach(row => {
      html += '<tr>';
      headers.forEach(h => html += `<td>${row[h] || ''}</td>`);
      html += '</tr>';
    });
    html += '</tbody></table></body></html>';
    
    res.setHeader('Content-Type', 'application/vnd.ms-excel');
    res.setHeader('Content-Disposition', `attachment; filename="reporte_${tipo}.xls"`);
    res.send(html);
  } catch (err) {
    res.status(500).send('Error generando Excel: ' + err.message);
  }
});

// Para PDF (HTML Vista de Impresión)
router.get('/pdf', requirePermiso('reportes', 'exportar'), auditar('generar_reporte', 'reportes'), async (req, res) => {
  try {
    const { tipo, fecha_inicio, fecha_fin } = req.query;
    const data = await getReportData(tipo, fecha_inicio, fecha_fin);
    
    let html = `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <title>Reporte - ${tipo}</title>
      <style>
        body { font-family: sans-serif; padding: 20px; }
        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
        th, td { border: 1px solid #ccc; padding: 8px; text-align: left; }
        th { background: #f4f4f4; }
        @media print { .no-print { display: none; } }
      </style>
    </head>
    <body>
      <div class="no-print" style="margin-bottom: 20px;">
        <button onclick="window.print()" style="padding:10px 20px; background:#4CAF50; color:white; border:none; cursor:pointer;">Imprimir PDF</button>
      </div>
      <h2>Reporte de ${tipo.toUpperCase()}</h2>
      <p>Generado el: ${new Date().toLocaleString()}</p>
      ${!data.length ? '<p>No hay datos.</p>' : `
      <table>
        <thead><tr>${Object.keys(data[0]).map(h => `<th>${h}</th>`).join('')}</tr></thead>
        <tbody>
          ${data.map(row => `<tr>${Object.values(row).map(v => `<td>${v || ''}</td>`).join('')}</tr>`).join('')}
        </tbody>
      </table>
      `}
      <script>window.onload = () => window.print();</script>
    </body>
    </html>`;
    
    res.send(html);
  } catch (err) {
    res.status(500).send('Error generando Vista PDF: ' + err.message);
  }
});

module.exports = router;
