// ==============================================================
// db.js — Configuración y conexión al pool de MySQL (Railway)
// ==============================================================
// Usamos mysql2/promise para consultas asíncronas con async/await.
// createPool gestiona múltiples conexiones simultáneas eficientemente.

const mysql = require('mysql2/promise');
require('dotenv').config(); // Carga las variables del archivo .env

// Pool de conexiones: reutiliza conexiones en lugar de abrir/cerrar
// una por cada petición, lo cual mejora el rendimiento.
const pool = mysql.createPool({
  host:     process.env.DB_HOST,       // Ej: containers-us-west-xxx.railway.app
  port:     parseInt(process.env.DB_PORT) || 3306,
  user:     process.env.DB_USER,       // Normalmente 'root' en Railway
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,       // Normalmente 'railway'
  waitForConnections: true,            // Espera si no hay conexión disponible
  connectionLimit: 10,                 // Máximo 10 conexiones simultáneas
  queueLimit: 0,                       // Sin límite de consultas en cola
  ssl: {
    rejectUnauthorized: false          // Necesario para conexiones SSL de Railway
  }
});

// Función que verifica que la conexión funciona al iniciar el servidor
async function testConnection() {
  try {
    const conn = await pool.getConnection();
    console.log('✅ Conexión a MySQL (Railway) establecida correctamente.');
    conn.release(); // Devuelve la conexión al pool
  } catch (err) {
    console.error('❌ Error al conectar con la base de datos:', err.message);
    console.error('   Verifica los datos en tu archivo .env');
    process.exit(1); // Termina el proceso si no hay BD
  }
}

module.exports = { pool, testConnection };
