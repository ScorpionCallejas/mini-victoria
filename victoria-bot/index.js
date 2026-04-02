// index.js
import express from 'express';
import dotenv from 'dotenv';
import { verificarConexion, enviarMensaje, configurarWebhook } from './modules/evolution.js';
import { getPendientes, guardarChatId } from './modules/api.js';
import { procesarMensaje } from './handlers/message.js';
import { generarMensajeInicial } from './modules/ai.js';
import { iniciarPolling, registrarProspecto } from './modules/poller.js';

dotenv.config();

const app = express();
app.use(express.json());

// Map para almacenar prospectos por teléfono
const prospectosPorTelefono = new Map();

// Busca un prospecto comparando los últimos 10 dígitos del teléfono
// Resuelve el problema de México donde WA a veces quita/agrega el "1" (52 vs 521)
function buscarProspecto(telefonoEntrante) {
  const sufijo = telefonoEntrante.slice(-10);
  for (const [tel, prospecto] of prospectosPorTelefono) {
    if (tel.slice(-10) === sufijo) return prospecto;
  }
  return null;
}

// ============================================
// WEBHOOK - RECIBIR MENSAJES DE WHATSAPP
// ============================================

async function procesarWebhook(req, res) {
  try {
    const body  = req.body;
    const event = body.event || '';

    console.log(`\n🔔 WEBHOOK [${event || 'sin-evento'}] — ${JSON.stringify(body).substring(0, 150)}`);

    if (event !== 'messages.upsert') return res.sendStatus(200);

    const mensajes = body.data?.messages || [];
    for (const mensaje of mensajes) {
      if (mensaje.key?.fromMe) continue;

      const remoteJid = mensaje.key?.remoteJid || '';
      if (!remoteJid.endsWith('@s.whatsapp.net')) continue;

      const telefono  = remoteJid.replace('@s.whatsapp.net', '');
      const prospecto = buscarProspecto(telefono);

      if (prospecto) {
        console.log(`📱 Mensaje de: ${prospecto.nombre_completo} (${telefono})`);
        await procesarMensaje(mensaje, prospecto);
      } else {
        console.log(`⚠️  Número no en campaña: ${telefono} | Activos: [${[...prospectosPorTelefono.keys()].join(', ')}]`);
      }
    }

    res.sendStatus(200);
  } catch (error) {
    console.error('❌ Error en webhook:', error);
    res.sendStatus(500);
  }
}

app.post('/webhook', procesarWebhook);

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

    // 2. Obtener prospectos (modo test = solo tu número, sin tocar la BD)
    let prospectos;

    if (process.env.TEST_MODE === 'true') {
      console.log('🧪 MODO TEST — usando contacto de prueba');
      prospectos = [{
        id_cit:          9999,
        nombre_completo: process.env.TEST_NOMBRE || 'Test',
        telefono:        process.env.TEST_TEL,
        fecha_cita:      new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // hace 5 días
        modalidad:       'Preparatoria',
        observaciones:   'Contacto de prueba',
        asesor:          'Equipo Victoria'
      }];
    } else {
      prospectos = await getPendientes(process.env.MAX_PROSPECTOS_POR_JORNADA || 30);
    }
    
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
        const mensajeInicial = await generarMensajeInicial(prospecto);

        // Enviar mensaje
        await enviarMensaje(telefono, mensajeInicial);

        // Registrar prospecto en el mapa y en el poller
        prospectosPorTelefono.set(telefono, prospecto);
        registrarProspecto(telefono);

        // Persistir chat_id en BD (solo si no es modo test)
        if (process.env.TEST_MODE !== 'true') {
          await guardarChatId(prospecto.id_cit, `${telefono}@s.whatsapp.net`);
        }

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

    // Iniciar polling (reemplaza webhook que no funciona en local)
    iniciarPolling(buscarProspecto, procesarMensaje);

    if (process.env.TEST_MODE === 'true') {
      console.log('🧪 MODO TEST activo — BD real no se toca\n');
    }

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