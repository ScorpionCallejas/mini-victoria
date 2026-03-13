// modules/evolution.js
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const API_URL = process.env.EVOLUTION_API_URL;
const API_KEY = process.env.EVOLUTION_API_KEY;
const INSTANCE = process.env.EVOLUTION_INSTANCE;

export async function enviarMensaje(numero, texto) {
  try {
    const numeroLimpio = numero.replace(/\D/g, '');
    
    const response = await axios.post(
      `${API_URL}/message/sendText/${INSTANCE}`,
      {
        number: `${numeroLimpio}@s.whatsapp.net`,
        text: texto
      },
      {
        headers: { 
          apikey: API_KEY,
          'Content-Type': 'application/json'
        }
      }
    );
    
    console.log(`📤 Mensaje enviado a ${numeroLimpio}`);
    return response.data;
    
  } catch (error) {
    console.error('❌ Error enviando mensaje:', error.message);
    throw error;
  }
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