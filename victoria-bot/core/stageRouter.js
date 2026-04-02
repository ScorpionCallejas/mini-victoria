// core/stageRouter.js
// Orquesta el flujo de cada mensaje: scoring → transición de etapa → respuesta del LLM.

import { calcularScoring, actualizarScoring, obtenerTemperatura } from '../utils/scoring.js';
import { registrarObjeciones, extraerTexto }                      from '../utils/conversacion.js';
import { getStage, evaluarTransicion, aplicarTransicion }         from './stageEngine.js';
import { generarRespuesta, obtenerTemperaturaLLM }                 from '../modules/ai.js';
import { TRANSFERENCIA }                                           from '../config/constants.js';

// Procesa un mensaje entrante dentro del contexto de una conversación activa.
// Retorna: { accion: 'TRANSFERIR' } | { accion: 'RESPONDER', respuesta: string }
export async function routear(textoUsuario, conv) {
  // ── 1. Scoring ────────────────────────────────────────────────────────────
  const tiempoRespuesta = Date.now() - conv.ultimaRespuesta;
  const nuevosPuntos    = calcularScoring(textoUsuario, tiempoRespuesta);
  conv.scoring          = actualizarScoring(conv.scoring, nuevosPuntos);
  conv.temperatura      = obtenerTemperatura(conv.scoring);

  console.log(`📊 Scoring: ${conv.scoring} | Temp: ${conv.temperatura} | Etapa: ${conv.etapa} | Δ${nuevosPuntos > 0 ? '+' : ''}${nuevosPuntos}`);

  // ── 2. Registrar objeciones del mensaje actual ────────────────────────────
  registrarObjeciones(textoUsuario, conv.objecionesRegistradas, conv.historial);

  // ── 3. Agregar mensaje al historial ───────────────────────────────────────
  conv.historial.push({ role: 'user', content: textoUsuario, timestamp: new Date() });

  // ── 4. Evaluar transición de etapa ────────────────────────────────────────
  const nuevaEtapa = evaluarTransicion(conv, textoUsuario);

  if (nuevaEtapa === 'TRANSFERENCIA') {
    return { accion: 'TRANSFERIR' };
  }

  if (nuevaEtapa) {
    aplicarTransicion(conv, nuevaEtapa);
  } else {
    conv.mensajesEnEtapa++;

    // Si lleva demasiados mensajes en la misma etapa sin avanzar, loguear alerta
    if (conv.mensajesEnEtapa >= TRANSFERENCIA.MAX_MENSAJES_EN_ETAPA) {
      console.log(`⏳ ${conv.mensajesEnEtapa} mensajes en etapa ${conv.etapa} sin transición`);
    }
  }

  // ── 5. Generar respuesta del LLM ──────────────────────────────────────────
  const stage        = getStage(conv.etapa);
  const systemPrompt = stage.getSystemPrompt(conv.prospecto, conv);
  const tempLLM      = obtenerTemperaturaLLM(conv.scoring);
  const respuesta    = await generarRespuesta(systemPrompt, conv.historial, tempLLM);

  return { accion: 'RESPONDER', respuesta };
}
