<?php

set_exception_handler(fn($exception) => print $exception->getMessage());

function get_value(mixed $data, string $key, mixed $default = null): mixed
{
    if (is_object($data)) {
        return !empty($data->$key) ? $data->$key : $default;
    }

    return !empty($data[$key]) ? $data[$key] : $default;
}

function detect_path(): string
{
    return parse_url(
        get_value($_SERVER, 'REQUEST_URI') ?:
        get_value(getopt('', ['path:']), 'path'),
        PHP_URL_PATH
    );
}

function clean_path(string $path): string
{
    $regex = '/\/?pages|\/?((index\/?){0,2}\.[a-zA-Z]+)/';

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
    $html = ob_get_contents();
    ob_end_clean();

    return $html;
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

    uasort($pages, fn($a, $b) => strcmp($a->file, $b->file));

    return $pages;
}

function render_page(string $path = null): string
{
    $pages = index_pages();

    $path = $path ?: detect_path();
    $page = get_value($pages, $path);
    $view = get_value($page, 'view');

    if (!$page) {
        throw new Error("Page $path not found.");
    }

    if (!$view) {
        throw new Error("Page $path has no view defined.");
    }

    return load_view($view, ['pages' => $pages, 'page' => $page]);
}
