# Mikrob 🦠

Simple website engine.

## Overview

Install the Composer package:

```bash
composer require macieklamberski/mikrob
```

Create `public/index.php` and paste:

```php
<?php

chdir('..');

require 'vendor/autoload.php';

print Mikrob\render_page();
```

Then start the server:

```bash
php -S localhost:8080 -t public
```

When opened in the browser, the script will automatically detect the page based on `$_SERVER['REQUEST_URI']`:

- localhost:8080 → _pages/index.{json,php,md}_,
- localhost:8080/about → _pages/about.{json,php,md}_.

`render_page()` accepts an optional parameter to explicitly tell it the page name:

```php
render_page('/contact'); // to render pages/contact.{json,php,md}
```

It's also possible to generate the page in CLI:

```bash
php index.php # to render page pages/index.php
php index.php --path=/terms # to render page pages/terms.{json,php,md}
```

## Pages

Pages are files located inside the _pages_ directory. The engine will look for one of three types of files — JSON, PHP, and Markdown. Each file represents one page with a path derived from the directory structure. _index.{json,php,md}_ files receive special treatment by stripping away the "index" segment from the path.

| File                                         | Address           |
| -------------------------------------------- | ----------------- |
| _pages/blog/hello-world.{json,php,md}_       | /blog/hello-world |
| _pages/blog/hello-world/index.{json,php,md}_ | /blog/hello-world |
| _pages/blog/index.{json,php,md}_             | /blog             |
| _pages/blog/index/index.{json,php,md}_       | /blog             |

When Mikrob finds the file for a requested path, it will read its contents and pass it to the defined `view` template.

Page data is accessible in views as `$page`. If the page file contains the `description` property, it will be accessible as `$page->description`.

### JSON

```json
{
    "view": "templates/product",
    "title": "Vacuum-o-matic 2000",
    "description": "Lorem ipsum dolor zamęt.",
    "tags": ["hobby", "travel", "music"]
}
```

### PHP

This type is useful for making some calculations or data fetching before returning the data to view.

```php
<?php

return [
    'view' => 'page',
    'title' => 'Hello world!',
    'date' => '2019-03-07',
];
```

### Markdown

Each _\*.md_ file should consist of two parts — the front matter (JSON-based) and the page body written in Markdown. This format is intended for content-heavy pages and blog posts. The markdown part will be accessible in view as `$page->body`.

```md
---
{
    "view": "post",
    "title": "My first post",
    "published": "2022-10-20"
}
---

This is content of my **first post**. It's nice.
```

### Custom page order and path

Pages are ordered alphabetically based on their path.

To customize the order, you can prefix the directory and file names with a number (or timestamp). Eg.

```
pages/
└── blog/
    ├── 01-uno.md
    └── 02-dos.md
```

But then, it becomes a part of the URL: _blog/01-uno.md_ would be accessible as /blog/01-uno.

To keep the URLs clean, you can overwrite the autogenerated path using the `path` property.

```json
{
    "path": "/blog/uno"
}
```

### Wildcard pages

Paths containing a valid regular expression allow a single page to respond to multiple paths. Mikrob will first attempt to find a direct match for the requested URL. If no direct match is found, it will then evaluate the URL against the regex defined in the `path` of wildcard pages.

The "not found" error page is a good example. To handle all requests for non-existent pages with a custom 404 error page, create a JSON file at _/pages/404.json_ with the following contents:

```json
{
    "view": "templates/404",
    "path": "/.*/",
}
```

### Path parameters

Mikrob supports path parameters using [named regular expression groups](https://www.regular-expressions.info/named.html) to dynamically extract segments from URL paths. This allows variable portions of a URL to be defined and utilized as parameters within your application. For example, you can configure a path parameter for news pagination like this:

```json
{
  "view": "templates/news",
  "path": "#/news(/page/(?<page>\\d+))#"
}
```

In this example, the numerical page information from the URL is captured and assigned to the `page` parameter. When you open the `/news/page/2` URL, the "2" will be accessible through `$page->params['page']`.

### Redirections

You can create a page that only redirects to another location by using the `redirect` property. This property takes two values: `destination`, which is the URL to redirect to, and `permanent`, which is a boolean indicating whether the redirection should be done with a 301 HTTP code.

```json
{
    "redirect": {
        "destination": "http://domain.com",
        "permanent": true,
    },
}
```

This would make the page accessible as /blog/uno.

### HTTP status

Sometimes, you might want to inform web browsers or search engines that a page has a specific status.

For instance, when displaying a "not found" page, you can send a 404 status code by setting the `status` property to 404. This will automatically transmit the status code to the browser.

```json
{
    "view": "templates/404",
    "path": ".*",
    "status": 404,
}
```

## Views

Views are PHP files located inside the _views_ directory. They're referenced in pages as `view`.

```json
{
  "view": "templates/post"
}
```

Inside view files, you can define the HTML structure of your pages, sugar-coated with PHP code (like in the old days).

The main page view has the `$page` variable containing all the properties defined in the page file.

You can include other views (partials) using `load_view(string $path, array $data = [])`. The second parameter is useful for passing down any values necessary for the partial.

```php
<?= Mikrob\load_view('partials/header', ['title' => $page->title]) ?>
```
