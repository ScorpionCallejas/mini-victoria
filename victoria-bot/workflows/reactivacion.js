// workflows/reactivacion.js
import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';

dotenv.config();

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);

// Mensaje que se le envía al lead cuando se transfiere al consultor
// También generado por IA para que no suene a template
export async function generarMensajeTransferencia(prospecto, scoring) {
  const nombre  = prospecto.nombre_completo?.split(' ')[0] || '';
  const asesor  = prospecto.asesor || 'uno de nuestros asesores';

  const prompt = `Eres Victoria, asesora educativa mexicana.

Escribe el mensaje final para ${nombre} antes de pasarlo con ${asesor}.
El lead tiene scoring ${scoring}/100 — ya mostró interés real.

El mensaje debe:
- Sonar natural, como si tú lo estuvieras pasando con un colega de confianza
- Mencionar que ${asesor} lo va a contactar para resolver sus dudas y darle su plan
- Crear anticipación positiva, no presión
- Máximo 3 líneas, 1 emoji máximo

Escribe SOLO el mensaje. Sin comillas. Sin explicaciones.`;

  try {
    const model  = genAI.getGenerativeModel({ model: process.env.GEMINI_MODEL || 'gemini-2.0-flash', generationConfig: { temperature: 0.85, maxOutputTokens: 120 } });
    const result = await model.generateContent(prompt);
    return result.response.text().trim();
  } catch (error) {
    const nombre = prospecto.nombre_completo?.split(' ')[0] || '';
    return `Perfecto ${nombre} 😊 Le voy a avisar a ${asesor} para que te contacte y te arme un plan a tu medida. ¡Cuídate!`;
  }
}
