<?php
$data = json_decode(file_get_contents('content.json'), true);
function update_html_files($data, $base_dir) {
    $files = array_merge(glob($base_dir . '/*.html'), glob($base_dir . '/*/*.html'));
    foreach ($files as $file) {
        if (strpos($file, '/admin/') !== false) continue;
        $html = file_get_contents($file);
        $changed = false;
        $html = preg_replace_callback(
            '/(<([a-zA-Z0-9]+)[^>]*data-edit="([^"]+)"[^>]*>)(.*?)(<\/\2>)/is',
            function($m) use ($data, &$changed) {
                $opening = $m[1]; $key = $m[3]; $closing = $m[5];
                $parts = explode('.', $key); $val = $data;
                foreach ($parts as $p) { if (!isset($val[$p])) return $m[0]; $val = $val[$p]; }
                if (is_scalar($val)) {
                    $changed = true;
                    if (stripos($opening, 'data-edit-html') !== false) return $opening . $val . $closing;
                    return $opening . htmlspecialchars($val) . $closing;
                }
                return $m[0];
            }, $html
        );
        if ($changed) file_put_contents($file, $html);
    }
}
update_html_files($data, __DIR__);
echo "Done.";
