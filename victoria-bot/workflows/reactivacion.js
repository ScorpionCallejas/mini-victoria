// workflows/reactivacion.js

export function generarMensajeInicial(prospecto) {
  const dias = calcularDiasDesdeUltimaCita(prospecto.fecha_cita);
  const nombre = prospecto.nombre_completo?.split(' ')[0] || 'Hola';
  const asesor = prospecto.asesor || 'nuestro equipo';
  
  if (dias <= 3) {
    return `Hola ${nombre} 👋\n\nSoy Victoria del equipo de ${asesor}. Vi que tenías agendada una cita hace unos días que no se pudo concretar.\n\n¿Todo bien por allá? ¿Te gustaría reagendar?`;
  } else if (dias <= 15) {
    return `¡Hola ${nombre}! 😊\n\nHace unos días intentamos contactarte para platicar sobre la prepa. Sé que a veces el tiempo se nos va...\n\n¿Sigues interesado/a en conocer las opciones?`;
  } else {
    return `Hola ${nombre} 🎓\n\nHace un tiempo mostraste interés en terminar la prepa y agendaste una cita que no se pudo concretar.\n\n¿Aún estás buscando opciones? Ahora tenemos nuevas facilidades que quizá te interesen.`;
  }
}

export function generarMensajeTransferencia(prospecto, scoring) {
  const asesor = prospecto.asesor || 'uno de nuestros asesores';
  
  return `Perfecto 😊\n\nVeo que estás interesado/a. Para que ${asesor} te arme un plan específico para tu caso, ¿te late que te contacte hoy o mañana?\n\nAsí te resuelve todas tus dudas y si te convence, podrías arrancar pronto.`;
}

function calcularDiasDesdeUltimaCita(fechaCita) {
  if (!fechaCita) return 0;
  const hoy = new Date();
  const cita = new Date(fechaCita);
  const diffTime = Math.abs(hoy - cita);
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}