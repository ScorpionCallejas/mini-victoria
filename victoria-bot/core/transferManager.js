// core/transferManager.js
// Evalúa si un lead está listo para ser transferido al consultor.
// Si lo está, envía el brief al número del consultor vía WhatsApp.

import { TRANSFERENCIA } from '../config/constants.js';
import {
  clasificarIntencion,
  tieneRechazoReciente,
  longitudPromedioMensajes,
  todasObjecionesResueltas,
  victoriaOfrecioConectar,
  esRespuestaAfirmativa
} from '../utils/conversacion.js';
import { formatearBrief } from '../templates/briefConsultor.js';
import { enviarMensaje }  from '../modules/evolution.js';

// ─── Evaluación de condiciones ────────────────────────────────────────────────
// Retorna true solo si TODAS las condiciones se cumplen.
// Esto evita transferir leads que solo hicieron una pregunta de precio y ya.

export function evaluarTransferencia(historial, conv, mensajeActual) {
  const mensajesUsuario = historial.filter(m => m.role === 'user');

  // 1. Mínimo de mensajes del lead
  if (mensajesUsuario.length < TRANSFERENCIA.MIN_MENSAJES_USUARIO) {
    return false;
  }

  // 2. Mensajes con contenido real (no solo "ok", "sí", "ajá")
  if (longitudPromedioMensajes(historial) < TRANSFERENCIA.MIN_LONGITUD_PROMEDIO) {
    return false;
  }

  // 3. Tiempo mínimo de conversación
  const tiempoConv = Date.now() - conv.tiempoInicioConv;
  if (tiempoConv < TRANSFERENCIA.MIN_TIEMPO_CONV_MS) {
    return false;
  }

  // 4. Scoring mínimo (al menos TIBIO)
  if (conv.scoring < TRANSFERENCIA.MIN_SCORING) {
    return false;
  }

  // 5. Sin rechazo ni objeción en los últimos 2 mensajes del lead
  if (tieneRechazoReciente(historial, 2)) {
    return false;
  }

  // 6. Todas las objeciones registradas están resueltas
  if (!todasObjecionesResueltas(historial, conv.objecionesRegistradas)) {
    return false;
  }

  // 7. Señal de intención — dos caminos válidos:
  //    a) Patrón explícito ("cómo me inscribo", "quiero entrar", etc.)
  //    b) Victoria ofreció conectar en su último mensaje Y el lead aceptó
  const esIntencionExplicita = clasificarIntencion(mensajeActual) === 'INTENCION';
  const esAceptacionDeOferta = victoriaOfrecioConectar(historial) && esRespuestaAfirmativa(mensajeActual);

  if (!esIntencionExplicita && !esAceptacionDeOferta) {
    return false;
  }

  return true;
}

// ─── Ejecución de la transferencia ───────────────────────────────────────────
// Envía el brief al consultor vía WhatsApp

export async function ejecutarTransferencia(prospecto, conv) {
  const brief           = formatearBrief(prospecto, conv);
  const numeroConsultor = TRANSFERENCIA.NUMERO_CONSULTOR.replace(/\D/g, '');

  try {
    await enviarMensaje(numeroConsultor, brief);
    console.log(`📋 Brief enviado al consultor (${TRANSFERENCIA.NUMERO_CONSULTOR})`);
  } catch (error) {
    console.error('❌ Error enviando brief al consultor:', error.message);
    // No lanzamos el error — la transferencia al lead ya ocurrió, el brief es secundario
  }
}
