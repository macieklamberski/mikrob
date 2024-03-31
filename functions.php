<?php

namespace Mikrob;

use Error;
use Parsedown;
use RecursiveDirectoryIterator;
use RecursiveIteratorIterator;
use SplFileInfo;

set_exception_handler(fn ($exception) => print $exception->getMessage());

function get_value(mixed $data, string $key, mixed $default = null): mixed
{
    return is_object($data) ? $data->$key ?? $default : $data[$key] ?? $default;
}

function detect_path(): string
{
    return parse_url(
        $_SERVER['REQUEST_URI'] ?? getopt('', ['path:'])['path'] ?? '',
        PHP_URL_PATH
    );
}

function clean_path(string $path): string
{
    $regex = [
        '/^\/?pages/',
        '/\/?(index\/?){1,2}\.[a-zA-Z]+/',
        '/\.[a-zA-Z]+$/',
    ];

    return preg_replace($regex, '', $path) ?: '/';
}

function load_view(string $view, array $data = []): string
{
    $file = "views/$view.php";

    if (!file_exists($file)) {
        throw new Error("View $file not found.");
    }

    extract($data);
    unset($data);

    ob_start();
    require $file;
    return ob_get_clean();
}

function find_page(array $pages, string $path): object|false
{
    if ($page = get_value($pages, $path)) {
        return $page;
    }

    foreach ($pages as $key => $page) {
        $pattern = !str_starts_with($key, '/') ? "/$key/" : $key;

        if (preg_match($pattern, $path)) {
            return $page;
        }
    }

    return false;
}

function load_page(SplFileInfo $info): object|false
{
    $file = $info->getPathname();
    $type = $info->getExtension();

    if ($type === 'json') {
        $page = json_decode(file_get_contents($file));
    }

    if ($type === 'php') {
        $page = (object) require $file;
    }

    if ($type === 'md') {
        preg_match('/---json((?!---).*)---(.*)/s', file_get_contents($file), $data);


        $page = json_decode(get_value($data, '1'));

        if (!$page) {
            throw new Error("Page $file is not correctly formatted and cannot be read.");
        }

        $page->body = (new Parsedown())->text(get_value($data, '2'));
    }

    if (empty($page)) {
        return false;
    }

    $page->file = $file;
    $page->path = clean_path(get_value($page, 'path', $file));

    return $page;
}

function index_pages(string $path = 'pages'): array
{
    $files = new RecursiveIteratorIterator(
        new RecursiveDirectoryIterator($path)
    );

    $pages = [];

    foreach ($files as $file) {
        $page = load_page($file);

        if ($page === false) {
            continue;
        }

        $pages[$page->path] = $page;
    }

    uasort($pages, fn ($a, $b) => strcmp($a->file, $b->file));

    return $pages;
}

function redirect_to(string $path, array|object $redirect): void
{
    $destination = get_value($redirect, 'destination');
    $permanent = get_value($redirect, 'permanent');

    if (!$destination) {
        throw new Error("Redirection in $path has no destination.");
    }

    header("Location: $destination", true, $permanent ? 301 : 302);
}

function render_page(string $path = null): string
{
    $pages = index_pages();

    $path = $path ?: detect_path();
    $page = find_page($pages, $path);
    $view = get_value($page, 'view');
    $redirect = get_value($page, 'redirect');
    $status = get_value($page, 'status');

    if (!$page) {
        throw new Error("Page $path not found.");
    }

    if ($redirect) {
        return redirect_to($path, $redirect);
    }

    if ($status && !headers_sent()) {
        http_response_code($status);
    }

    if (!$view) {
        throw new Error("Page $path has no view defined.");
    }

    return load_view($view, ['pages' => $pages, 'page' => $page]);
}
