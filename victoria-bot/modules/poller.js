// modules/poller.js
// Polling de mensajes — reemplaza el webhook que no funciona
// Cada N segundos consulta Evolution API por mensajes nuevos de los prospectos activos
import axios from 'axios';
import dotenv from 'dotenv';
import { mensajesEnviados } from './evolution.js';

dotenv.config();

const API_URL  = process.env.EVOLUTION_API_URL;
const API_KEY  = process.env.EVOLUTION_API_KEY;
const INSTANCE = process.env.EVOLUTION_INSTANCE;
const INTERVALO_MS = 5000; // cada 5 segundos

// timestamp de la última vez que vimos un mensaje por número
const ultimoVisto = new Map(); // tel → timestamp (ms)

let procesarMensajeFn = null;
let obtenerProspectoFn = null;
let intervalo = null;

export function iniciarPolling(fnBuscarProspecto, fnProcesarMensaje) {
  procesarMensajeFn  = fnProcesarMensaje;
  obtenerProspectoFn = fnBuscarProspecto;

  if (intervalo) clearInterval(intervalo);
  intervalo = setInterval(polling, INTERVALO_MS);
  console.log(`🔄 Polling activo cada ${INTERVALO_MS / 1000}s`);
}

export function registrarProspecto(telefono) {
  // Al registrar un prospecto, marcamos "desde ahora" para no reprocesar mensajes viejos
  ultimoVisto.set(telefono, Date.now());
}

export function detenerPolling() {
  if (intervalo) clearInterval(intervalo);
  intervalo = null;
}

async function polling() {
  if (!obtenerProspectoFn || ultimoVisto.size === 0) return;

  try {
    // Buscar mensajes recibidos (fromMe:false) en los últimos 2 minutos
    const desde = Math.floor((Date.now() - 120000) / 1000); // unix timestamp

    const { data } = await axios.post(
      `${API_URL}/chat/findMessages/${INSTANCE}`,
      {
        where: { key: { fromMe: false } },
        limit: 20
      },
      { headers: { apikey: API_KEY, 'Content-Type': 'application/json' } }
    );

    const mensajes = data?.messages?.records || [];

    for (const msg of mensajes) {
      // Ignorar mensajes enviados por el bot
      if (msg.key?.fromMe === true) continue;
      const msgId = msg.key?.id;
      if (msgId && mensajesEnviados.has(msgId)) continue;

      const msgTimestamp = (msg.messageTimestamp || 0) * 1000;

      // Obtener teléfono — Evolution v2 usa remoteJidAlt cuando el JID es @lid
      const jid = msg.key?.remoteJidAlt || msg.key?.remoteJid || '';
      const telefono = jid.replace('@s.whatsapp.net', '').replace(/\D/g, '');
      if (!telefono) continue;

      // Ver si este teléfono es un prospecto activo
      const prospecto = obtenerProspectoFn(telefono);
      if (!prospecto) continue;

      // Ignorar mensajes ya procesados
      const ultimoTs = ultimoVisto.get(telefono) || 0;
      if (msgTimestamp <= ultimoTs) continue;

      // Extraer texto
      const texto = msg.message?.conversation ||
                    msg.message?.extendedTextMessage?.text ||
                    msg.message?.imageMessage?.caption || '';
      if (!texto) continue;

      console.log(`\n📱 [POLL] Mensaje de ${prospecto.nombre_completo}: "${texto}"`);

      // Actualizar timestamp antes de procesar (evita doble procesamiento)
      ultimoVisto.set(telefono, msgTimestamp);

      // Construir objeto mensaje compatible con procesarMensaje
      const mensajeCompatible = {
        key: {
          remoteJid: jid.includes('@lid') ? `${telefono}@s.whatsapp.net` : jid,
          fromMe:    false,
          id:        msg.key?.id
        },
        message: msg.message,
        messageTimestamp: msg.messageTimestamp
      };

      await procesarMensajeFn(mensajeCompatible, prospecto);
    }

  } catch (error) {
    // Silencioso para no spamear la consola
    if (error.response?.status !== 404) {
      console.error('❌ Error en polling:', error.message);
    }
  }
}
