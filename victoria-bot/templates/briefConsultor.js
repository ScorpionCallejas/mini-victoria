// templates/briefConsultor.js
// Formatea el mensaje que recibe el consultor cuando Victoria transfiere un lead.

import { extraerInsights } from '../utils/conversacion.js';

export function formatearBrief(prospecto, conv) {
  const nombre   = prospecto.nombre_completo || 'Sin nombre';
  const telefono = prospecto.telefono || 'Sin teléfono';
  const insights = extraerInsights(conv.historial);

  const ultimoMensaje = conv.historial
    .filter(m => m.role === 'user')
    .slice(-1)[0]?.content || '';

  const objecionesMencionadas = conv.objecionesRegistradas
    .map(o => o.keyword)
    .filter((v, i, a) => a.indexOf(v) === i) // unique
    .join(', ') || 'Ninguna registrada';

  const resumenInsights = insights.length > 0
    ? insights.slice(0, 3).map(i => `• ${i}`).join('\n')
    : '• Sin notas adicionales';

  return `
🔔 *Lead listo para atender*

👤 *Nombre:* ${nombre}
📱 *Teléfono:* +${telefono.replace(/\D/g, '')}
🌡️ *Temperatura:* ${conv.temperatura} (${conv.scoring}/100)
📍 *Etapa al transferir:* ${conv.etapa}

📋 *Lo que dijo el lead:*
${resumenInsights}

⚠️ *Temas mencionados:* ${objecionesMencionadas}

💬 *Último mensaje del lead:*
"${ultimoMensaje}"

_Victoria ya construyó el rapport — el lead espera ser contactado._
`.trim();
}
