// config/constants.js

export const PRODUCTOS = {
  PREPARATORIA: {
    nombre: 'Preparatoria Emprende',
    duracion: '6 meses',
    inscripcion: 800,
    colegiatura: 1600,
    apartado_minimo: 400
  },
  EXAMEN_UNICO: {
    nombre: 'Examen Único de Preparatoria',
    duracion: '1 mes',
    inscripcion: 800,
    colegiatura: 3999,
    apartado_minimo: 1000
  }
};

export const SCORING = {
  // Señales POSITIVAS — requieren intención clara
  RESPONDE_RAPIDO:   8,
  MENSAJE_LARGO:     5,
  MUESTRA_INTERES:  15,
  PREGUNTA_DETALLES: 15,  // "¿cuándo empiezan?"
  PREGUNTA_PRECIO:   8,   // solo cuando NO hay objeción de precio en el mismo mensaje
  MENCIONA_URGENCIA: 20,
  PIDE_CONTACTO:     25,

  // Señales NEGATIVAS
  RESPONDE_TARDE:   -3,
  MENSAJE_CORTO:    -2,
  DICE_DESPUES:    -10,
  MENCIONA_DINERO: -15,  // objeta precio
  MENCIONA_TIEMPO: -10,
  GROSERIA:        -50
};

export const TEMPERATURA = {
  FRIO: { 
    min: 0, 
    max: 25, 
    gemini_temp: 0.7, 
    nombre: 'FRIO' 
  },
  TIBIO: {
    min: 26,
    max: 74,
    gemini_temp: 0.5,
    nombre: 'TIBIO'
  },
  CALIENTE: {
    min: 75,
    max: 100,
    gemini_temp: 0.3,
    nombre: 'CALIENTE'
  }
};

export const TIMING = {
  DELAY_ENTRE_CONTACTOS: 15000,
  TIEMPO_ESPERA_RESPUESTA: 300000,
  MAX_SEGUIMIENTOS: 3
};

export const PATRONES = {
  INTERES: /\b(sí|si|claro|sale|okay|ok|interesa|me late|quiero|necesito)\b/i,
  PRECIO: /\b(cuánto|cuesta|precio|inversión|facilidades|mensualidad|plazo)\b/i,
  TIMING: /\b(cuándo|cuando|inicio|empiezo|arranco|fecha|horario)\b/i,
  URGENCIA: /\b(rápido|rapido|pronto|urgente|ahorita|necesito ya)\b/i,
  CONTACTO: /\b(llámame|llamame|contáctame|contactame|teléfono|quiero hablar|háblame)\b/i,
  RECHAZO: /\b(no me interesa|no gracias|no quiero|ya no|olvídalo)\b/i,
  DESPUES: /\b(luego|después|otro día|otro momento|más tarde|ahorita no)\b/i,
  DINERO: /\b(caro|costoso|no tengo|no puedo pagar|muy caro|se me hace caro|no alcanza|sin dinero|no cuento)\b/i,
  TIEMPO: /\b(no tengo tiempo|ocupado|ocupada|muy ocupado)\b/i,
  GROSERIA: /\b(puto|puta|verga|chingar|mierda|pendejo|idiota)\b/i
};

export const ESTADOS = {
  ACTIVA: 'ACTIVA',
  PAUSADA: 'PAUSADA',
  CERRADA: 'CERRADA',
  TRANSFERIDA: 'TRANSFERIDA',
  SIN_RESPUESTA: 'SIN_RESPUESTA'
};

export const ETAPAS = {
  SALUDO:     'SALUDO',
  SONDEO:     'SONDEO',
  OBJECIONES: 'OBJECIONES',
  INTERES:    'INTERES'
};

// Tres niveles de señal de intención — solo INTENCION dispara evaluación de transferencia
export const PATRONES_INTENCION = {
  CURIOSIDAD:  /\b(cuánto cuesta|cuesta|cuánto dura|dura|de qué es|cómo funciona|qué es eso|qué es la prepa)\b/i,
  EXPLORACION: /\b(en qué horarios|cómo son las clases|qué se estudia|es presencial|en línea|quién da las clases|qué materias)\b/i,
  INTENCION:   /\b(cómo le hago|cómo me inscribo|cómo entro|cómo aparto|cuánto es en total|cuánto cuesta todo|cuándo empiezo|cuándo arranca|cuándo inicio|cuándo empezamos|quiero entrar|me apunto|me interesa inscribirme|quiero apartar|quiero inscribirme|dónde pago|cómo pago|qué necesito para inscribirme|ya me convenciste|quiero empezar|cómo le hago para entrar|cómo inicio)\b/i
};

// Umbrales para la transferencia al consultor (TODOS deben cumplirse)
export const TRANSFERENCIA = {
  NUMERO_CONSULTOR:     '+5215530852322',
  MIN_MENSAJES_USUARIO: 5,
  MIN_LONGITUD_PROMEDIO: 15,   // chars promedio por mensaje del lead
  MIN_TIEMPO_CONV_MS:   10 * 60 * 1000,  // 10 minutos
  MIN_SCORING:          26,    // mínimo TIBIO
  MAX_MENSAJES_EN_ETAPA: 4     // si pasan 4 mensajes en la misma etapa sin avanzar → cambiar estrategia
};