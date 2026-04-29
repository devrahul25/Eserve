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

// Force PHP to drop any cached metadata about the file (mtime, size).
clearstatcache(true, $CONTENT_PATH);
// Bump mtime explicitly so any reverse-proxy that uses Last-Modified sees the change.
@touch($CONTENT_PATH);

// ---- STATIC SITE GENERATION ----
// The user wants the HTML files to be permanently overwritten with the new content.
function update_html_files($data, $base_dir) {
    $files = array_merge(glob($base_dir . '/*.html'), glob($base_dir . '/*/*.html'));
    
    foreach ($files as $file) {
        if (strpos($file, '/admin/') !== false) continue;
        
        $html = file_get_contents($file);
        $changed = false;
        
        // 1. Regular data-edit
        $html = preg_replace_callback(
            '/(<([a-zA-Z0-9]+)[^>]*data-edit="([^"]+)"[^>]*>)(.*?)(<\/\2>)/is',
            function($m) use ($data, &$changed) {
                $opening = $m[1];
                $key = $m[3];
                $closing = $m[5];
                
                $parts = explode('.', $key);
                $val = $data;
                foreach ($parts as $p) {
                    if (!isset($val[$p])) return $m[0];
                    $val = $val[$p];
                }
                
                if (is_scalar($val)) {
                    $changed = true;
                    // If it has data-edit-html, don't htmlspecialchars
                    if (stripos($opening, 'data-edit-html') !== false) {
                        return $opening . $val . $closing;
                    }
                    return $opening . htmlspecialchars($val) . $closing;
                }
                return $m[0];
            },
            $html
        );
        
        // 2. data-edit on inputs/textareas
        $html = preg_replace_callback(
            '/(<input[^>]*data-edit="([^"]+)"[^>]*value=")([^"]*)("[^>]*>)/is',
            function($m) use ($data, &$changed) {
                $key = $m[2];
                $parts = explode('.', $key);
                $val = $data;
                foreach ($parts as $p) {
                    if (!isset($val[$p])) return $m[0];
                    $val = $val[$p];
                }
                if (is_scalar($val)) {
                    $changed = true;
                    return $m[1] . htmlspecialchars($val) . $m[4];
                }
                return $m[0];
            },
            $html
        );
        
        // 3. data-edit-href
        $html = preg_replace_callback(
            '/(<a[^>]*data-edit-href="([^"]+)"[^>]*href=")([^"]*)("[^>]*>)/is',
            function($m) use ($data, &$changed) {
                $key = $m[2];
                $parts = explode('.', $key);
                $val = $data;
                foreach ($parts as $p) {
                    if (!isset($val[$p])) return $m[0];
                    $val = $val[$p];
                }
                if (is_scalar($val)) {
                    $changed = true;
                    preg_match('/data-edit-prefix="([^"]*)"/i', $m[1].$m[4], $pref_m);
                    $prefix = $pref_m ? $pref_m[1] : '';
                    return $m[1] . htmlspecialchars($prefix . $val) . $m[4];
                }
                return $m[0];
            },
            $html
        );

        if ($changed) {
            file_put_contents($file, $html);
        }
    }
}
update_html_files($data, dirname($CONTENT_PATH));

send_json([
    'ok'      => true,
    'bytes'   => $bytes,
    'savedAt' => date('c'),
    'mtime'   => filemtime($CONTENT_PATH),
]);
