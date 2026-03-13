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
  // Señales POSITIVAS
  RESPONDE_RAPIDO: 10,
  MENSAJE_LARGO: 8,
  MUESTRA_INTERES: 15,
  PREGUNTA_DETALLES: 20,
  PREGUNTA_PRECIO: 18,
  MENCIONA_URGENCIA: 22,
  PIDE_CONTACTO: 30,
  
  // Señales NEGATIVAS (suaves para reactivación)
  RESPONDE_TARDE: -3,
  MENSAJE_CORTO: -2,
  DICE_DESPUES: -8,
  MENCIONA_DINERO: -10,
  MENCIONA_TIEMPO: -8,
  GROSERIA: -50
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
    max: 55, 
    gemini_temp: 0.5, 
    nombre: 'TIBIO' 
  },
  CALIENTE: { 
    min: 56, 
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
  PRECIO: /\b(cuánto|cuesta|precio|costo|pagar|inversión)\b/i,
  TIMING: /\b(cuándo|cuando|inicio|empiezo|arranco|fecha)\b/i,
  URGENCIA: /\b(rápido|rapido|pronto|ya|urgente|ahorita)\b/i,
  RECHAZO: /\b(no|nop|nope|nel|nanai|no me interesa|no gracias)\b/i,
  DESPUES: /\b(luego|después|otro día|otro momento|más tarde)\b/i,
  DINERO: /\b(no tengo dinero|está caro|muy caro|no puedo pagar)\b/i,
  TIEMPO: /\b(no tengo tiempo|ocupado|ocupada)\b/i,
  GROSERIA: /\b(puto|puta|verga|chingar|mierda|pendejo|idiota)\b/i
};

export const ESTADOS = {
  ACTIVA: 'ACTIVA',
  PAUSADA: 'PAUSADA',
  CERRADA: 'CERRADA',
  TRANSFERIDA: 'TRANSFERIDA',
  SIN_RESPUESTA: 'SIN_RESPUESTA'
};