<?php
/* =========================================================
 * Eserve Infotech — content proxy
 * Reads content.json fresh on every request and echoes it
 * with strict no-cache headers so browsers + CDNs never
 * serve a stale copy after the writer hits "Save".
 * The public site's loader fetches this URL by default;
 * if PHP is unavailable, it falls back to content.json.
 * ========================================================= */

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');
header('Expires: 0');
header('Access-Control-Allow-Origin: *');
header_remove('ETag');
header_remove('Last-Modified');

$path = __DIR__ . '/content.json';
clearstatcache(true, $path);

if (!file_exists($path)) {
    http_response_code(404);
    echo '{}';
    exit;
}

$raw = @file_get_contents($path);
if ($raw === false) {
    http_response_code(500);
    echo '{}';
    exit;
}
echo $raw;
