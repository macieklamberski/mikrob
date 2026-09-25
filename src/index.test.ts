import { afterEach, beforeEach, describe, expect, it, mock, spyOn } from 'bun:test'
import { watch } from 'node:fs'
import path, { join } from 'node:path'
import { execArgv } from 'node:process'
import { Context, Hono } from 'hono'
import type { StatusCode } from 'hono/utils/http-status'
import {
  cleanPath,
  createPage,
  createPages,
  createServer,
  isValidFile,
  loadMarkdown,
  loadModule,
  loadPage,
  loadPages,
  loadView,
  mikrob,
  type PageData,
  type PageList,
  pageFileRegex,
  showWarn,
} from './index'
import locale from './locale.json' with { type: 'json' }

const staticDir = path.resolve('src/mocks/static')
const pagesDir = path.resolve('src/mocks/pages')
const viewsDir = path.resolve('src/mocks/views')

const realWarn = console.warn
let mockWarn: ReturnType<typeof mock>

beforeEach(() => {
  mockWarn = mock()
  console.warn = mockWarn
})

afterEach(() => {
  console.warn = realWarn
})

describe('showWarn', () => {
  it('should format warning messages', () => {
    showWarn('test.tsx', new Error('Test error'))
    showWarn('pages/test.tsx', 'Invalid file')

    expect(mockWarn).toHaveBeenCalledTimes(2)
    expect(mockWarn).toHaveBeenCalledWith('🦠', '[test.tsx]', expect.stringContaining('Test error'))
    expect(mockWarn).toHaveBeenCalledWith('🦠', '[pages/test.tsx]', 'Invalid file')
  })
})

describe('isValidFile', () => {
  it('should return true for valid file', () => {
    const pagePath = path.join(pagesDir, 'valid-1.tsx')
    expect(isValidFile(pagePath, pageFileRegex)).toBe(true)
  })

  it('should return false for invalid file', () => {
    const pagePath = path.join(pagesDir, 'invalid-3.txt')
    expect(isValidFile(pagePath, pageFileRegex)).toBe(false)
  })

  it('should return false for non-existent file', () => {
    const pagePath = path.join(pagesDir, 'nonexistent.file')
    expect(isValidFile(pagePath, pageFileRegex)).toBe(false)
  })
})

describe('loadModule', () => {
  it('should load valid JS/TS module with default export', async () => {
    const result = await loadModule<() => string>(join(viewsDir, 'Empty.tsx'))

    expect(result).toBeDefined()
    expect(typeof result).toBe('function')
    expect(result?.()).toBeNull()
  })

  it('should return undefined for non-existent file', async () => {
    const viewPath = join(viewsDir, 'NonExistent.tsx')
    const result = await loadModule(viewPath)

    expect(result).toBeUndefined()
    expect(mockWarn).toHaveBeenCalledWith(
      '🦠',
      `[${viewPath}]`,
      expect.stringContaining('ResolveMessage'),
    )
  })

  it('should return undefined for file without default export', async () => {
    const viewPath = join(viewsDir, 'NoDefault.tsx')
    const result = await loadModule(viewPath)

    expect(result).toBeUndefined()
  })

  it('should return undefined for file with syntax error', async () => {
    const viewPath = join(viewsDir, 'InvalidSyntax.tsx')
    const result = await loadModule(viewPath)

    expect(result).toBeUndefined()
    expect(mockWarn).toHaveBeenCalledWith(
      '🦠',
      `[${viewPath}]`,
      expect.stringContaining('BuildMessage'),
    )
  })

  it('should load module with async default export', async () => {
    const viewPath = join(viewsDir, 'Async.tsx')
    const result = await loadModule<() => Promise<string>>(viewPath)

    expect(result).toBeDefined()
    expect(typeof result).toBe('function')
    expect(await result?.()).toBe('Hello async!')
  })

  it('should load valid JSON file', async () => {
    const pagePath = join(pagesDir, 'valid-5.json')
    const content = await loadModule(pagePath, { asJson: true })

    expect(content).toBeDefined()
    expect(typeof content).toBe('object')
    expect(content).toEqual({
      view: 'Test.tsx',
      path: 'something',
      status: 201,
    })
  })

  it('should handle invalid JSON format', async () => {
    const pagePath = join(pagesDir, 'invalid-5.json')
    const content = await loadModule(pagePath, { asJson: true })

    expect(content).toBeUndefined()
    expect(mockWarn).toHaveBeenCalledWith(
      '🦠',
      `[${pagePath}]`,
      expect.stringContaining('SyntaxError'),
    )
  })

  it('should handle empty JSON files', async () => {
    const pagePath = join(pagesDir, 'invalid-6.json')
    const content = await loadModule(pagePath, { asJson: true })

    expect(content).toBeUndefined()
    expect(mockWarn).toHaveBeenCalledWith(
      '🦠',
      `[${pagePath}]`,
      expect.stringContaining('SyntaxError'),
    )
  })
})

describe('loadMarkdown', () => {
  it('should handle markdown file with front matter', async () => {
    const pagePath = join(pagesDir, 'valid-6.md')
    const result = await loadMarkdown(pagePath)

    expect(result).toEqual({
      view: 'Post.tsx',
      title: 'Test Post',
      body: '# Hello World\n\nThis is a test post.\n',
    })
  })

  it('should handle invalid front matter JSON', async () => {
    const pagePath = join(pagesDir, 'invalid-7.md')
    const result = await loadMarkdown(pagePath)

    expect(result).toBeUndefined()
    expect(mockWarn).toHaveBeenCalledWith(
      '🦠',
      `[${pagePath}]`,
      expect.stringContaining('SyntaxError'),
    )
  })

  it('should handle missing front matter delimiters', async () => {
    const pagePath = join(pagesDir, 'invalid-8.md')
    const result = await loadMarkdown(pagePath)

    expect(result).toBeUndefined()
    expect(mockWarn).toHaveBeenCalledWith('🦠', `[${pagePath}]`, locale.markdownNotCorrectFormat)
  })

  it('should handle file read errors', async () => {
    const pagePath = join(pagesDir, 'non-existent.md')
    const result = await loadMarkdown(pagePath)

    expect(result).toBeUndefined()
    expect(mockWarn).toHaveBeenCalledWith(
      '🦠',
      `[${pagePath}]`,
      expect.stringContaining('ResolveMessage'),
    )
  })
})

describe('cleanPath', () => {
  it('should remove file extensions', () => {
    expect(cleanPath('/page.tsx')).toBe('/page')
  })

  it('should handle root path correctly', () => {
    expect(cleanPath('/index.ts')).toBe('/')
  })

  it('should remove nested index paths', () => {
    expect(cleanPath('/blog/index/index.tsx')).toBe('/blog')
  })

  it('should normalize multiple slashes', () => {
    expect(cleanPath('//about//')).toBe('/about')
  })

  it('should add slash at the beginning when not present', () => {
    expect(cleanPath('about')).toBe('/about')
  })

  it('should handle edge cases', () => {
    expect(cleanPath('')).toBe('/')
    expect(cleanPath('index.tsx')).toBe('/')
    expect(cleanPath('/index')).toBe('/')
  })
})

describe('loadPage', () => {
  it('should process valid TSX page with extra params', async () => {
    const page = await loadPage('valid-1.tsx', pagesDir, viewsDir)

    expect(page).toEqual({
      file: join(pagesDir, 'valid-1.tsx'),
      view: join(viewsDir, 'Test.tsx'),
      path: '/valid-1',
      name: 'Test',
    })
  })

  it('should process valid TS page with explicit path', async () => {
    const page = await loadPage('valid-2.ts', pagesDir, viewsDir)

    expect(page).toEqual({
      file: join(pagesDir, 'valid-2.ts'),
      view: join(viewsDir, 'Test.tsx'),
      path: '/test',
    })
  })

  it('should process valid JSX page with redirect and status', async () => {
    const page = await loadPage('valid-3.jsx', pagesDir, viewsDir)

    expect(page).toEqual({
      file: join(pagesDir, 'valid-3.jsx'),
      path: '/valid-3',
      redirect: 'https://domain.com',
      status: 301,
    })
  })

  it('should process valid JS page with view and status', async () => {
    const page = await loadPage('valid-7.js', pagesDir, viewsDir)

    expect(page).toEqual({
      file: join(pagesDir, 'valid-7.js'),
      view: join(viewsDir, 'Test.tsx'),
      path: '/*',
      status: 201,
    })
  })

  it('should process valid nested page with view and status', async () => {
    const page = await loadPage('nested/valid.ts', pagesDir, viewsDir)

    expect(page).toEqual({
      file: join(pagesDir, 'nested/valid.ts'),
      view: join(viewsDir, 'Test.tsx'),
      path: '/nested/valid',
    })
  })

  it('should process valid JSON page with path', async () => {
    const page = await loadPage('valid-5.json', pagesDir, viewsDir)

    expect(page).toEqual({
      file: join(pagesDir, 'valid-5.json'),
      view: join(viewsDir, 'Test.tsx'),
      path: '/something',
      status: 201,
    })
  })

  it('should process page with non-existent view', async () => {
    const page = await loadPage('invalid-2.tsx', pagesDir, viewsDir)

    expect(page).toEqual({
      view: join(viewsDir, 'NonExistent.tsx'),
      file: join(pagesDir, 'invalid-2.tsx'),
      path: '/invalid-2',
    })
  })

  it('should discard empty page file', async () => {
    const page = await loadPage('invalid-1.tsx', pagesDir, viewsDir)

    expect(page).toBeUndefined()
  })

  it('should discard unsupported page file', async () => {
    const page = await loadPage('invalid-3.tsx', pagesDir, viewsDir)

    expect(page).toBeUndefined()
  })
})

describe('loadPages', async () => {
  const pages = await loadPages(pagesDir, viewsDir)

  it('should load correct number of pages', () => {
    expect(pages.length).toEqual(10)
  })

  it('should load pages in correct order', () => {
    const order = [
      'nested/valid.ts',
      'invalid-2.tsx',
      'invalid-4.tsx',
      'valid-1.tsx',
      'valid-2.ts',
      'valid-3.jsx',
      'valid-4.js',
      'valid-5.json',
      'valid-6.md',
      'valid-7.js',
    ]

    for (let i = 0; i < order.length; ++i) {
      expect(pages[i].file).toBe(join(pagesDir, order[i]))
    }
  })
})

describe('loadView', () => {
  it('should load valid view component', async () => {
    const pageData = {
      file: join(pagesDir, 'valid-1.tsx'),
      view: join(viewsDir, 'Test.tsx'),
      path: '/test',
    }
    const view = await loadView(pageData)

    expect(typeof view).toBe('function')
  })

  it('should warn when view is not defined', async () => {
    const page = {
      file: join(pagesDir, 'test.tsx'),
      path: '/test',
    }
    const view = await loadView(page)

    expect(view).toBeUndefined()
    expect(mockWarn).toHaveBeenCalledWith('🦠', `[${page.file}]`, locale.noViewDefined)
  })

  it('should warn when view file does not exist', async () => {
    const pageData = {
      file: join(pagesDir, 'test.tsx'),
      view: join(viewsDir, 'NonExistent.tsx'),
      path: '/test',
    }
    const view = await loadView(pageData)

    expect(view).toBeUndefined()
    expect(mockWarn).toHaveBeenCalledWith(
      '🦠',
      `[${pageData.view}]`,
      locale.viewNotFoundOrNotSupported,
    )
  })

  it('should warn when view file has invalid extension', async () => {
    const pageData = {
      file: join(pagesDir, 'test.tsx'),
      view: join(viewsDir, 'test.txt'),
      path: '/test',
    }
    const view = await loadView(pageData)

    expect(view).toBeUndefined()
    expect(mockWarn).toHaveBeenCalledWith(
      '🦠',
      `[${pageData.view}]`,
      locale.viewNotFoundOrNotSupported,
    )
  })

  it('should warn when view has no default export', async () => {
    const pageData = {
      file: join(pagesDir, 'test.tsx'),
      view: join(viewsDir, 'NoDefault.tsx'),
      path: '/test',
    }
    const view = await loadView(pageData)

    expect(view).toBeUndefined()
    expect(mockWarn).toHaveBeenCalledWith('🦠', `[${pageData.view}]`, locale.noDefaultExport)
  })

  it('should warn when default export is not a function', async () => {
    const pageData = {
      file: join(pagesDir, 'test.tsx'),
      view: join(viewsDir, 'NoFunction.tsx'),
      path: '/test',
    }
    const view = await loadView(pageData)

    expect(view).toBeUndefined()
    expect(mockWarn).toHaveBeenCalledWith('🦠', `[${pageData.view}]`, locale.noDefaultExport)
  })

  it('should return undefined when import fails', async () => {
    const pageData = {
      file: join(pagesDir, 'test.tsx'),
      view: join(viewsDir, 'InvalidSyntax.tsx'),
      path: '/test',
    }
    const view = await loadView(pageData)

    expect(view).toBeUndefined()
    expect(mockWarn).toHaveBeenCalledWith(
      '🦠',
      `[${pageData.view}]`,
      expect.stringContaining('BuildMessage'),
    )
  })

  it('should handle async view components', async () => {
    const pageData = {
      file: join(pagesDir, 'test.tsx'),
      view: join(viewsDir, 'Async.tsx'),
      path: '/test',
    }
    const view = await loadView(pageData)

    expect(typeof view).toBe('function')
  })
})

describe('createPage', () => {
  it('should create redirect handler', async () => {
    const context = new Context(new Request('https://example.com/test'))
    const redirect = spyOn(context, 'redirect')
    const pageData = {
      file: join(viewsDir, 'redirect.tsx'),
      path: '/old',
      redirect: '/new',
      status: 301 as StatusCode,
    }
    const handler = await createPage(pageData, [])

    await handler?.(context, async () => {})

    expect(handler).toBeDefined()
    expect(redirect).toHaveBeenCalledWith(pageData.redirect, pageData.status)
  })

  it('should not create handler when the view is not defined', async () => {
    const pageData = {
      file: join(viewsDir, 'test.tsx'),
      path: '/test',
    }
    const handler = await createPage(pageData, [])

    expect(handler).toBeUndefined()
  })

  it('should not create handler when the view is invalid', async () => {
    const pageData = {
      file: join(viewsDir, 'test.tsx'),
      view: join(viewsDir, 'NoDefault.tsx'),
      path: '/test',
    }
    const handler = await createPage(pageData, [])

    expect(handler).toBeUndefined()
  })

  it('should not create handler when the view is non-existent', async () => {
    const pageData = {
      file: join(viewsDir, 'test.tsx'),
      view: join(viewsDir, 'NonExistent.tsx'),
      path: '/test',
    }
    const handler = await createPage(pageData, [])

    expect(handler).toBeUndefined()
  })

  it('should create handler with status code', async () => {
    const context = new Context(new Request('https://example.com/test'))
    const status = spyOn(context, 'status')
    const pageData = {
      file: join(viewsDir, 'test.tsx'),
      view: join(viewsDir, 'Test.tsx'),
      path: '/test',
      status: 201 as StatusCode,
    }
    const handler = await createPage(pageData, [])

    await handler?.(context, async () => {})

    expect(handler).toBeDefined()
    expect(status).toHaveBeenCalledWith(201)
  })

  it('should handle Response return from view', async () => {
    const context = new Context(new Request('https://example.com/test'))
    const pageData = {
      file: join(pagesDir, 'response.tsx'),
      view: join(viewsDir, 'Response.tsx'),
      path: '/test',
    }
    const handler = await createPage(pageData, [])
    const response = await handler?.(context, async () => {})

    expect(handler).toBeDefined()
    expect(response).toBeInstanceOf(Response)
  })

  it('should throw non-Response errors', async () => {
    const testError = new Error('Test error')
    const context = new Context(new Request('https://example.com/test'))
    const pageData = {
      file: join(pagesDir, 'test.tsx'),
      view: join(viewsDir, 'Test.tsx'),
      path: '/test',
    }

    spyOn(context, 'render').mockImplementation(() => {
      throw testError
    })

    const handler = await createPage(pageData, [])
    const response = handler?.(context, async () => {})

    expect(handler).toBeDefined()
    expect(response).rejects.toThrow(testError)
  })

  it('should pass correct data to view component', async () => {
    const mockView = mock()
    const mockViewModule = () => ({ default: mockView })
    const context = new Context(new Request('https://example.com/test'))
    const pageViewPath = join(viewsDir, 'Mock.tsx')
    const pageData: PageData = {
      file: join(pagesDir, 'valid-1.tsx'),
      view: pageViewPath,
      path: '/test',
    }
    const pageList: PageList = [pageData]

    mock.module(pageViewPath, mockViewModule)

    const handler = await createPage(pageData, pageList)

    await handler?.(context, async () => {})

    expect(handler).toBeDefined()
    expect(mockView).toHaveBeenCalledWith({
      context,
      pages: pageList,
      page: pageData,
    })
  })

  it('should handle empty view response', async () => {
    const context = new Context(new Request('https://example.com/test'))
    const render = spyOn(context, 'render')
    const pageData = {
      file: join(pagesDir, 'test.tsx'),
      view: join(viewsDir, 'Empty.tsx'),
      path: '/test',
    }
    const handler = await createPage(pageData, [])

    await handler?.(context, async () => {})

    expect(handler).toBeDefined()
    expect(render).toHaveBeenCalledWith('')
  })
})

describe('createPages', () => {
  it('should register all valid pages', async () => {
    const app = new Hono()
    const pages = await loadPages(pagesDir, viewsDir)

    await createPages(app, pages)

    expect(app.routes.length).toEqual(7)
  })

  it('should register pages in correct order', async () => {
    const app = new Hono()
    const pages = await loadPages(pagesDir, viewsDir)
    const order = ['/nested/valid', '/valid-1', '/test', '/valid-3', '/valid-4', '/something', '/*']

    await createPages(app, pages)

    for (let i = 0; i < order.length; ++i) {
      expect(app.routes[i].path).toBe(order[i])
    }
  })
})

describe('createServer', () => {
  it('should initialize application with default directories', async () => {
    const app = await createServer()

    expect(app.routes.length).toBe(2)
  })

  it('should handle non-existent directories', async () => {
    const app = await createServer({
      staticDir: 'non-existent',
      pagesDir: 'non-existent',
      viewsDir: 'non-existent',
    })

    expect(app.routes.length).toBe(2)
  })

  it('should initialize application with custom directories', async () => {
    const app = await createServer({ staticDir, pagesDir, viewsDir })

    expect(app.routes.length).toBe(9)
  })

  it('should register routes from pages', async () => {
    const app = await createServer({ staticDir, pagesDir, viewsDir })
    const registeredPaths = app.routes.map((route) => route.path)

    expect(registeredPaths).toContain('/test')
    expect(registeredPaths).toContain('/valid-1')
  })

  it('should handle request to existing page', async () => {
    const app = await createServer({ staticDir, pagesDir, viewsDir })

    const request = new Request('http://localhost/valid-1', {
      headers: { Accept: 'text/html', 'Content-Type': 'text/html' },
    })

    const response = await app.fetch(request)
    const text = await response.text()

    expect(response.status).toBe(200)
    expect(text).toContain('Hello Test!')
  })

  it('should handle request to non-existent page', async () => {
    const app = await createServer()
    const response = await app.request('/non-existent')

    expect(response.status).toBe(404)
  })

  it('should handle redirect pages', async () => {
    const app = await createServer({ staticDir, pagesDir, viewsDir })
    const response = await app.request('/valid-3')

    expect(response.status).toBe(301)
    expect(response.headers.get('Location')).toBe('https://domain.com')
  })

  it('should handle pages with custom status codes', async () => {
    const app = await createServer({ staticDir, pagesDir, viewsDir })
    const response = await app.request('/valid-7')

    expect(response.status).toBe(201)
  })

  it('should handle pages with custom Response', async () => {
    const app = await createServer({ staticDir, pagesDir, viewsDir })
    const response = await app.request('/valid-4')

    expect(await response.text()).toBe('Not authorized')
    expect(response.status).toBe(403)
  })

  it('should apply JSX renderer middleware', async () => {
    const app = await createServer({ staticDir, pagesDir, viewsDir })
    const response = await app.request('/valid-1')

    expect(response.headers.get('Content-Type')).toContain('text/html')
  })
})

describe('mikrob', () => {
  it('should not reinitialize application on file change when not in watch mode', async () => {
    const mockWatch = mock(watch)

    mock.module('node:fs', () => ({ watch: mockWatch }))
    await mikrob()

    expect(mockWatch).not.toHaveBeenCalled()
  })

  it('should reinitialize application on file change in watch mode', async () => {
    const mockWatch = mock(watch)

    mock.module('node:fs', () => ({ watch: mockWatch }))
    execArgv.push('--watch')
    await mikrob()
    execArgv.pop()

    expect(mockWatch).toHaveBeenCalled()
  })
})
