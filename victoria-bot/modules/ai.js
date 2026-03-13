// modules/ai.js
import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
import { TEMPERATURA } from '../config/constants.js';

dotenv.config();

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);

export async function generarRespuesta(systemPrompt, historial, temperatura = 0.5) {
  try {
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-pro',
      generationConfig: {
        temperature: temperatura,
        maxOutputTokens: 500,
      }
    });

    // Convertir historial al formato de Gemini
    const chat = model.startChat({
      history: historial.slice(0, -1).map(msg => ({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }]
      })),
      generationConfig: {
        temperature: temperatura,
        maxOutputTokens: 500,
      },
    });

    // Mensaje completo con system prompt
    const ultimoMensaje = historial[historial.length - 1].content;
    const mensajeCompleto = `${systemPrompt}\n\nÚltimo mensaje del usuario: ${ultimoMensaje}`;

    const result = await chat.sendMessage(mensajeCompleto);
    const response = await result.response;
    const texto = response.text();

    return texto;

  } catch (error) {
    console.error('❌ Error en Gemini:', error.message);
    return 'Disculpa, tuve un problema técnico. ¿Podrías repetir tu mensaje?';
  }
}

export function generarSystemPrompt(prospecto, conv) {
  const dias = calcularDiasDesdeUltimaCita(prospecto.fecha_cita);
  
  return `Eres Victoria, asesora educativa de AHJ ENDE.

CONTEXTO DEL PROSPECTO:
- Nombre: ${prospecto.nombre_completo || 'Sin nombre'}
- Tuvo cita hace ${dias} días que NO fue atendida
- Asesor original: ${prospecto.asesor || 'equipo'}
- Producto: ${prospecto.modalidad || 'Preparatoria'}
- Notas: ${prospecto.observaciones || 'Sin información'}

TU ROL: Consultora EMPÁTICA, no vendedora agresiva.

OBJETIVO: RECONECTAR y CALIFICAR (no cerrar venta inmediata)

REGLAS DE ORO:
1. Empatía primero - No juzgues por qué no vino a la cita
2. Escucha más, habla menos
3. Sin presión - Si no es su momento, está bien
4. Tono mexicano cercano: "¿te late?", "sale", "está bien"
5. Mensajes CORTOS (máximo 2-3 líneas)
6. Máximo 1 emoji por mensaje

WORKFLOW:
1. Reconectar sin culpar
2. Entender situación actual
3. Ofrecer valor sin vender
4. Calificar suavemente
5. Cierre consultivo (NO agresivo)

NUNCA:
❌ Usar frases como "no todos califican"
❌ Presionar con "escenarios de pérdida"
❌ Mensajes largos de más de 4 líneas
❌ Forzar cierre inmediato

SCORING ACTUAL: ${conv.scoring || 30}
TEMPERATURA: ${conv.temperatura || 'FRIO'}

Responde de forma natural, conversacional y empática:`;
}

function calcularDiasDesdeUltimaCita(fechaCita) {
  if (!fechaCita) return 0;
  const hoy = new Date();
  const cita = new Date(fechaCita);
  const diffTime = Math.abs(hoy - cita);
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

export function obtenerTemperaturaLLM(scoring) {
  if (scoring >= TEMPERATURA.CALIENTE.min) {
    return TEMPERATURA.CALIENTE.gemini_temp;
  } else if (scoring >= TEMPERATURA.TIBIO.min) {
    return TEMPERATURA.TIBIO.gemini_temp;
  } else {
    return TEMPERATURA.FRIO.gemini_temp;
  }
}