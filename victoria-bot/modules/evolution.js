// modules/evolution.js
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const API_URL = process.env.EVOLUTION_API_URL;
const API_KEY = process.env.EVOLUTION_API_KEY;
const INSTANCE = process.env.EVOLUTION_INSTANCE;

// IDs de mensajes que el bot envió — el poller los ignora
export const mensajesEnviados = new Set();

export async function enviarMensaje(numero, texto) {
  const numeroLimpio = numero.replace(/\D/g, '');
  const hdrs = { apikey: API_KEY, 'Content-Type': 'application/json' };

  // Evolution API v2 acepta el número solo (sin @s.whatsapp.net)
  // v1 lo requería con el sufijo — probamos v2 primero, fallback a v1
  const intentos = [
    { number: numeroLimpio },
    { number: `${numeroLimpio}@s.whatsapp.net` }
  ];

  for (const body of intentos) {
    try {
      const response = await axios.post(
        `${API_URL}/message/sendText/${INSTANCE}`,
        { ...body, text: texto },
        { headers: hdrs }
      );
      const msgId = response.data?.key?.id;
      if (msgId) mensajesEnviados.add(msgId);
      console.log(`📤 Mensaje enviado a ${numeroLimpio}`);
      return response.data;
    } catch (error) {
      const status  = error.response?.status;
      const detalle = JSON.stringify(error.response?.data || error.message);
      console.error(`❌ Error enviando (${body.number}) — ${status}: ${detalle}`);
      if (status !== 400) throw error; // solo reintenta con 400
    }
  }

  throw new Error(`No se pudo enviar mensaje a ${numeroLimpio}`);
}

export async function verificarConexion() {
  try {
    const response = await axios.get(
      `${API_URL}/instance/connectionState/${INSTANCE}`,
      { headers: { apikey: API_KEY } }
    );

    return response.data.instance?.state === 'open';

  } catch (error) {
    console.error('❌ Error verificando conexión:', error.message);
    return false;
  }
}

// Registra el webhook en Evolution API para que nos envíe los mensajes entrantes
export async function configurarWebhook(webhookUrl) {
  const body = {
    url:               webhookUrl,
    webhook_by_events: false,
    webhook_base64:    false,
    events:            ['MESSAGES_UPSERT']
  };
  const hdrs = { apikey: API_KEY, 'Content-Type': 'application/json' };

  // Evolution API v2 usa /{instance}/webhook — v1 usa /webhook/set/{instance}
  const endpoints = [
    { method: 'post', url: `${API_URL}/${INSTANCE}/webhook` },
    { method: 'post', url: `${API_URL}/webhook/set/${INSTANCE}` },
    { method: 'put',  url: `${API_URL}/webhook/set/${INSTANCE}` }
  ];

  for (const ep of endpoints) {
    try {
      await axios[ep.method](ep.url, body, { headers: hdrs });
      console.log(`✅ Webhook registrado en ${ep.url}`);
      return true;
    } catch (_) { /* prueba el siguiente */ }
  }

  console.warn(`⚠️  Configura el webhook manualmente en http://localhost:8080/manager`);
  console.warn(`   URL a registrar: ${webhookUrl} | Evento: MESSAGES_UPSERT`);
  return false;
}