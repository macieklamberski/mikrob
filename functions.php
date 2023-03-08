<?php

set_exception_handler(fn($exception) => print $exception->getMessage());

function array_get(mixed $array, string $key, mixed $default = null): mixed
{
    return !empty($array[$key]) ? $array[$key] : $default;
}

function detect_uri(): string
{
    $queryUri = array_get($_SERVER, 'REQUEST_URI');
    $argvUri = array_get(getopt('', ['request-uri:']), 'request-uri');
    $cleanUri = trim(strtok($queryUri ?: $argvUri ?: '', '?'), '/') ?: 'index';

    return $cleanUri;
}

function render_page(string $uri = null): string
{
    $uri = $uri ?: detect_uri();

    $pagesDir = getcwd() . '/pages';
    $pageFile = "$uri.php";
    $filePath = "$pagesDir/$pageFile";

    if (file_exists($filePath)) {
        return (fn() => require $filePath)();
    }

    throw new Error(
        "Page \"$pageFile\" not found (looked into: \"$pagesDir\")."
    );
}
