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

  // Interés positivo SOLO si no hay rechazo en el mismo mensaje
  // (evita que "no me interesa" cuente como señal positiva)
  if (PATRONES.INTERES.test(msgLower) && !PATRONES.RECHAZO.test(msgLower)) {
    puntos += SCORING.MUESTRA_INTERES;
  }

  // Precio positivo SOLO si no hay queja de dinero en el mismo mensaje
  if (PATRONES.PRECIO.test(msgLower) && !PATRONES.DINERO.test(msgLower)) {
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
  const mensajesUsuario = historial.filter(m => m.role === 'user');

  // Mínimo 5 intercambios reales antes de transferir
  if (mensajesUsuario.length < 5) return false;

  // Transferir si scoring muy alto Y el último mensaje no es una objeción
  if (scoring >= TEMPERATURA.CALIENTE.min) {
    const ultimoUsuario = mensajesUsuario[mensajesUsuario.length - 1]?.content?.toLowerCase() || '';
    const esObjecion = PATRONES.DINERO.test(ultimoUsuario) ||
                       PATRONES.RECHAZO.test(ultimoUsuario) ||
                       PATRONES.TIEMPO.test(ultimoUsuario);
    if (esObjecion) return false; // maneja la objeción antes de transferir
    return true;
  }

  // O si pide contacto explícitamente
  const ultimoUsuario = mensajesUsuario[mensajesUsuario.length - 1]?.content?.toLowerCase() || '';
  return PATRONES.CONTACTO.test(ultimoUsuario);
}