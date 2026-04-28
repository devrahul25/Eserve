<?php
/* =========================================================
   Admin config — paths, password storage, session bootstrap.
   The actual password hash lives in /admin/data/password.hash
   so we never rewrite PHP code on password change.
   ========================================================= */

// Resolve paths
$ADMIN_DIR    = __DIR__;
$DATA_DIR     = $ADMIN_DIR . '/data';
$PW_FILE      = $DATA_DIR . '/password.hash';
$CONTENT_PATH = realpath($ADMIN_DIR . '/..') . '/content.json';
$BACKUP_DIR   = $ADMIN_DIR . '/backups';

// Default password (only used the first time, until the team changes it)
const DEFAULT_PASSWORD = 'eserve2026';

// Make sure data + backup dirs exist
if (!is_dir($DATA_DIR))   @mkdir($DATA_DIR, 0755, true);
if (!is_dir($BACKUP_DIR)) @mkdir($BACKUP_DIR, 0755, true);

// Bootstrap password.hash if missing — seed with default
if (!file_exists($PW_FILE)) {
    @file_put_contents($PW_FILE, password_hash(DEFAULT_PASSWORD, PASSWORD_DEFAULT));
}

// Helpers
function load_password_hash() {
    global $PW_FILE;
    $h = @file_get_contents($PW_FILE);
    return $h ? trim($h) : '';
}
function save_password_hash($plain) {
    global $PW_FILE;
    return @file_put_contents($PW_FILE, password_hash($plain, PASSWORD_DEFAULT)) !== false;
}
function send_json($data, $status = 200) {
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}
function read_json_body() {
    $raw = file_get_contents('php://input');
    if (!$raw) return null;
    return json_decode($raw, true);
}

// Session — secure, same-site
session_set_cookie_params([
    'lifetime' => 0,
    'path'     => '/',
    'httponly' => true,
    'samesite' => 'Lax',
]);
session_start();
