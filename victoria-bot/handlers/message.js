// handlers/message.js
// Punto de entrada de cada mensaje entrante.
// Delega el procesamiento al stageRouter y ejecuta la transferencia cuando corresponde.

import { guardarConversacion }                  from '../modules/api.js';
import { enviarMensaje }                        from '../modules/evolution.js';
import { parsearMensajes, delayHumano, delayEntrePartes } from '../modules/ai.js';
import { generarMensajeTransferencia }          from '../workflows/reactivacion.js';
import { inicializarConv }                      from '../core/stageEngine.js';
import { routear }                              from '../core/stageRouter.js';
import { ejecutarTransferencia }                from '../core/transferManager.js';
import { extraerTexto }                         from '../utils/conversacion.js';

const conversacionesActivas = new Map();

export async function procesarMensaje(mensaje, prospecto) {
  try {
    const telefono     = mensaje.key.remoteJid.replace('@s.whatsapp.net', '');
    const textoUsuario = extraerTexto(mensaje);

    if (!textoUsuario) return;

    console.log(`\n📨 ${prospecto.nombre_completo}: "${textoUsuario}"`);

    // Obtener o crear conversación
    let conv = conversacionesActivas.get(prospecto.id_cit)
            || inicializarConv(prospecto);

    // ── Procesar mensaje ──────────────────────────────────────────────────
    const resultado = await routear(textoUsuario, conv);

    // ── Transferencia al consultor ────────────────────────────────────────
    if (resultado.accion === 'TRANSFERIR') {
      // 1. Mensaje al lead
      const msgTransferencia = await generarMensajeTransferencia(prospecto, conv.scoring);
      await delayHumano(msgTransferencia.length);
      await enviarMensaje(telefono, msgTransferencia);

      conv.historial.push({ role: 'assistant', content: msgTransferencia, timestamp: new Date() });

      // 2. Brief al consultor
      await ejecutarTransferencia(prospecto, conv);

      // 3. Persistir y cerrar
      if (process.env.TEST_MODE !== 'true') {
        await guardarConversacion(conv.id_cit, conv.historial, conv.scoring, 'TRANSFERIDA');
      }

      const msgs = conv.historial.filter(m => m.role === 'user');
      console.log(`🔄 Lead TRANSFERIDO — Scoring: ${conv.scoring} | Mensajes: ${msgs.length} | Etapa: ${conv.etapa}`);
      conversacionesActivas.delete(prospecto.id_cit);
      return;
    }

    // ── Enviar respuesta normal ───────────────────────────────────────────
    const partes = parsearMensajes(resultado.respuesta);
    await delayHumano(partes[0].length);

    const textoCompleto = [];
    for (let i = 0; i < partes.length; i++) {
      if (i > 0) await delayEntrePartes(partes[i].length);
      await enviarMensaje(telefono, partes[i]);
      textoCompleto.push(partes[i]);
      console.log(`📤 [${i + 1}/${partes.length}] ${partes[i].substring(0, 60)}...`);
    }

    conv.historial.push({ role: 'assistant', content: textoCompleto.join('\n'), timestamp: new Date() });
    conv.ultimaRespuesta = Date.now();
    conversacionesActivas.set(prospecto.id_cit, conv);

    if (process.env.TEST_MODE !== 'true') {
      await guardarConversacion(conv.id_cit, conv.historial, conv.scoring, conv.temperatura);
    }

  } catch (error) {
    console.error('❌ Error procesando mensaje:', error);
  }
}

export function obtenerConversacion(id_cit) {
  return conversacionesActivas.get(id_cit);
}
