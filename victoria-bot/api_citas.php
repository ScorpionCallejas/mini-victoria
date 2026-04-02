<?php
/**
 * API VICTORIA-AGENDADOR - SICAM
 * Bot de agendamiento WhatsApp con Claude Sonnet 4.5
 * id_eje Victoria = 3971
 *
 * CHANGELOG v5.2:
 * - agendarCita: acepta "YYYY-MM-DD HH:MM:SS" en hora local MX (no UTC)
 *   El string llega ya formateado desde Node con formatoMySQL(), no hay conversión
 * - agendarCita: obs_cit ya NO guarda logs técnicos de flujo — solo datos humanos
 * - guardarResumen: sin cambios — ya tenía la lógica correcta de firma + destacable
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

// ============================================================================
// CONEXIÓN DB (PHP 5.6 compatible)
// ============================================================================
$db = new mysqli("localhost", "ericorps_10", "Anjunabeats10", "ericorps_gea");
$db->set_charset('utf8mb4');

if ($db->connect_error) {
    die(json_encode(array('error' => 'DB connection failed', 'code' => $db->connect_errno)));
}

// ============================================================================
// CONFIG
// ============================================================================
define('API_TOKEN',       'V1ct0r1a_ENDE_2024_xK9mN');
// IDs de ejecutivo permitidos (campaña Victoria)
define('ID_EJE_AGENDO', 3971);  // Quien agenda (Victoria) — fijo siempre
define('FIRMA_BOT',       '🤖VICTORIA');

// Validar token
function validarToken() {
    $headers = function_exists('getallheaders') ? getallheaders() : array();
    $token   = isset($headers['Authorization']) ? str_replace('Bearer ', '', $headers['Authorization']) : '';
    if (empty($token)) $token = isset($_GET['token']) ? $_GET['token'] : '';
    if ($token !== API_TOKEN) {
        http_response_code(401);
        echo json_encode(array('error' => 'Token invalido'));
        exit;
    }
}

// Valida y retorna el id_eje3 de campaña (dinámico por request)
function getIdEje($input = null) {
    // Prioridad: body > GET param > default 3971
    $id = 0;
    if ($input && isset($input['id_eje3'])) $id = intval($input['id_eje3']);
    if (!$id && isset($_GET['id_eje3']))     $id = intval($_GET['id_eje3']);
    if (!$id)                                $id = 3971; // default legacy
    // Validar que sea una campaña permitida (PHP 5.6: no arrays en define)
    $campanas_validas = array(3971, 3940, 3437);
    if (!in_array($id, $campanas_validas)) {
        http_response_code(403);
        echo json_encode(array('error' => 'id_eje3 no permitido: ' . $id));
        exit;
    }
    return $id;
}

// ============================================================================
// ROUTER
// ============================================================================
$method = $_SERVER['REQUEST_METHOD'];
$action = isset($_GET['action']) ? $_GET['action'] : '';

validarToken();

switch ($method) {
    case 'GET':
        switch ($action) {
            case 'cita':              getCita($db);            break;
            case 'pendientes':        getCitasPendientes($db); break;
            case 'agendados':         getAgendados($db);       break;
            case 'conversacion':      getConversacion($db);    break;
            case 'buscar_por_chatid': buscarPorChatId($db);    break;
            case 'stats':             getStats($db);           break;
            case 'config':            getConfig();             break;
            default: echo json_encode(array('error' => 'Accion GET no valida'));
        }
        break;

    case 'POST':
        $input = json_decode(file_get_contents('php://input'), true);
        if (!$input) $input = $_POST;
        switch ($action) {
            case 'crear':                crearCita($db, $input);           break;
            case 'agendar':              agendarCita($db, $input);         break;
            case 'actualizar':           actualizarCita($db, $input);      break;
            case 'resumen':              guardarResumen($db, $input);       break;
            case 'guardar_conversacion': guardarConversacion($db, $input);  break;
            case 'guardar_chatid':       guardarChatId($db, $input);        break;
            case 'cancelar_agendado':    cancelarAgendado($db, $input);     break;
            case 'asignar':              asignarAVictoria($db, $input);     break;
            default: echo json_encode(array('error' => 'Accion POST no valida'));
        }
        break;

    default:
        http_response_code(405);
        echo json_encode(array('error' => 'Metodo no permitido'));
}

$db->close();

// ============================================================================
// GET FUNCTIONS
// ============================================================================

function getConfig() {
    $id_eje = getIdEje();
    echo json_encode(array(
        'success'         => true,
        'id_eje_victoria' => $id_eje,
        'version'         => '5.4'
    ));
}

function getCita($db) {
    $id_eje = getIdEje();
    $id_cit = isset($_GET['id_cit']) ? intval($_GET['id_cit']) : 0;
    if ($id_cit <= 0) {
        echo json_encode(array('error' => 'id_cit requerido'));
        return;
    }

    $sql = "SELECT c.id_cit, c.nom_cit, c.tel_cit, c.eda_cit, c.pro_cit,
                   c.est_cit, c.efe_cit, c.obs_cit, c.cit_cit, c.hor_cit,
                   c.tip_cit, c.url_cit, c.fecha_agendada
            FROM cita c
            WHERE c.id_cit = $id_cit
            AND c.id_eje3 = " . $id_eje;

    $result = mysqli_query($db, $sql);
    if (!$result || mysqli_num_rows($result) == 0) {
        echo json_encode(array('error' => 'Cita no encontrada'));
        return;
    }

    $cita = mysqli_fetch_assoc($result);
    echo json_encode(array(
        'success'  => true,
        'cita'     => $cita,
        'agendada' => !empty($cita['fecha_agendada'])
    ));
}

function getCitasPendientes($db) {
    $id_eje = getIdEje();
    $limit = isset($_GET['limit']) ? intval($_GET['limit']) : 20;

    $sql = "SELECT c.id_cit, c.nom_cit, c.tel_cit, c.eda_cit, c.pro_cit,
                   c.est_cit, c.obs_cit, c.fecha_agendada
            FROM cita c
            WHERE c.id_eje3 = " . $id_eje . "
            AND c.est_cit != 'REGISTRO'
            AND c.est_cit IS NOT NULL
            AND c.tel_cit IS NOT NULL AND c.tel_cit != ''
            AND (c.fecha_agendada IS NULL OR c.fecha_agendada <= NOW())
            ORDER BY CASE c.est_cit
                WHEN 'PAGO ESPERADO'    THEN 1
                WHEN 'SEGUIMIENTO'      THEN 2
                WHEN 'CITA NO ATENDIDA' THEN 3
                ELSE 4
            END, c.id_cit DESC
            LIMIT $limit";

    $result = mysqli_query($db, $sql);
    if (!$result) {
        echo json_encode(array('error' => $db->error));
        return;
    }

    $citas = array();
    while ($row = mysqli_fetch_assoc($result)) {
        $row['tel_limpio'] = preg_replace('/[^0-9]/', '', $row['tel_cit']);
        $citas[] = $row;
    }

    echo json_encode(array(
        'success' => true,
        'total'   => count($citas),
        'citas'   => $citas
    ));
}

function getAgendados($db) {
    $id_eje = getIdEje();
    $horas = isset($_GET['horas']) ? intval($_GET['horas']) : 24;

    $sql = "SELECT c.id_cit, c.nom_cit, c.tel_cit, c.pro_cit,
                   c.est_cit, c.url_cit, c.fecha_agendada
            FROM cita c
            WHERE c.id_eje3 = " . $id_eje . "
            AND c.fecha_agendada IS NOT NULL
            AND c.fecha_agendada > NOW()
            AND c.fecha_agendada <= DATE_ADD(NOW(), INTERVAL $horas HOUR)
            ORDER BY c.fecha_agendada ASC";

    $result = mysqli_query($db, $sql);
    if (!$result) {
        echo json_encode(array('error' => $db->error));
        return;
    }

    $agendados = array();
    while ($row = mysqli_fetch_assoc($result)) {
        $row['tel_limpio']        = preg_replace('/[^0-9]/', '', $row['tel_cit']);
        $row['minutos_restantes'] = round((strtotime($row['fecha_agendada']) - time()) / 60);
        $agendados[] = $row;
    }

    echo json_encode(array(
        'success'   => true,
        'total'     => count($agendados),
        'agendados' => $agendados
    ));
}

function getConversacion($db) {
    $id_eje = getIdEje();
    $id_cit = isset($_GET['id_cit']) ? intval($_GET['id_cit']) : 0;
    if ($id_cit <= 0) {
        echo json_encode(array('error' => 'id_cit requerido'));
        return;
    }

    $sql = "SELECT * FROM conversacion_cita
            WHERE id_cit = $id_cit
            ORDER BY fecha_actualizacion DESC
            LIMIT 1";

    $result = mysqli_query($db, $sql);
    if (!$result || mysqli_num_rows($result) == 0) {
        echo json_encode(array('success' => true, 'existe' => false, 'conversacion' => null));
        return;
    }

    $conv              = mysqli_fetch_assoc($result);
    $conv['historial'] = json_decode($conv['historial_json'], true);
    $conv['metadata']  = json_decode($conv['metadata_json'], true);

    echo json_encode(array('success' => true, 'existe' => true, 'conversacion' => $conv));
}

function buscarPorChatId($db) {
    $id_eje = getIdEje();
    $chat_id = isset($_GET['chat_id']) ? $db->real_escape_string($_GET['chat_id']) : '';
    if (empty($chat_id)) {
        echo json_encode(array('error' => 'chat_id requerido'));
        return;
    }

    $sql = "SELECT c.id_cit, c.nom_cit, c.tel_cit,
                   cc.fecha_ultimo_envio,
                   TIMESTAMPDIFF(SECOND, cc.fecha_ultimo_envio, NOW()) as segundos_desde_envio
            FROM cita c
            LEFT JOIN conversacion_cita cc ON c.id_cit = cc.id_cit
            WHERE c.id_eje3 = " . $id_eje . "
            AND cc.chat_id_whatsapp = '$chat_id'
            ORDER BY cc.fecha_ultimo_envio DESC
            LIMIT 1";

    $result = mysqli_query($db, $sql);
    if ($result && mysqli_num_rows($result) > 0) {
        $row = mysqli_fetch_assoc($result);
        echo json_encode(array(
            'success'              => true,
            'match'                => 'exacto',
            'id_cit'               => intval($row['id_cit']),
            'nom_cit'              => $row['nom_cit'],
            'tel_cit'              => $row['tel_cit'],
            'segundos_desde_envio' => intval($row['segundos_desde_envio'])
        ));
        return;
    }

    if (strpos($chat_id, '@lid') !== false) {
        $sql = "SELECT c.id_cit, c.nom_cit, c.tel_cit,
                       cc.fecha_ultimo_envio,
                       TIMESTAMPDIFF(SECOND, cc.fecha_ultimo_envio, NOW()) as segundos_desde_envio
                FROM cita c
                INNER JOIN conversacion_cita cc ON c.id_cit = cc.id_cit
                WHERE c.id_eje3 = " . $id_eje . "
                AND cc.estado_conversacion IN ('ACTIVA', 'AGENDADO')
                AND cc.fecha_ultimo_envio >= DATE_SUB(NOW(), INTERVAL 120 SECOND)
                ORDER BY cc.fecha_ultimo_envio DESC
                LIMIT 1";

        $result = mysqli_query($db, $sql);
        if ($result && mysqli_num_rows($result) > 0) {
            $row    = mysqli_fetch_assoc($result);
            $id_cit = intval($row['id_cit']);

            mysqli_query($db,
                "UPDATE conversacion_cita SET chat_id_whatsapp = '$chat_id' WHERE id_cit = $id_cit"
            );

            echo json_encode(array(
                'success'              => true,
                'match'                => 'reciente',
                'id_cit'               => $id_cit,
                'nom_cit'              => $row['nom_cit'],
                'tel_cit'              => $row['tel_cit'],
                'segundos_desde_envio' => intval($row['segundos_desde_envio'])
            ));
            return;
        }
    }

    echo json_encode(array('success' => true, 'match' => 'ninguno'));
}

function getStats($db) {
    $id_eje = getIdEje();
    $sql = "SELECT est_cit, COUNT(*) as total
            FROM cita
            WHERE id_eje3 = " . $id_eje . "
            GROUP BY est_cit";

    $result = mysqli_query($db, $sql);
    $stats  = array();
    while ($row = mysqli_fetch_assoc($result)) {
        $stats[$row['est_cit']] = intval($row['total']);
    }

    $sql_ag = "SELECT COUNT(*) as total FROM cita
               WHERE id_eje3 = " . $id_eje . "
               AND fecha_agendada IS NOT NULL AND fecha_agendada > NOW()";

    $result_ag = mysqli_query($db, $sql_ag);
    $agendados = 0;
    if ($result_ag && $row = mysqli_fetch_assoc($result_ag)) {
        $agendados = intval($row['total']);
    }

    echo json_encode(array(
        'success'            => true,
        'stats'              => $stats,
        'agendados_proximos' => $agendados
    ));
}

// ============================================================================
// POST FUNCTIONS
// ============================================================================

function crearCita($db, $input) {
    $id_eje = getIdEje($input);
    $nom_cit = isset($input['nom_cit']) ? trim($db->real_escape_string($input['nom_cit'])) : '';
    $tel_cit = isset($input['tel_cit']) ? trim($db->real_escape_string($input['tel_cit'])) : '';
    $eda_cit = isset($input['eda_cit']) ? intval($input['eda_cit']) : 0;
    $pro_cit = isset($input['pro_cit']) ? trim($db->real_escape_string($input['pro_cit'])) : 'PREPA-1-MES';

    if (empty($nom_cit)) { echo json_encode(array('error' => 'nom_cit requerido')); return; }
    if (empty($tel_cit)) { echo json_encode(array('error' => 'tel_cit requerido')); return; }
    if ($eda_cit <= 0)   { echo json_encode(array('error' => 'eda_cit requerido')); return; }

    $check = mysqli_query($db,
        "SELECT id_cit, url_cit FROM cita
         WHERE tel_cit = '$tel_cit'
         AND id_eje3 = " . $id_eje . "
         AND est_cit != 'NO LE INTERESA'
         LIMIT 1"
    );

    if ($check && mysqli_num_rows($check) > 0) {
        $row = mysqli_fetch_assoc($check);
        echo json_encode(array(
            'success'   => true,
            'duplicado' => true,
            'id_cit'    => intval($row['id_cit']),
            'url_cit'   => $row['url_cit'],
            'mensaje'   => 'Registro existente recuperado'
        ));
        return;
    }

    // ✅ Round-robin por id_meet — el que sigue después del último asignado
    $url_cit     = 'https://meet.google.com/pendiente-asignar';
    $last_result = mysqli_query($db,
        "SELECT MAX(id_meet) as ultimo FROM cita c
         INNER JOIN meet_links ml ON c.url_cit = ml.url_meet
         WHERE c.id_eje3 = $id_eje AND ml.activo = 1"
    );
    $ultimo_id = 0;
    if ($last_result && $row_last = mysqli_fetch_assoc($last_result)) {
        $ultimo_id = intval($row_last['ultimo']);
    }
    // Siguiente en turno — si llegó al final, vuelve al primero
    $next_result = mysqli_query($db,
        "SELECT id_meet, url_meet FROM meet_links
         WHERE activo = 1 AND id_meet > $ultimo_id
         ORDER BY id_meet ASC LIMIT 1"
    );
    if (!$next_result || mysqli_num_rows($next_result) == 0) {
        // Reciclar — volver al primero
        $next_result = mysqli_query($db,
            "SELECT id_meet, url_meet FROM meet_links WHERE activo = 1 ORDER BY id_meet ASC LIMIT 1"
        );
    }
    if ($next_result && $row_meet = mysqli_fetch_assoc($next_result)) {
        $url_cit = $row_meet['url_meet'];
    }
    $url_escaped = $db->real_escape_string($url_cit);

    $sql = "INSERT INTO cita
                (nom_cit, tel_cit, eda_cit, pro_cit, est_cit, tip_cit, url_cit, id_eje3, id_eje_agendo)
            VALUES
                ('$nom_cit', '$tel_cit', $eda_cit, '$pro_cit', 'SEGUIMIENTO',
                 'Videoconferencia', '$url_escaped', " . $id_eje . ", " . ID_EJE_AGENDO . ")";

    $result = mysqli_query($db, $sql);
    if (!$result) {
        echo json_encode(array('error' => 'Error al crear registro', 'detalle' => $db->error));
        return;
    }

    echo json_encode(array(
        'success'   => true,
        'duplicado' => false,
        'id_cit'    => $db->insert_id,
        'url_cit'   => $url_cit,
        'nom_cit'   => $nom_cit,
        'tel_cit'   => $tel_cit,
        'mensaje'   => 'Registro creado correctamente'
    ));
}

function agendarCita($db, $input) {
    $id_eje = getIdEje($input);
    $id_cit         = isset($input['id_cit'])         ? intval($input['id_cit'])         : 0;
    $fecha_agendada = isset($input['fecha_agendada']) ? trim($input['fecha_agendada'])    : '';
    $mensaje        = isset($input['mensaje'])        ? trim($input['mensaje'])           : '';

    if ($id_cit <= 0)           { echo json_encode(array('error' => 'id_cit requerido'));         return; }
    if (empty($fecha_agendada)) { echo json_encode(array('error' => 'fecha_agendada requerida')); return; }

    $timestamp = strtotime($fecha_agendada);
    if (!$timestamp) {
        echo json_encode(array('error' => 'Formato de fecha invalido. Esperado: YYYY-MM-DD HH:MM:SS'));
        return;
    }
    if ($timestamp <= time()) {
        echo json_encode(array('error' => 'La fecha debe ser futura'));
        return;
    }

    $partes        = explode(' ', $fecha_agendada);
    $solo_fecha    = isset($partes[0]) ? $partes[0] : date('Y-m-d', $timestamp);
    $solo_hora     = isset($partes[1]) ? $partes[1] : date('H:i:s', $timestamp);
    $fecha_legible = date('d/m', $timestamp) . ' ' . substr($solo_hora, 0, 5);

    $fecha_mysql_esc = $db->real_escape_string($fecha_agendada);
    $solo_fecha_esc  = $db->real_escape_string($solo_fecha);
    $solo_hora_esc   = $db->real_escape_string($solo_hora);

    $check = mysqli_query($db,
        "SELECT nom_cit, tel_cit, obs_cit FROM cita
         WHERE id_cit = $id_cit AND id_eje3 = " . $id_eje
    );
    if (!$check || mysqli_num_rows($check) == 0) {
        echo json_encode(array('error' => 'Cita no encontrada'));
        return;
    }

    $cita       = mysqli_fetch_assoc($check);
    $obs_actual = isset($cita['obs_cit']) ? trim($cita['obs_cit']) : '';

    $obs_array = array();
    if (!empty($obs_actual)) {
        foreach (explode('|', $obs_actual) as $linea) {
            $linea = trim($linea);
            if (!empty($linea)) $obs_array[] = $linea;
        }
    }

    $destacable = extraerDestacableAgendado($mensaje, $fecha_legible);

    $ts = date('d/m H:i');
    if (!empty($destacable)) {
        $nueva_entrada = '[' . $ts . '] ✅ ' . $destacable . ' — ' . FIRMA_BOT;
    } else {
        $nueva_entrada = '[' . $ts . '] ✅ ' . FIRMA_BOT;
    }

    $obs_array[] = $nueva_entrada;
    if (count($obs_array) > 8) $obs_array = array_slice($obs_array, -8);

    $obs_final = $db->real_escape_string(implode(' | ', $obs_array));

    $sql = "UPDATE cita
            SET fecha_agendada = '$fecha_mysql_esc',
                cit_cit        = '$solo_fecha_esc',
                hor_cit        = '$solo_hora_esc',
                est_cit        = 'CITA AGENDADA',
                obs_cit        = '$obs_final'
            WHERE id_cit = $id_cit";

    $result = mysqli_query($db, $sql);
    if (!$result) {
        echo json_encode(array('error' => $db->error));
        return;
    }

    echo json_encode(array(
        'success'           => true,
        'id_cit'            => $id_cit,
        'nom_cit'           => $cita['nom_cit'],
        'tel_cit'           => $cita['tel_cit'],
        'fecha_agendada'    => $fecha_agendada,
        'fecha_legible'     => $fecha_legible,
        'minutos_restantes' => round(($timestamp - time()) / 60)
    ));
}

function actualizarCita($db, $input) {
    $id_eje = getIdEje($input);
    $id_cit  = isset($input['id_cit'])  ? intval($input['id_cit'])                  : 0;
    $est_cit = isset($input['est_cit']) ? $db->real_escape_string($input['est_cit']) : '';

    if ($id_cit <= 0 || empty($est_cit)) {
        echo json_encode(array('error' => 'id_cit y est_cit requeridos'));
        return;
    }

    $result = mysqli_query($db,
        "UPDATE cita SET est_cit = '$est_cit'
         WHERE id_cit = $id_cit AND id_eje3 = " . $id_eje
    );

    echo json_encode(array('success' => (bool)$result, 'id_cit' => $id_cit, 'est_cit' => $est_cit));
}

function guardarResumen($db, $input) {
    $id_eje = getIdEje($input);
    $id_cit    = isset($input['id_cit'])    ? intval($input['id_cit'])        : 0;
    $resultado = isset($input['resultado']) ? strtoupper($input['resultado']) : '';
    $resumen   = isset($input['resumen'])   ? trim($input['resumen'])         : '';

    if ($id_cit <= 0) { echo json_encode(array('error' => 'id_cit requerido')); return; }

    $check = mysqli_query($db,
        "SELECT obs_cit FROM cita WHERE id_cit = $id_cit AND id_eje3 = " . $id_eje
    );
    if (!$check || mysqli_num_rows($check) == 0) {
        echo json_encode(array('error' => 'Cita no encontrada'));
        return;
    }

    $row        = mysqli_fetch_assoc($check);
    $obs_actual = isset($row['obs_cit']) ? trim($row['obs_cit']) : '';

    $map = array(
        'AGENDADO'               => array('✅', 'CITA AGENDADA'),
        'CITA AGENDADA'          => array('✅', 'CITA AGENDADA'),
        'INTERESADO'             => array('👍', 'SEGUIMIENTO'),
        'NO LE INTERESA'         => array('❌', 'NO LE INTERESA'),
        'NO_INTERESA_DEFINITIVO' => array('🚫', 'NO LE INTERESA'),
        'SIN_RESPUESTA'          => array('👻', 'CITA NO ATENDIDA'),
        'MICRO_SI'               => array('👍', 'SEGUIMIENTO'),
    );

    $emoji         = isset($map[$resultado]) ? $map[$resultado][0] : '📝';
    $nuevo_estatus = isset($map[$resultado]) ? $map[$resultado][1] : 'SEGUIMIENTO';

    $obs_array = array();
    if (!empty($obs_actual)) {
        foreach (explode('|', $obs_actual) as $linea) {
            $linea = trim($linea);
            if (!empty($linea)) $obs_array[] = $linea;
        }
    }

    if (count($obs_array) >= 5) {
        $keywords  = extraerKeywords(array_slice($obs_array, 0, 3));
        $obs_array = array_merge(
            array('kw: ' . implode(', ', $keywords)),
            array_slice($obs_array, 3)
        );
    }

    $ts         = date('d/m H:i');
    $destacable = extraerDestacable($resumen, $resultado);

    if (!empty($destacable)) {
        $nueva_entrada = '[' . $ts . '] ' . $emoji . ' ' . $destacable . ' — ' . FIRMA_BOT;
    } else {
        $nueva_entrada = '[' . $ts . '] ' . $emoji . ' ' . FIRMA_BOT;
    }

    $obs_array[] = $nueva_entrada;
    if (count($obs_array) > 8) $obs_array = array_slice($obs_array, -8);

    $obs_final = $db->real_escape_string(implode(' | ', $obs_array));

    mysqli_query($db,
        "UPDATE cita SET obs_cit = '$obs_final', est_cit = '$nuevo_estatus' WHERE id_cit = $id_cit"
    );

    echo json_encode(array(
        'success'       => true,
        'id_cit'        => $id_cit,
        'est_cit'       => $nuevo_estatus,
        'destacable'    => !empty($destacable),
        'interacciones' => count($obs_array)
    ));
}

function guardarConversacion($db, $input) {
    $id_eje = getIdEje($input);
    $id_cit         = isset($input['id_cit'])              ? intval($input['id_cit'])                               : 0;
    $historial_json = isset($input['historial_json'])       ? $input['historial_json']                               : '[]';
    $scoring        = isset($input['scoring'])              ? intval($input['scoring'])                              : 30;
    $temperatura    = isset($input['temperatura'])          ? $db->real_escape_string($input['temperatura'])         : 'FRIO';
    $metadata_json  = isset($input['metadata_json'])        ? $input['metadata_json']                                : '{}';
    $estado         = isset($input['estado_conversacion'])  ? $db->real_escape_string($input['estado_conversacion']) : 'ACTIVA';
    $resumen        = isset($input['resumen_conversacion']) ? $input['resumen_conversacion']                         : '';

    if ($id_cit <= 0) { echo json_encode(array('error' => 'id_cit requerido')); return; }

    $h_esc = $db->real_escape_string($historial_json);
    $m_esc = $db->real_escape_string($metadata_json);
    $r_esc = $db->real_escape_string($resumen);

    $check = mysqli_query($db,
        "SELECT id_conversacion FROM conversacion_cita
         WHERE id_cit = $id_cit ORDER BY fecha_actualizacion DESC LIMIT 1"
    );

    if ($check && mysqli_num_rows($check) > 0) {
        $row     = mysqli_fetch_assoc($check);
        $id_conv = $row['id_conversacion'];
        $sql = "UPDATE conversacion_cita SET
                    historial_json       = '$h_esc',
                    scoring              = $scoring,
                    temperatura          = '$temperatura',
                    metadata_json        = '$m_esc',
                    estado_conversacion  = '$estado',
                    resumen_conversacion = '$r_esc',
                    fecha_actualizacion  = NOW()
                WHERE id_conversacion = $id_conv";
    } else {
        $sql = "INSERT INTO conversacion_cita
                    (id_cit, historial_json, scoring, temperatura,
                     metadata_json, estado_conversacion, resumen_conversacion)
                VALUES
                    ($id_cit, '$h_esc', $scoring, '$temperatura', '$m_esc', '$estado', '$r_esc')";
    }

    $result = mysqli_query($db, $sql);
    if (!$result) { echo json_encode(array('error' => $db->error)); return; }

    echo json_encode(array(
        'success'     => true,
        'id_cit'      => $id_cit,
        'scoring'     => $scoring,
        'temperatura' => $temperatura,
        'estado'      => $estado
    ));
}

function guardarChatId($db, $input) {
    $id_eje = getIdEje($input);
    $id_cit  = isset($input['id_cit'])  ? intval($input['id_cit'])                  : 0;
    $chat_id = isset($input['chat_id']) ? $db->real_escape_string($input['chat_id']) : '';

    if ($id_cit <= 0 || empty($chat_id)) {
        echo json_encode(array('error' => 'id_cit y chat_id requeridos'));
        return;
    }

    $check = mysqli_query($db,
        "SELECT id_conversacion FROM conversacion_cita WHERE id_cit = $id_cit LIMIT 1"
    );

    if ($check && mysqli_num_rows($check) > 0) {
        $sql = "UPDATE conversacion_cita
                SET chat_id_whatsapp = '$chat_id', fecha_ultimo_envio = NOW()
                WHERE id_cit = $id_cit";
    } else {
        $sql = "INSERT INTO conversacion_cita
                    (id_cit, chat_id_whatsapp, fecha_ultimo_envio, historial_json, metadata_json)
                VALUES ($id_cit, '$chat_id', NOW(), '[]', '{}')";
    }

    $result = mysqli_query($db, $sql);
    echo json_encode(array('success' => (bool)$result, 'id_cit' => $id_cit, 'chat_id' => $chat_id));
}

function cancelarAgendado($db, $input) {
    $id_eje = getIdEje($input);
    $id_cit = isset($input['id_cit']) ? intval($input['id_cit']) : 0;
    if ($id_cit <= 0) { echo json_encode(array('error' => 'id_cit requerido')); return; }

    $result = mysqli_query($db,
        "UPDATE cita SET fecha_agendada = NULL, est_cit = 'SEGUIMIENTO'
         WHERE id_cit = $id_cit AND id_eje3 = " . $id_eje
    );

    echo json_encode(array('success' => (bool)$result, 'id_cit' => $id_cit));
}

function asignarAVictoria($db, $input) {
    $id_eje = getIdEje($input);
    $id_cit = isset($input['id_cit']) ? intval($input['id_cit']) : 0;
    if ($id_cit <= 0) { echo json_encode(array('error' => 'id_cit requerido')); return; }

    mysqli_query($db, "UPDATE cita SET id_eje3 = " . $id_eje . " WHERE id_cit = $id_cit");
    echo json_encode(array('success' => true, 'id_cit' => $id_cit));
}

// ============================================================================
// HELPERS
// ============================================================================

function extraerKeywords($observaciones) {
    $importantes = array(
        'precio', 'dinero', 'caro', 'pagar', 'pago',
        'tiempo', 'ocupado', 'trabajo',
        'despues', 'luego', 'manana',
        'dudas', 'fraude', 'seguro',
        'datos', 'transferencia', 'confirmado',
        'familia', 'esposa', 'hijo', 'urgente'
    );

    $texto    = strtolower(implode(' ', $observaciones));
    $keywords = array();

    foreach ($importantes as $kw) {
        if (strpos($texto, $kw) !== false) $keywords[] = $kw;
    }

    return array_slice($keywords, 0, 5);
}

function extraerDestacable($resumen, $resultado) {
    $siempre = array('NO_INTERESA_DEFINITIVO', 'SIN_RESPUESTA');
    if (in_array($resultado, $siempre)) {
        return substr($resumen, 0, 80);
    }

    $senales = array(
        'precio', 'pago', 'dinero', 'costo', 'cuanto',
        'fraude', 'estafa', 'desconfia',
        'urgente', 'urge', 'rapido',
        'reajust', 'cambiar cita', 'reagend',
        'sin secundaria', 'no tiene secundaria',
        'objecion', 'no le interesa',
        'trabajo', 'ocupado', 'tiempo',
        'familia', 'esposo', 'esposa',
        'score alto', 'caliente', 'tibio'
    );

    $resumen_lower = strtolower($resumen);
    foreach ($senales as $senal) {
        if (strpos($resumen_lower, $senal) !== false) {
            return substr($resumen, 0, 80);
        }
    }

    return '';
}

function extraerDestacableAgendado($mensaje, $fecha_legible) {
    if (empty($mensaje)) return '';

    $senales_humanas = array(
        'precio', 'pago', 'dinero', 'costo',
        'fraude', 'estafa', 'desconfia',
        'urgente', 'urge',
        'cambia', 'reagenda', 'reajust',
        'trabajo', 'ocupado',
        'familia', 'esposo', 'esposa', 'hijo',
        'objecion', 'duda', 'pregunt'
    );

    $lower = strtolower($mensaje);
    foreach ($senales_humanas as $senal) {
        if (strpos($lower, $senal) !== false) {
            return substr($mensaje, 0, 80);
        }
    }

    return '';
}