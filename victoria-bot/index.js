// index.js
import express from 'express';
import dotenv from 'dotenv';
import { verificarConexion, enviarMensaje } from './modules/evolution.js';
import { conectarDB, obtenerProspectosNoAtendidos } from './modules/database.js';
import { procesarMensaje } from './handlers/message.js';
import { generarMensajeInicial } from './workflows/reactivacion.js';

dotenv.config();

const app = express();
app.use(express.json());

// Map para almacenar prospectos por teléfono
const prospectosPorTelefono = new Map();

// ============================================
// WEBHOOK - RECIBIR MENSAJES DE WHATSAPP
// ============================================
app.post('/webhook', async (req, res) => {
  try {
    const { event, data } = req.body;

    // Solo procesar mensajes entrantes
    if (event === 'messages.upsert') {
      const mensaje = data.messages?.[0];
      
      if (!mensaje || mensaje.key.fromMe) {
        return res.sendStatus(200);
      }

      const telefono = mensaje.key.remoteJid.replace('@s.whatsapp.net', '');
      
      // Buscar prospecto asociado a este teléfono
      const prospecto = prospectosPorTelefono.get(telefono);
      
      if (prospecto) {
        console.log(`\n📱 Mensaje entrante de: ${prospecto.nombre_completo}`);
        await procesarMensaje(mensaje, prospecto);
      } else {
        console.log(`⚠️  Mensaje de número no registrado: ${telefono}`);
      }
    }

    res.sendStatus(200);
  } catch (error) {
    console.error('❌ Error en webhook:', error);
    res.sendStatus(500);
  }
});

// ============================================
// HEALTH CHECK
// ============================================
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'Victoria Bot funcionando',
    prospectos_activos: prospectosPorTelefono.size
  });
});

// ============================================
// INICIAR CAMPAÑA DE REACTIVACIÓN
// ============================================
async function iniciarCampana() {
  try {
    console.log('\n🚀 Iniciando campaña de reactivación...\n');

    // 1. Verificar conexión a WhatsApp
    const conectado = await verificarConexion();
    if (!conectado) {
      console.error('❌ WhatsApp no está conectado. Verifica Evolution API.');
      return;
    }
    console.log('✅ WhatsApp conectado');

    // 2. Conectar a base de datos
    await conectarDB();
    console.log('✅ Base de datos conectada');

    // 3. Obtener prospectos
    const prospectos = await obtenerProspectosNoAtendidos(30);
    
    if (prospectos.length === 0) {
      console.log('ℹ️  No hay prospectos pendientes en este momento');
      return;
    }

    console.log(`\n📊 ${prospectos.length} prospectos encontrados\n`);

    // 4. Enviar mensaje inicial a cada prospecto
    for (let i = 0; i < prospectos.length; i++) {
      const prospecto = prospectos[i];
      
      try {
        // Limpiar teléfono
        const telefono = prospecto.telefono.replace(/\D/g, '');
        
        if (!telefono || telefono.length < 10) {
          console.log(`⚠️  Teléfono inválido para ${prospecto.nombre_completo}`);
          continue;
        }

        // Generar mensaje personalizado
        const mensajeInicial = generarMensajeInicial(prospecto);

        // Enviar mensaje
        await enviarMensaje(telefono, mensajeInicial);
        
        // Registrar prospecto en el mapa
        prospectosPorTelefono.set(telefono, prospecto);

        console.log(`✅ [${i + 1}/${prospectos.length}] ${prospecto.nombre_completo} - ${telefono}`);

        // Delay entre mensajes (15 segundos)
        if (i < prospectos.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 15000));
        }

      } catch (error) {
        console.error(`❌ Error con ${prospecto.nombre_completo}:`, error.message);
      }
    }

    console.log('\n✅ Campaña completada. Esperando respuestas...\n');

  } catch (error) {
    console.error('❌ Error en campaña:', error);
  }
}

// ============================================
// MENÚ INTERACTIVO
// ============================================
function mostrarMenu() {
  console.log('\n╔════════════════════════════════════════════════════╗');
  console.log('║  🤖 VICTORIA BOT - REACTIVACIÓN DE CITAS          ║');
  console.log('╠════════════════════════════════════════════════════╣');
  console.log('║  1. ▶️  Iniciar campaña de reactivación            ║');
  console.log('║  2. 📊 Ver estadísticas                            ║');
  console.log('║  3. 💬 Ver conversaciones activas                  ║');
  console.log('║  4. ❌ Salir                                        ║');
  console.log('╚════════════════════════════════════════════════════╝\n');
}

function mostrarEstadisticas() {
  console.log('\n📊 ESTADÍSTICAS:');
  console.log(`   Prospectos contactados: ${prospectosPorTelefono.size}`);
  console.log(`   Conversaciones activas: ${prospectosPorTelefono.size}`);
  console.log('');
}

// ============================================
// INICIAR SERVIDOR Y BOT
// ============================================
const PORT = process.env.PORT || 3000;

app.listen(PORT, async () => {
  console.clear();
  console.log('╔════════════════════════════════════════════════════╗');
  console.log('║                                                    ║');
  console.log('║  🤖 VICTORIA BOT - REACTIVACIÓN                    ║');
  console.log('║                                                    ║');
  console.log('║  Servidor webhook corriendo en:                   ║');
  console.log(`║  http://localhost:${PORT}                              ║`);
  console.log('║                                                    ║');
  console.log('╚════════════════════════════════════════════════════╝\n');

  // Verificar conexiones
  try {
    const whatsappOk = await verificarConexion();
    console.log(whatsappOk ? '✅ WhatsApp conectado' : '❌ WhatsApp desconectado');
    
    await conectarDB();
    console.log('✅ Base de datos conectada\n');

    // Mostrar menú
    mostrarMenu();
    
    // Manejar input del usuario
    process.stdin.on('data', async (data) => {
      const opcion = data.toString().trim();
      
      switch(opcion) {
        case '1':
          await iniciarCampana();
          mostrarMenu();
          break;
        case '2':
          mostrarEstadisticas();
          mostrarMenu();
          break;
        case '3':
          console.log('\n💬 Conversaciones activas:');
          prospectosPorTelefono.forEach((p, tel) => {
            console.log(`   ${p.nombre_completo} - ${tel}`);
          });
          console.log('');
          mostrarMenu();
          break;
        case '4':
          console.log('\n👋 Cerrando Victoria Bot...\n');
          process.exit(0);
          break;
        default:
          console.log('⚠️  Opción no válida');
          mostrarMenu();
      }
    });

  } catch (error) {
    console.error('❌ Error al iniciar:', error);
  }
});

// Manejar cierre graceful
process.on('SIGINT', () => {
  console.log('\n\n👋 Cerrando Victoria Bot...\n');
  process.exit(0);
});