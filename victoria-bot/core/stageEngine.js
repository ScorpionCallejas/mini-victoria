// core/stageEngine.js
// Máquina de estados del ciclo de venta.
// Decide en qué etapa está la conversación y cuándo transicionar.

import saludo     from '../stages/saludo.js';
import sondeo     from '../stages/sondeo.js';
import objeciones from '../stages/objeciones.js';
import interes    from '../stages/interes.js';
import { tieneObjecionActiva } from '../utils/conversacion.js';
import { evaluarTransferencia } from './transferManager.js';

const STAGES = {
  SALUDO:     saludo,
  SONDEO:     sondeo,
  OBJECIONES: objeciones,
  INTERES:    interes
};

// Retorna el módulo de la etapa actual
export function getStage(nombre) {
  return STAGES[nombre] || STAGES.SALUDO;
}

// Inicializa el estado de conversación con los campos de etapa
export function inicializarConv(prospecto) {
  return {
    id_cit:                 prospecto.id_cit,
    prospecto,
    historial:              [],
    scoring:                30,
    temperatura:            'FRIO',
    etapa:                  'SALUDO',
    etapaAnterior:          null,
    mensajesEnEtapa:        0,
    objecionesRegistradas:  [],
    tiempoInicioConv:       Date.now(),
    ultimaRespuesta:        Date.now()
  };
}

// Evalúa si la conversación debe cambiar de etapa.
// Retorna: nombre de la siguiente etapa | 'TRANSFERENCIA' | null (sin cambio)
export function evaluarTransicion(conv, mensajeActual) {
  const { historial, etapa } = conv;

  // ── Regla de objeción activa ──────────────────────────────────────────────
  // Si el lead tiene una objeción en su último mensaje, priorizamos manejarla
  // (excepto si ya estamos en OBJECIONES)
  if (etapa !== 'OBJECIONES' && tieneObjecionActiva(historial)) {
    return 'OBJECIONES';
  }

  // ── En etapa INTERES: evaluar transferencia antes que cualquier otra cosa ─
  if (etapa === 'INTERES') {
    const listo = evaluarTransferencia(historial, conv, mensajeActual);
    if (listo) return 'TRANSFERENCIA';
  }

  // ── Transición propia de la etapa ─────────────────────────────────────────
  const stage = getStage(etapa);
  return stage.evaluarTransicion(historial, conv, mensajeActual);
}

// Aplica la transición en el objeto de conversación (muta el objeto)
export function aplicarTransicion(conv, nuevaEtapa) {
  if (!nuevaEtapa || nuevaEtapa === conv.etapa) return;

  console.log(`🔀 Etapa: ${conv.etapa} → ${nuevaEtapa}`);

  conv.etapaAnterior   = conv.etapa;
  conv.etapa           = nuevaEtapa;
  conv.mensajesEnEtapa = 0;
}
