// utils/scoring.js
import { SCORING, PATRONES, TEMPERATURA } from '../config/constants.js';

export function calcularScoring(mensaje, tiempoRespuesta) {
  let puntos = 0;
  const msgLower = mensaje.toLowerCase();

  // Tiempo de respuesta
  if (tiempoRespuesta < 300000) { // < 5 min
    puntos += SCORING.RESPONDE_RAPIDO;
  } else if (tiempoRespuesta > 900000) { // > 15 min
    puntos += SCORING.RESPONDE_TARDE;
  }

  // Longitud del mensaje
  if (mensaje.length > 30) {
    puntos += SCORING.MENSAJE_LARGO;
  } else if (mensaje.length < 10) {
    puntos += SCORING.MENSAJE_CORTO;
  }

  // Patrones de interés
  if (PATRONES.INTERES.test(msgLower)) {
    puntos += SCORING.MUESTRA_INTERES;
  }

  if (PATRONES.PRECIO.test(msgLower)) {
    puntos += SCORING.PREGUNTA_PRECIO;
  }

  if (PATRONES.TIMING.test(msgLower)) {
    puntos += SCORING.PREGUNTA_DETALLES;
  }

  if (PATRONES.URGENCIA.test(msgLower)) {
    puntos += SCORING.MENCIONA_URGENCIA;
  }

  if (PATRONES.CONTACTO.test(msgLower)) {
    puntos += SCORING.PIDE_CONTACTO;
  }

  // Patrones negativos
  if (PATRONES.RECHAZO.test(msgLower)) {
    puntos += SCORING.DICE_DESPUES;
  }

  if (PATRONES.DESPUES.test(msgLower)) {
    puntos += SCORING.DICE_DESPUES;
  }

  if (PATRONES.DINERO.test(msgLower)) {
    puntos += SCORING.MENCIONA_DINERO;
  }

  if (PATRONES.TIEMPO.test(msgLower)) {
    puntos += SCORING.MENCIONA_TIEMPO;
  }

  if (PATRONES.GROSERIA.test(msgLower)) {
    puntos += SCORING.GROSERIA;
  }

  return puntos;
}

export function actualizarScoring(scoringActual, nuevosPuntos) {
  const nuevoScoring = scoringActual + nuevosPuntos;
  return Math.max(0, Math.min(100, nuevoScoring)); // Entre 0 y 100
}

export function obtenerTemperatura(scoring) {
  if (scoring >= TEMPERATURA.CALIENTE.min) {
    return TEMPERATURA.CALIENTE.nombre;
  } else if (scoring >= TEMPERATURA.TIBIO.min) {
    return TEMPERATURA.TIBIO.nombre;
  } else {
    return TEMPERATURA.FRIO.nombre;
  }
}

export function debeTransferir(scoring, historial) {
  // Transferir si:
  // 1. Scoring es CALIENTE (>56)
  // 2. O si hace 3+ preguntas específicas
  if (scoring >= TEMPERATURA.CALIENTE.min) {
    return true;
  }

  const ultimosMensajes = historial.slice(-6);
  const preguntasUsuario = ultimosMensajes.filter(m => 
    m.role === 'user' && m.content.includes('?')
  );

  return preguntasUsuario.length >= 3;
}