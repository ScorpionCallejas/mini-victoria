// utils/conversacion.js
// Utilidades compartidas de análisis conversacional — usadas por stages, engine y transferManager

import { PATRONES, PATRONES_INTENCION } from '../config/constants.js';

export const PALABRAS_OBJECION = [
  'caro', 'costoso', 'dinero', 'no tengo', 'desconfianza', 'no confío',
  'no te conozco', 'no me fío', 'bot', 'robot', 'programada', 'sistema',
  'lo pienso', 'después', 'luego veo', 'no sé', 'no puedo', 'no me interesa',
  'quién eres', 'de dónde', 'no me convence', 'muy caro', 'no tengo tiempo',
  'ocupado', 'ahorita no', 'no sirve', 'no vale', 'ya estoy grande',
  'no voy a terminar', 'empiezo y no termino', 'trucho', 'fake', 'no es válido',
  'desaparecen', 'fraude', 'en enero', 'después del', 'next month'
];

// ─── Texto del mensaje ────────────────────────────────────────────────────────

export function extraerTexto(mensaje) {
  return mensaje.message?.conversation ||
         mensaje.message?.extendedTextMessage?.text ||
         mensaje.message?.imageMessage?.caption || '';
}

// ─── Días desde la última cita ───────────────────────────────────────────────

export function calcularDiasDesdeUltimaCita(fechaCita) {
  if (!fechaCita) return 0;
  const hoy  = new Date();
  const cita = new Date(fechaCita);
  return Math.ceil(Math.abs(hoy - cita) / (1000 * 60 * 60 * 24));
}

// ─── Detección de objeción activa ────────────────────────────────────────────

export function tieneObjecionActiva(historial) {
  const ultimo = historial
    .filter(m => m.role === 'user')
    .slice(-1)[0]?.content?.toLowerCase() || '';
  return PALABRAS_OBJECION.some(p => ultimo.includes(p));
}

// ─── Registro y resolución de objeciones ─────────────────────────────────────

export function registrarObjeciones(mensajeActual, objecionesRegistradas, historial) {
  const msgLower = mensajeActual.toLowerCase();
  const indexActual = historial.filter(m => m.role === 'user').length;

  for (const keyword of PALABRAS_OBJECION) {
    if (msgLower.includes(keyword)) {
      const yaActiva = objecionesRegistradas.some(o => o.keyword === keyword && !o.resuelta);
      if (!yaActiva) {
        objecionesRegistradas.push({ keyword, mensajeIndex: indexActual, resuelta: false });
      }
    }
  }
}

export function todasObjecionesResueltas(historial, objecionesRegistradas) {
  if (objecionesRegistradas.length === 0) return true;

  const mensajesUsuario = historial.filter(m => m.role === 'user');
  const indexActual     = mensajesUsuario.length - 1;

  for (const obj of objecionesRegistradas) {
    if (obj.resuelta) continue;

    // 1. Debe haber pasado más de 2 mensajes desde la objeción
    if (indexActual - obj.mensajeIndex < 2) return false;

    // 2. La keyword no reapareció en mensajes posteriores
    const posteriores = mensajesUsuario.slice(obj.mensajeIndex);
    const reaparecio  = posteriores.some(m => m.content.toLowerCase().includes(obj.keyword));
    if (reaparecio) return false;

    // 3. El lead mandó al menos 1 mensaje positivo/neutro después
    const hayPositivo = posteriores.some(m =>
      !PALABRAS_OBJECION.some(p => m.content.toLowerCase().includes(p)) &&
      m.content.length > 10
    );
    if (!hayPositivo) return false;

    obj.resuelta = true;
  }

  return objecionesRegistradas.every(o => o.resuelta);
}

// ─── Clasificación de intención ───────────────────────────────────────────────

export function clasificarIntencion(texto) {
  const lower = texto.toLowerCase();
  if (PATRONES_INTENCION.INTENCION.test(lower))   return 'INTENCION';
  if (PATRONES_INTENCION.EXPLORACION.test(lower))  return 'EXPLORACION';
  if (PATRONES_INTENCION.CURIOSIDAD.test(lower))   return 'CURIOSIDAD';
  return null;
}

// ─── Anti-contradicción ───────────────────────────────────────────────────────

export function tieneRechazoReciente(historial, n = 2) {
  const ultimos = historial.filter(m => m.role === 'user').slice(-n);
  return ultimos.some(m => {
    const txt = m.content.toLowerCase();
    return PATRONES.RECHAZO.test(txt) ||
           PATRONES.DESPUES.test(txt) ||
           PALABRAS_OBJECION.some(p => txt.includes(p));
  });
}

// ─── Métricas de engagement ───────────────────────────────────────────────────

export function longitudPromedioMensajes(historial) {
  const msgs = historial.filter(m => m.role === 'user');
  if (msgs.length === 0) return 0;
  return msgs.reduce((acc, m) => acc + m.content.length, 0) / msgs.length;
}

// ─── Detección de oferta de conexión por parte de Victoria ───────────────────
// Cuando Victoria le dice al lead "te conecto con alguien", el siguiente
// mensaje afirmativo del lead cuenta como señal de intención.

export function victoriaOfrecioConectar(historial) {
  const ultimoAssistant = historial
    .filter(m => m.role === 'assistant')
    .slice(-1)[0]?.content?.toLowerCase() || '';
  return /te (puedo )?conect|te (lo )?conecto|alguien del equipo|te (lo )?paso con|te (puedo )?poner en contacto/i
    .test(ultimoAssistant);
}

export function esRespuestaAfirmativa(texto) {
  const lower = texto.toLowerCase().trim();
  // Cubre: "sí", "claro", "dale", "órale", "perfecto", "sale", "claro mejor", "sí mejor", etc.
  return /^(s[ií]|claro|dale|[oó]rale|perfecto|bueno|est[aá] bien|sale|va|de acuerdo|mejor|ok|okay|adelante|por favor|porfavor|listo|con gusto|ándale|andale)/.test(lower);
}

// ─── Insights clave del lead (para el brief al consultor) ────────────────────

export function extraerInsights(historial) {
  return historial
    .filter(m => m.role === 'user' && m.content.length > 25)
    .slice(-5)
    .map(m => m.content.trim());
}
