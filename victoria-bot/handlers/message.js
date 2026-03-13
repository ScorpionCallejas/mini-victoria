// handlers/message.js
import { generarRespuesta, generarSystemPrompt, obtenerTemperaturaLLM } from '../modules/ai.js';
import { guardarConversacion } from '../modules/database.js';
import { enviarMensaje } from '../modules/evolution.js';
import { calcularScoring, actualizarScoring, obtenerTemperatura, debeTransferir } from '../utils/scoring.js';
import { generarMensajeTransferencia } from '../workflows/reactivacion.js';

const conversacionesActivas = new Map();

export async function procesarMensaje(mensaje, prospecto) {
  try {
    const telefono = mensaje.key.remoteJid.replace('@s.whatsapp.net', '');
    const textoUsuario = mensaje.message?.conversation || 
                         mensaje.message?.extendedTextMessage?.text || '';

    if (!textoUsuario) return;

    console.log(`\n📨 Mensaje de ${prospecto.nombre_completo}: ${textoUsuario}`);

    // Obtener o crear conversación
    let conv = conversacionesActivas.get(prospecto.id_cit) || {
      id_cit: prospecto.id_cit,
      prospecto: prospecto,
      historial: [],
      scoring: 30,
      temperatura: 'FRIO',
      ultimaRespuesta: Date.now()
    };

    // Calcular tiempo de respuesta
    const tiempoRespuesta = Date.now() - conv.ultimaRespuesta;

    // Calcular scoring
    const nuevosPuntos = calcularScoring(textoUsuario, tiempoRespuesta);
    conv.scoring = actualizarScoring(conv.scoring, nuevosPuntos);
    conv.temperatura = obtenerTemperatura(conv.scoring);

    console.log(`📊 Scoring: ${conv.scoring} | Temperatura: ${conv.temperatura} | Puntos: ${nuevosPuntos > 0 ? '+' : ''}${nuevosPuntos}`);

    // Agregar mensaje del usuario al historial
    conv.historial.push({
      role: 'user',
      content: textoUsuario,
      timestamp: new Date()
    });

    // Verificar si debe transferir
    if (debeTransferir(conv.scoring, conv.historial)) {
      const mensajeTransferencia = generarMensajeTransferencia(prospecto, conv.scoring);
      await enviarMensaje(telefono, mensajeTransferencia);
      
      conv.historial.push({
        role: 'assistant',
        content: mensajeTransferencia,
        timestamp: new Date()
      });

      await guardarConversacion(
        conv.id_cit, 
        conv.historial, 
        conv.scoring, 
        'TRANSFERIDA'
      );

      console.log(`🔄 Lead TRANSFERIDO - Scoring: ${conv.scoring}`);
      conversacionesActivas.delete(prospecto.id_cit);
      return;
    }

    // Generar respuesta con IA
    const systemPrompt = generarSystemPrompt(prospecto, conv);
    const temperaturaLLM = obtenerTemperaturaLLM(conv.scoring);
    
    const respuesta = await generarRespuesta(
      systemPrompt, 
      conv.historial, 
      temperaturaLLM
    );

    // Enviar respuesta
    await enviarMensaje(telefono, respuesta);

    // Agregar respuesta al historial
    conv.historial.push({
      role: 'assistant',
      content: respuesta,
      timestamp: new Date()
    });

    conv.ultimaRespuesta = Date.now();
    conversacionesActivas.set(prospecto.id_cit, conv);

    // Guardar en BD
    await guardarConversacion(
      conv.id_cit,
      conv.historial,
      conv.scoring,
      conv.temperatura
    );

    console.log(`✅ Respuesta enviada: ${respuesta.substring(0, 50)}...`);

  } catch (error) {
    console.error('❌ Error procesando mensaje:', error);
  }
}

export function obtenerConversacion(id_cit) {
  return conversacionesActivas.get(id_cit);
}