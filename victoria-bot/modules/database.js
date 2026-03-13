// modules/database.js
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

let pool;

export async function conectarDB() {
  if (!pool) {
    pool = mysql.createPool({
      host: process.env.ERP_DB_HOST,
      port: process.env.ERP_DB_PORT,
      user: process.env.ERP_DB_USER,
      password: process.env.ERP_DB_PASS,
      database: process.env.ERP_DB_NAME,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0
    });
    
    console.log('✅ Pool de conexiones MySQL creado');
  }
  
  return pool;
}

export async function obtenerProspectosNoAtendidos(limite = 30) {
  try {
    const pool = await conectarDB();
    
    const [rows] = await pool.execute(`
      SELECT 
        c.id_cit,
        c.nombre_completo,
        c.telefono,
        c.fecha_cita,
        c.modalidad,
        c.observaciones,
        u.nombre_usuario as asesor,
        DATEDIFF(NOW(), c.fecha_cita) as dias_desde_cita
      FROM cita c
      LEFT JOIN usuario u ON c.id_usu = u.id_usu
      WHERE c.id_est = 12
      AND c.telefono IS NOT NULL
      AND c.telefono != ''
      ORDER BY c.fecha_cita DESC
      LIMIT ?
    `, [limite]);
    
    console.log(`📊 ${rows.length} prospectos no atendidos encontrados`);
    return rows;
    
  } catch (error) {
    console.error('❌ Error obteniendo prospectos:', error.message);
    return [];
  }
}

export async function guardarConversacion(id_cit, historial, scoring, temperatura) {
  try {
    const pool = await conectarDB();
    
    const [existing] = await pool.execute(
      'SELECT id_conversacion FROM conversacion_cita WHERE id_cit = ?',
      [id_cit]
    );
    
    if (existing.length > 0) {
      await pool.execute(`
        UPDATE conversacion_cita 
        SET historial_json = ?,
            scoring = ?,
            temperatura = ?,
            fecha_actualizacion = NOW()
        WHERE id_cit = ?
      `, [JSON.stringify(historial), scoring, temperatura, id_cit]);
    } else {
      await pool.execute(`
        INSERT INTO conversacion_cita 
        (id_cit, historial_json, scoring, temperatura, estado_conversacion)
        VALUES (?, ?, ?, ?, 'ACTIVA')
      `, [id_cit, JSON.stringify(historial), scoring, temperatura]);
    }
    
  } catch (error) {
    console.error('❌ Error guardando conversación:', error.message);
  }
}