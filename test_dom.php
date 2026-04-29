<?php
$html = file_get_contents('index.html');
$dom = new DOMDocument();
@$dom->loadHTML($html);
$xpath = new DOMXPath($dom);
$nodes = $xpath->query('//*[@data-edit]');
foreach ($nodes as $node) {
    echo $node->getAttribute('data-edit') . "\n";
}
