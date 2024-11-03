# Mikrob 🦠

Simple file-based website engine.

Mikrob is a zero-configuration website engine that transforms your file structure into a fully functional website. Built on top of Hono, it supports multiple JavaScript runtimes and offers a flexible page system with React views.

## Quick Start

Install the package with your favourite package manger (`bun`, `deno`, `npm`, `pnpm`, `yarn`):

```bash
bun install mikrob
```

Create `index.ts` in root of your project and paste:

```ts
import { serveStatic } from 'hono/bun' // Bun
import { serveStatic } from 'hono/deno' // Deno
import { serveStatic } from '@hono/node-server/serve-static' // Node
import { mikrob } from 'mikrob'

export default await mikrob({ serveStatic })
```

Then start the server:

```bash
bun run index.ts
```

When opened in the browser, it will automatically detect and serve corresponding page:

- _/pages/index.ts_ → localhost:3000,
- _/pages/about.ts_ → localhost:3000/about.

## Pages

Mikrob uses a file-based routing system similar to Next.js and Astro. Pages are automatically rendered from files in your `pages` directory, supporting multiple formats:

- **JSON** - For static content,
- **TS/TSX** - For dynamic content and data fetching,
- **Markdown** (WIP) - For content-rich pages and blog posts.

_index.{json,ts,tsx,md}_ files receive special treatment by stripping away the "index" segment from the path.

| File                               | Address           |
| ---------------------------------- | ----------------- |
| _/pages/blog/hello-world.json_     | /blog/hello-world |
| _/pages/blog/hello-world/index.ts_ | /blog/hello-world |
| _/pages/blog/index.tsx_            | /blog             |
| _/pages/blog/index/index.md_       | /blog             |

When Mikrob finds the file for a requested path, it will read its contents and pass this data to the defined `view` template.

Page data is accessible in views as a prop passed to the component (more on that in the [Views](#views) section). If the page file contains the `description` property, it will be accessible as `props.page.description`.

You can use three file types to define pages:

### JSON

```json
{
  "view": "templates/Product.tsx",
  "title": "Vacuum-o-matic 2000",
  "description": "Lorem ipsum dolor zamęt.",
  "tags": ["hobby", "travel", "music"]
}
```

### TS/TSX

This type is useful for making some calculations or data fetching before returning the data to view. JS/JSX files can also be used.

```ts
const posts = [ … ]

export default {
  view: 'Index.tsx',
  title: 'Hello world!',
  date: '2019-03-07',
  posts,
}
```

### Markdown (WIP)

Each _\*.md_ file should consist of two parts: the front matter (in JSON format) and the page body written in Markdown. This structure is designed for content-heavy pages and blog posts. The Markdown section will be accessible in view as `props.page.body`.

```md
---
{
  "view": "post",
  "title": "My first post",
  "published": "2022-10-20"
}
---

This is the content of my **first post**. It's nice.
```

**Note:** Mikrob uses JSON instead of YAML for the front matter to reduce the number of dependencies required by the package. YAML needs an additional package for reading, while JSON is natively supported (duh).

### Custom page order and path

Pages are loaded in alphabetical order based on their path and file name.

To customize the order, prefix the directory and file names with a number or timestamp. For example:

```
pages/
└── blog/
    ├── 01-uno.md
    └── 02-dos.md
```

This prefix becomes part of the URL: _blog/01-uno.md_ would be accessible as /blog/01-uno.

To keep the URLs clean, you can overwrite the autogenerated path using the `path` property.

```json
{
  "path": "/blog/uno"
}
```

### Path parameters

Mikrob uses Hono under the hood, so any path format supported by Hono is possible. You can use named parameters, regex, wildcards. [See Hono documentation](https://hono.dev/docs/api/routing) for more details.

As an example, you can configure a path parameter for news pagination like this:

```json
{
  "view": "templates/news",
  "path": "/news/:page{[0-9]+}"
}
```

In this example, the numerical page information from the URL is captured and assigned to the `page` parameter. When you open the `/news/2` URL, the "2" will be accessible through `params.context.req.param().page`.

### Wildcard pages

You can create a single page to respond to multiple paths.

The "not found" error page is a good example. To handle all requests for non-existent pages with a custom 404 error page, create a JSON file at _/pages/404.json_ with the following contents:

```json
{
  "view": "templates/404",
  "path": "*",
}
```

### HTTP status

Sometimes, you may want to inform web browsers or search engines about a page's specific status.

For example, when showing a "not found" page, you can send a 404 status code by setting the `status` property to 404. This action will automatically transmit the status code to the browser.

```json
{
  "view": "templates/404",
  "path": "*",
  "status": 404,
}
```

### Redirections

You can create a page that redirects to another location by using the `redirect` property. This property specifies the URL to which you want to redirect. You can use it alongside the `status` property to create a permanent redirect that, for example, returns a 301 HTTP code.

```json
{
  "redirect": "http://domain.com",
  "status": 301
}
```

## Views

Mikrob leverages React components as view templates, providing a familiar and powerful way to structure the UI. Views are stored in the `views` directory and can access page data through props.

View Requirements:
1. File Type: Must be JavaScript/TypeScript (.js, .jsx, .ts, or .tsx),
1. Default Export: Must have a single default export,
1. Component Type: Must export a function component.

Each view component receives a standardized set of props through the `PageView` type:
- `context`: Hono's Context object,
- `pages`: Array of all registered pages,
- `page`: Current page data with its properties.

Example:

```json
{
  "view": "templates/Post.tsx",
  "title": "Hello",
  "content": "Lorem ipsum…",
}
```

Corresponding view component:

```tsx
import type { PageView } from 'mikrob'

const Post: PageView = ({ context, pages, page }) => {
  return (
    <article>
      <h1>{page.title}</h1>
      <div>{page.content}</div>
    </article>
  )
}

export default Post
```

## Configuration

Mikrob follows a convention-over-configuration approach but allows customizing the location of key directories through options passed to `mikrob({ … })` function.

```typescript
import { mikrob } from 'mikrob'

const app = await mikrob({
  pagesDir: 'src/pages',
  viewsDir: 'src/components',
  staticDir: 'public'
})
```

| Directory   | Default   | Purpose                                      |
|-------------|-----------|----------------------------------------------|
| `pagesDir`  | `/pages`  | Contains page files that define routes.      |
| `viewsDir`  | `/views`  | Stores React components used as templates.   |
| `staticDir` | `/static` | Houses static assets (images, styles, etc.)  |

**Best Practice**: While you can customize directory locations, it's recommended to stick with the defaults unless you have a specific reason to change them (e.g., integrating with an existing project structure).
