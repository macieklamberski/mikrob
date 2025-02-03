import { watch, existsSync, readdirSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { execArgv, cwd } from 'node:process'
import { type Context, type Handler, Hono } from 'hono'
import type { serveStatic as serveStaticBun } from 'hono/bun'
import type { FC } from 'hono/jsx'
import { jsxRenderer } from 'hono/jsx-renderer'
import type { RedirectStatusCode, StatusCode } from 'hono/utils/http-status'
import { marked } from 'marked'
import locale from './locale.json' with { type: 'json' }

export const pageFileRegex = /\.(js|jsx|ts|tsx|json|md)$/i
export const jsTsFileRegex = /\.(js|jsx|ts|tsx)$/i

export type MikrobOptions = {
  serveStatic?: typeof serveStaticBun
  staticDir?: string
  pagesDir?: string
  viewsDir?: string
}

export type PageDefinition = {
  path?: string
  status?: StatusCode
  view?: string
  redirect?: string
  // biome-ignore lint/suspicious/noExplicitAny: Page definition can contain any custom data.
  [key: string]: any
}

export type PageData = PageDefinition & {
  file: string
  path: string
}

export type PageList = Array<PageData>

export type PageView = (props: {
  context: Context
  pages: PageList
  page: PageData
}) => Response | ReturnType<FC>

export const showWarn = (file: string | undefined, error: unknown): undefined => {
  const message = error instanceof Error ? error.stack : `${error}`
  console.warn('🦠', `[${file}]`, message)
}

export const cleanPath = (path: string): string => {
  return path
    .replace(pageFileRegex, '')
    .replace(/^(?!\/)/, '/')
    .replace(/\/+/g, '/')
    .replace(/\/index(?:\/index)*/, '')
    .replace(/^\/index$/, '/')
    .replace(/\/+$/, '')
    .replace(/^$/, '/')
}

export const isValidFile = (filePath: string, fileRegex: RegExp): boolean => {
  return existsSync(filePath) && statSync(filePath).isFile() && fileRegex.test(filePath)
}

export const loadModule = async <T>(
  filePath: string,
  { asJson }: { asJson?: boolean } = {},
): Promise<T | undefined> => {
  try {
    return (await import(filePath, asJson ? { with: { type: 'json' } } : undefined)).default
  } catch (error) {
    showWarn(filePath, error)
  }
}

export const loadMarkdown = async (filePath: string): Promise<PageDefinition | undefined> => {
  try {
    const file = (await import(filePath, { with: { type: 'text' } })).default
    const match = file.match(/^---\n(.*?)\n---\n(.*)/s)

    if (!match) {
      return showWarn(filePath, locale.markdownNotCorrectFormat)
    }

    return {
      ...JSON.parse(match[1]),
      body: marked(match[2]),
    }
  } catch (error) {
    showWarn(filePath, error)
  }
}

export const loadPage = async (
  fileName: string,
  pagesDir: string,
  viewsDir: string,
): Promise<PageData | undefined> => {
  const filePath = join(pagesDir, fileName)
  let pageDefinition: PageDefinition | undefined = undefined

  if (isValidFile(filePath, jsTsFileRegex)) {
    pageDefinition = await loadModule<PageDefinition>(filePath)
  }

  if (isValidFile(filePath, /\.json$/i)) {
    pageDefinition = await loadModule<PageDefinition>(filePath, { asJson: true })
  }

  if (isValidFile(filePath, /\.md/i)) {
    pageDefinition = await loadMarkdown(filePath)
  }

  if (pageDefinition) {
    return {
      ...pageDefinition,
      file: filePath,
      path: cleanPath(pageDefinition.path || fileName),
      view: pageDefinition.view && join(viewsDir, pageDefinition.view),
    }
  }
}

export const loadPages = async (pagesDir: string, viewsDir: string): Promise<PageList> => {
  const pageList: PageList = []
  const fileList = existsSync(pagesDir) ? readdirSync(pagesDir, { recursive: true }) : []

  for (const fileName of fileList.map(String)) {
    const pageData = await loadPage(fileName, pagesDir, viewsDir)

    if (pageData) {
      pageList.push(pageData)
    }
  }

  return pageList.sort((pageA, pageB) => {
    const pathDepthA = pageA.file.split('/').length
    const pathDepthB = pageB.file.split('/').length

    if (pathDepthA !== pathDepthB) {
      return pathDepthB - pathDepthA
    }

    return pageA.file.localeCompare(pageB.file)
  })
}

export const loadView = async (pageData: PageData): Promise<PageView | undefined> => {
  const { view, file } = pageData

  if (!view) {
    return showWarn(file, locale.noViewDefined)
  }

  if (!isValidFile(view, jsTsFileRegex)) {
    return showWarn(view, locale.viewNotFoundOrNotSupported)
  }

  const pageView = await loadModule<PageView>(view)

  if (typeof pageView !== 'function') {
    return showWarn(pageData.view, locale.noDefaultExport)
  }

  return pageView
}

export const createPage = async (
  { redirect, ...pageData }: PageData,
  pageList: PageList,
): Promise<Handler | undefined> => {
  if (redirect) {
    return async (context) => context.redirect(redirect, pageData.status as RedirectStatusCode)
  }

  const pageView = await loadView(pageData)

  if (!pageView) {
    return
  }

  return async (context) => {
    if (pageData.status) {
      context.status(pageData.status)
    }

    const page = await pageView({ context, pages: pageList, page: pageData })

    return page instanceof Response ? page : context.render(page || '')
  }
}

export const createPages = async (app: Hono, pageList: PageList): Promise<void> => {
  for (const pageData of pageList) {
    const pageHandler = await createPage(pageData, pageList)

    if (pageHandler) {
      app.get(pageData.path, pageHandler)
    }
  }
}

export const createApp = async (options: MikrobOptions = {}): Promise<Hono> => {
  const staticDir = resolve(cwd(), options.staticDir || 'static')
  const pagesDir = resolve(cwd(), options.pagesDir || 'pages')
  const viewsDir = resolve(cwd(), options.viewsDir || 'views')

  const app = new Hono()

  if (options.serveStatic) {
    app.use('*', options.serveStatic({ root: staticDir }))
  }

  app.use('*', jsxRenderer())

  await createPages(app, await loadPages(pagesDir, viewsDir))

  return app
}

export const mikrob = async (options: MikrobOptions = {}) => {
  let app = await createApp(options)

  if (execArgv.includes('--watch')) {
    watch(cwd(), { recursive: true }, async () => {
      app = await createApp(options)
    })
  }

  return app
}
