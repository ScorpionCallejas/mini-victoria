// modules/ai.js
// Cliente LLM: Claude (Anthropic) → Gemini (Google) → fallback hardcodeado.
// No contiene lógica de etapas ni de negocio — solo generación de texto.

import dotenv from 'dotenv';
import { TEMPERATURA } from '../config/constants.js';
import { calcularDiasDesdeUltimaCita } from '../utils/conversacion.js';

dotenv.config();

// ─── Clientes LLM ─────────────────────────────────────────────────────────────

async function llamarClaude(systemPrompt, historial) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('Sin API key de Anthropic');

  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  const client = new Anthropic({ apiKey });

  const messages = historial.slice(0, -1).map(m => ({
    role:    m.role === 'assistant' ? 'assistant' : 'user',
    content: m.content
  }));
  messages.push({ role: 'user', content: historial[historial.length - 1]?.content || '' });

  const msg = await client.messages.create({
    model:      'claude-haiku-4-5-20251001',
    max_tokens: 400,
    system:     systemPrompt,
    messages
  });

  return msg.content[0].text.trim();
}

async function llamarGemini(prompt, temperatura = 0.85, maxTokens = 400) {
  const { GoogleGenerativeAI } = await import('@google/generative-ai');
  const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
  const model = genAI.getGenerativeModel({
    model:            process.env.GEMINI_MODEL || 'gemini-2.0-flash',
    generationConfig: { temperature: temperatura, maxOutputTokens: maxTokens }
  });
  const result = await model.generateContent(prompt);
  return result.response.text().trim();
}

// ─── Wrapper con fallback ─────────────────────────────────────────────────────

async function generarTexto(systemPrompt, userPrompt, fallback) {
  if (process.env.ANTHROPIC_API_KEY) {
    try { return await llamarClaude(systemPrompt, [{ role: 'user', content: userPrompt }]); }
    catch (e) { console.warn('⚠️  Claude falló:', e.message); }
  }
  try { return await llamarGemini(`${systemPrompt}\n\n${userPrompt}`); }
  catch (e) { console.warn('⚠️  Gemini falló:', e.message); }
  return fallback;
}

// ─── Respuesta conversacional con historial completo ─────────────────────────

export async function generarRespuesta(systemPrompt, historial, temperatura = 0.85) {
  if (process.env.ANTHROPIC_API_KEY) {
    try { return await llamarClaude(systemPrompt, historial); }
    catch (e) { console.warn('⚠️  Claude falló:', e.message); }
  }

  try {
    const prompt = `${systemPrompt}\n\nHistorial reciente:\n${
      historial.slice(-6).map(m =>
        `${m.role === 'user' ? 'Lead' : 'Victoria'}: ${m.content}`
      ).join('\n')
    }\n\nResponde SOLO con tu siguiente mensaje como Victoria:`;
    return await llamarGemini(prompt, temperatura);
  } catch (e) { console.warn('⚠️  Gemini falló:', e.message); }

  return siguienteFallback();
}

// ─── Mensaje inicial de apertura ─────────────────────────────────────────────

export async function generarMensajeInicial(prospecto) {
  const dias   = calcularDiasDesdeUltimaCita(prospecto.fecha_cita);
  const nombre = prospecto.nombre_completo?.split(' ')[0] || '';

  const system = `Eres Victoria, una mujer real de unos 30 años que trabaja en AHJ ENDE en el Estado de México.
Escribes en WhatsApp como habla la gente de la zona — directo, cálido, sin frases de vendedora.

Tu único trabajo ahora: escribir el primer mensaje de apertura. Solo uno.

REGLAS ESTRICTAS:
- Máximo 2 líneas muy cortas
- Saluda con "Hola ${nombre}" natural — sin "¡Hola!" con exclamación
- NO te presentes todavía, NO menciones AHJ ENDE, NO menciones la prepa ni ningún servicio
- Genera curiosidad suave, como retomando una plática que quedó pendiente
- Suena como si ya se conocieran un poco — no como vendedora fría
- 0 emojis o máximo 1 muy discreto al final
- Sin comillas, sin asteriscos, sin signos de exclamación
- Varía el mensaje — nunca uses la misma apertura dos veces`;

  const user     = `Nombre: ${nombre}. Hace ${dias} días mostró interés en terminar la prepa pero no concretó la cita. Escribe el mensaje de apertura.`;
  const fallback = `Hola ${nombre}, quedé con pendiente de platicar contigo. ¿Cómo andas?`;

  return await generarTexto(system, user, fallback);
}

// ─── Parsear respuesta multi-mensaje ─────────────────────────────────────────

export function parsearMensajes(texto) {
  const partes = texto
    .split(/\n{2,}/)
    .map(p => p.trim())
    .filter(p => p.length > 0);
  return partes.slice(0, 3);
}

// ─── Delays humanos ───────────────────────────────────────────────────────────

export function delayHumano(longitudMensaje = 50) {
  const base    = Math.floor(Math.random() * 40) + 15; // 15–55s
  const extra   = Math.floor(longitudMensaje / 25);
  return new Promise(resolve => setTimeout(resolve, (base + extra) * 1000));
}

export function delayEntrePartes(longitudMensaje = 30) {
  const base    = Math.floor(Math.random() * 8) + 4; // 4–12s
  const extra   = Math.floor(longitudMensaje / 40);
  return new Promise(resolve => setTimeout(resolve, (base + extra) * 1000));
}

// ─── Temperatura del LLM según scoring ───────────────────────────────────────

export function obtenerTemperaturaLLM(scoring) {
  if (scoring >= TEMPERATURA.CALIENTE.min) return TEMPERATURA.CALIENTE.gemini_temp;
  if (scoring >= TEMPERATURA.TIBIO.min)    return TEMPERATURA.TIBIO.gemini_temp;
  return TEMPERATURA.FRIO.gemini_temp;
}

// ─── Fallback hardcodeado ─────────────────────────────────────────────────────

const RESPUESTAS_FALLBACK = [
  '¿Me cuentas más? Quiero entender tu situación 😊',
  'Qué interesante... ¿qué es lo que más te preocupa?',
  'Sale, entiendo. ¿Y qué necesitarías para que funcione para ti?',
  'Cuéntame más, me late que podemos encontrar algo que se acomode.',
  'Órale, eso tiene sentido. ¿Qué te frenó la última vez?'
];

let fallbackIndex = 0;
function siguienteFallback() {
  const msg = RESPUESTAS_FALLBACK[fallbackIndex % RESPUESTAS_FALLBACK.length];
  fallbackIndex++;
  return msg;
}
