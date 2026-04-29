<?php
$html = '<span class="line" data-edit="home.hero_h1_line1">Old Text</span>';
$data = ['home' => ['hero_h1_line1' => 'Software, AI &']];
$html = preg_replace_callback(
    '/(<([a-zA-Z0-9]+)[^>]*data-edit="([^"]+)"[^>]*>)(.*?)(<\/\2>)/is',
    function($m) use ($data) {
        $opening = $m[1];
        $key = $m[3];
        $closing = $m[5];
        $val = $data['home']['hero_h1_line1'];
        return $opening . htmlspecialchars($val) . $closing;
    },
    $html
);
echo $html;
