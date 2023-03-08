# 🦠 mikrob

Ultralight site generator for PHP pages.

## Installation

Install the Composer package:

```bash
composer require lamberski/mikrob
```

## Usage

Create `index.php` and paste:

```php
<?php

require 'vendor/autoload.php';

render_page();
```

Then start the server:

```bash
php -S localhost:8080 index.php
```

When opened in the browser, the script will automatically detect the page based on `REQUEST_URI`:

-   localhost:8080 → _pages/index.php_,
-   localhost:8080/about → _pages/about.php_.

`render_page()` accepts an optional parameter to explicitly tell it the page name:

```php
render_page('contact'); // to render pages/contact.php
```

It's also possible to generate the page in CLI:

```bash
php index.php # to render page pages/index.php
php index.php --request-uri=terms # to render page pages/terms.php
```

## Roadmap

-   Support for Markdown pages,
-   Configuration file,
-   RSS/Atom feed support.
