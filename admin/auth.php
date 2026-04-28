<?php
/* =========================================================
   Admin auth — login / logout / session check / change pw
   GET  ?action=ping          -> { ok:true, php:true }
   GET  ?action=check         -> { authed:bool }
   POST ?action=login         -> body { password } -> { ok | error }
   POST ?action=logout        -> { ok }
   POST ?action=change        -> body { current, new } -> { ok | error }   (must be authed)
   ========================================================= */

require __DIR__ . '/config.php';

$action = $_GET['action'] ?? '';
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

if ($action === 'ping') {
    send_json(['ok' => true, 'php' => true, 'php_version' => PHP_VERSION]);
}

if ($action === 'check') {
    send_json(['authed' => !empty($_SESSION['authed'])]);
}

if ($action === 'login' && $method === 'POST') {
    $body = read_json_body();
    $pw = is_array($body) && isset($body['password']) ? (string)$body['password'] : '';
    $hash = load_password_hash();
    if ($hash === '') send_json(['error' => 'Server password not initialised'], 500);
    if (!password_verify($pw, $hash)) {
        // tiny throttle to slow brute force
        usleep(400 * 1000);
        send_json(['error' => 'Incorrect password'], 401);
    }
    $_SESSION['authed'] = true;
    send_json(['ok' => true]);
}

if ($action === 'logout' && $method === 'POST') {
    $_SESSION = [];
    if (ini_get('session.use_cookies')) {
        $p = session_get_cookie_params();
        setcookie(session_name(), '', time() - 42000,
            $p['path'], $p['domain'] ?? '', $p['secure'] ?? false, $p['httponly'] ?? false);
    }
    session_destroy();
    send_json(['ok' => true]);
}

if ($action === 'change' && $method === 'POST') {
    if (empty($_SESSION['authed'])) send_json(['error' => 'Not signed in'], 401);
    $body = read_json_body();
    $cur = is_array($body) && isset($body['current']) ? (string)$body['current'] : '';
    $new = is_array($body) && isset($body['new'])     ? (string)$body['new']     : '';
    if (!password_verify($cur, load_password_hash())) send_json(['error' => 'Current password is incorrect'], 401);
    if (strlen($new) < 6) send_json(['error' => 'New password must be at least 6 characters'], 400);
    if (!save_password_hash($new)) send_json(['error' => 'Could not write password file (check permissions)'], 500);
    send_json(['ok' => true]);
}

send_json(['error' => 'Unknown action'], 400);
