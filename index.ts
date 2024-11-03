import { existsSync, readdirSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { type Context, type Handler, Hono } from 'hono'
import type { serveStatic as serveStaticBun } from 'hono/bun'
import type { serveStatic as serveStaticDeno } from 'hono/deno'
import type { FC } from 'hono/jsx'
import { jsxRenderer } from 'hono/jsx-renderer'
import type { RedirectStatusCode, StatusCode } from 'hono/utils/http-status'
import locale from './locale.json' with { type: 'json' }

export const pageFileRegex = /\.(js|jsx|ts|tsx|json|md)$/
export const jsTsFileRegex = /\.(js|jsx|ts|tsx)$/

export type MikrobOptions = {
  serveStatic?: typeof serveStaticBun | typeof serveStaticDeno
  parseMarkdown?: (markdown: string) => string
  staticDir?: string
  pagesDir?: string
  viewsDir?: string
}

export type PageDefinition = {
  path?: string
  status?: StatusCode
  view?: string
  redirect?: string
  [key: string]: unknown
}

export type PageData = PageDefinition & {
  file: string
  path: string
}

export type PageList = Array<PageData>

export type PageView = FC<{
  context: Context
  pages: PageList
  page: PageData
}>

export const showWarn = (file: string | undefined, error: unknown): undefined => {
  const message = error instanceof Error ? error.stack : `${error}`
  console.warn('🦠', `[${file}]`, message)
}

export const cleanPath = (path: string): string => {
  return path
    .replace(pageFileRegex, '')
    .replace(/^index$/, '')
    .replace(/(?:\/index)*\/*$/, '')
    .replace(/^\/+/, '/')
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

export const loadPage = async (
  fileName: string,
  pagesDir: string,
  viewsDir: string,
): Promise<PageData | undefined> => {
  const filePath = join(pagesDir, fileName)
  let pageData: PageData | undefined = undefined

  if (isValidFile(filePath, jsTsFileRegex)) {
    pageData = await loadModule<PageData>(filePath)
  }

  if (isValidFile(filePath, /\.json$/)) {
    pageData = await loadModule<PageData>(filePath, { asJson: true })
  }

  // TODO: Implement Markdown support using Marked (?).

  if (pageData) {
    return {
      ...pageData,
      file: filePath,
      path: cleanPath(pageData.path || fileName),
      view: pageData.view && join(viewsDir, pageData.view),
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

    try {
      return await context.render(pageView({ context, pages: pageList, page: pageData }) || '')
    } catch (errorOrResponse) {
      if (errorOrResponse instanceof Response) {
        return errorOrResponse
      }

      throw errorOrResponse
    }
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

export const mikrob = async (options: MikrobOptions = {}) => {
  const app = new Hono()

  const staticDir = resolve(process.cwd(), options.staticDir || 'static')
  const pagesDir = resolve(process.cwd(), options.pagesDir || 'pages')
  const viewsDir = resolve(process.cwd(), options.viewsDir || 'views')

  if (options.serveStatic) {
    app.use('*', options.serveStatic({ root: staticDir }))
  }

  app.use('*', jsxRenderer())

  await createPages(app, await loadPages(pagesDir, viewsDir))

  return app
}
