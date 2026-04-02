// modules/api.js
// Cliente HTTP para api_citas.php — única fuente de verdad de la BD
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const BASE_URL = process.env.API_CITAS_URL;
const TOKEN    = process.env.API_CITAS_TOKEN;
const ID_EJE   = process.env.API_CITAS_ID_EJE || 3971;

const headers = {
  'Authorization': `Bearer ${TOKEN}`,
  'Content-Type': 'application/json'
};

// Normaliza los campos del PHP (nom_cit, tel_cit...) al formato interno del bot
function normalizarProspecto(cita) {
  return {
    id_cit:          cita.id_cit,
    nombre_completo: cita.nom_cit,
    telefono:        cita.tel_limpio || cita.tel_cit?.replace(/\D/g, ''),
    fecha_cita:      cita.fecha_agendada || null,
    modalidad:       cita.pro_cit || 'Preparatoria',
    observaciones:   cita.obs_cit || '',
    asesor:          cita.asesor  || '',
    est_cit:         cita.est_cit || ''
  };
}

// GET ?action=pendientes — leads CITA NO ATENDIDA (y otros estados)
export async function getPendientes(limit = 30) {
  try {
    const { data } = await axios.get(BASE_URL, {
      headers,
      params: { action: 'pendientes', limit, id_eje3: ID_EJE }
    });

    if (!data.success) {
      console.error('❌ API pendientes:', data.error);
      return [];
    }

    // Filtrar solo los de "CITA NO ATENDIDA" para esta campaña
    const soloNoAtendidas = data.citas.filter(c => c.est_cit === 'CITA NO ATENDIDA');
    return soloNoAtendidas.map(normalizarProspecto);

  } catch (error) {
    console.error('❌ Error getPendientes:', error.message);
    return [];
  }
}

// POST ?action=guardar_chatid — asocia el chat_id de WA al lead
export async function guardarChatId(id_cit, chat_id) {
  try {
    const { data } = await axios.post(
      `${BASE_URL}?action=guardar_chatid&id_eje3=${ID_EJE}`,
      { id_cit, chat_id, id_eje3: ID_EJE },
      { headers }
    );
    return data.success;
  } catch (error) {
    console.error('❌ Error guardarChatId:', error.message);
    return false;
  }
}

// GET ?action=buscar_por_chatid — encuentra el lead por su chat_id de WA
export async function buscarPorChatId(chat_id) {
  try {
    const { data } = await axios.get(BASE_URL, {
      headers,
      params: { action: 'buscar_por_chatid', chat_id, id_eje3: ID_EJE }
    });

    if (!data.success || data.match === 'ninguno') return null;
    return data;

  } catch (error) {
    console.error('❌ Error buscarPorChatId:', error.message);
    return null;
  }
}

// POST ?action=guardar_conversacion — persiste historial + scoring
export async function guardarConversacion(id_cit, historial, scoring, temperatura, estado = 'ACTIVA', resumen = '') {
  try {
    const { data } = await axios.post(
      `${BASE_URL}?action=guardar_conversacion&id_eje3=${ID_EJE}`,
      {
        id_cit,
        historial_json:       JSON.stringify(historial),
        scoring,
        temperatura,
        estado_conversacion:  estado,
        resumen_conversacion: resumen,
        id_eje3:              ID_EJE
      },
      { headers }
    );
    return data.success;
  } catch (error) {
    console.error('❌ Error guardarConversacion:', error.message);
    return false;
  }
}

// POST ?action=resumen — cierra/actualiza el lead con resultado final
// resultado: 'INTERESADO' | 'NO LE INTERESA' | 'SIN_RESPUESTA' | 'AGENDADO'
export async function guardarResumen(id_cit, resultado, resumen) {
  try {
    const { data } = await axios.post(
      `${BASE_URL}?action=resumen&id_eje3=${ID_EJE}`,
      { id_cit, resultado, resumen, id_eje3: ID_EJE },
      { headers }
    );
    return data.success;
  } catch (error) {
    console.error('❌ Error guardarResumen:', error.message);
    return false;
  }
}
