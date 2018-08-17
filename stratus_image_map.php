<?php

include('simple_html_dom.php');
$html = file_get_html('https://stratus.network/maps');

// Find all images
foreach($html->find('img[class=img-responsive]') as $element)
{
	$headers = get_headers($element->src, 1);
	if (strpos($headers['Content-Type'], 'image/') !== false)
		header('Location:'.$element->src);
	else
		header('Location: https://i.imgur.com/kilLOld.gif');
}
?>
