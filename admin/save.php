<?php
/* =========================================================
   Admin save — writes content.json from POST body.
   Requires an authed session.
   POST body: { data: { ... entire content.json shape ... } }
   ========================================================= */

require __DIR__ . '/config.php';

if (empty($_SESSION['authed'])) send_json(['error' => 'Not signed in'], 401);
if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') send_json(['error' => 'POST required'], 405);

$body = read_json_body();
if (!is_array($body) || !isset($body['data']) || !is_array($body['data'])) {
    send_json(['error' => 'Invalid request body'], 400);
}
$data = $body['data'];

// Backup current file before overwriting
if (file_exists($CONTENT_PATH)) {
    $stamp = date('Y-m-d_His');
    @copy($CONTENT_PATH, $BACKUP_DIR . "/content-{$stamp}.json");
    // keep at most 30 backups
    $files = glob($BACKUP_DIR . '/content-*.json') ?: [];
    if (count($files) > 30) {
        usort($files, function ($a, $b) { return filemtime($a) - filemtime($b); });
        foreach (array_slice($files, 0, count($files) - 30) as $old) @unlink($old);
    }
}

// Encode and write
$json = json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
if ($json === false) send_json(['error' => 'Failed to encode JSON: ' . json_last_error_msg()], 500);

// Atomic write — temp file then rename
$tmp = $CONTENT_PATH . '.tmp.' . bin2hex(random_bytes(4));
$bytes = @file_put_contents($tmp, $json, LOCK_EX);
if ($bytes === false) {
    @unlink($tmp);
    send_json([
        'error'  => 'Could not write to content.json. Make sure the file is writable by the web server (try chmod 664 or 666 on content.json).',
        'path'   => $CONTENT_PATH,
    ], 500);
}
if (!@rename($tmp, $CONTENT_PATH)) {
    @unlink($tmp);
    send_json(['error' => 'Could not replace content.json (rename failed). Check folder permissions.'], 500);
}

send_json(['ok' => true, 'bytes' => $bytes, 'savedAt' => date('c')]);
