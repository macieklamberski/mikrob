import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test'
import path, { join } from 'node:path'
import { type Context, Hono } from 'hono'
import type { serveStatic as serveStaticBun } from 'hono/bun'
import type { RedirectStatusCode, StatusCode } from 'hono/utils/http-status'
import {
  type PageData,
  type PageList,
  cleanPath,
  createPage,
  createPages,
  isValidFile,
  loadModule,
  loadPage,
  loadPages,
  loadView,
  mikrob,
  pageFileRegex,
  showWarn,
} from './index'
import locale from './locale.json' assert { type: 'json' }

const staticDir = path.resolve('mocks/static')
const pagesDir = path.resolve('mocks/pages')
const viewsDir = path.resolve('mocks/views')

const expectMockWarnToHaveBeenCalledWith = (file: string, message: string) => {
  expect(mockWarn).toHaveBeenCalledWith('🦠', `[${file}]`, message)
}

let realWarn: typeof console.warn
let mockWarn: ReturnType<typeof mock>

beforeEach(() => {
  mockWarn = mock()
  console.warn = mockWarn
})

afterEach(() => {
  console.warn = realWarn
})

describe('showWarn', () => {
  test('formats warning messages', () => {
    showWarn('test.tsx', new Error('Test error'))
    showWarn('pages/test.tsx', 'Invalid file')

    expect(mockWarn).toHaveBeenCalledTimes(2)
    expectMockWarnToHaveBeenCalledWith('test.tsx', expect.stringContaining('Test error'))
    expectMockWarnToHaveBeenCalledWith('pages/test.tsx', 'Invalid file')
  })
})

describe('isValidFile', () => {
  test('checks valid file', () => {
    const pagePath = path.join(pagesDir, 'valid-1.tsx')
    expect(isValidFile(pagePath, pageFileRegex)).toBe(true)
  })

  test('checks invalid file', () => {
    const pagePath = path.join(pagesDir, 'invalid-3.txt')
    expect(isValidFile(pagePath, pageFileRegex)).toBe(false)
  })

  test('checks non-existent file', () => {
    const pagePath = path.join(pagesDir, 'nonexistent.file')
    expect(isValidFile(pagePath, pageFileRegex)).toBe(false)
  })
})

describe('loadModule', () => {
  test('loads valid JS/TS module with default export', async () => {
    const result = await loadModule<() => string>(join(viewsDir, 'Empty.tsx'))

    expect(result).toBeDefined()
    expect(typeof result).toBe('function')
    expect(result?.()).toBeNull()
  })

  test('returns undefined for non-existent file', async () => {
    const viewPath = join(viewsDir, 'NonExistent.tsx')
    const result = await loadModule(viewPath)

    expect(result).toBeUndefined()
    expectMockWarnToHaveBeenCalledWith(viewPath, expect.stringContaining('ResolveMessage'))
  })

  test('returns undefined for file without default export', async () => {
    const viewPath = join(viewsDir, 'NoDefault.tsx')
    const result = await loadModule(viewPath)

    expect(result).toBeUndefined()
  })

  test('returns undefined for file with syntax error', async () => {
    const viewPath = join(viewsDir, 'InvalidSyntax.tsx')
    const result = await loadModule(viewPath)

    expect(result).toBeUndefined()
    expectMockWarnToHaveBeenCalledWith(viewPath, expect.stringContaining('BuildMessage'))
  })

  test('loads module with async default export', async () => {
    const viewPath = join(viewsDir, 'Async.tsx')
    const result = await loadModule<() => Promise<string>>(viewPath)

    expect(result).toBeDefined()
    expect(typeof result).toBe('function')
    expect(await result?.()).toBe('Hello async!')
  })

  test('loads valid JSON file', async () => {
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

  test('handles invalid JSON format', async () => {
    const pagePath = join(pagesDir, 'invalid-5.json')
    const content = await loadModule(pagePath, { asJson: true })

    expect(content).toBeUndefined()
    expectMockWarnToHaveBeenCalledWith(pagePath, expect.stringContaining('SyntaxError'))
  })

  test('handles empty JSON files', async () => {
    const pagePath = join(pagesDir, 'invalid-6.json')
    const content = await loadModule(pagePath, { asJson: true })

    expect(content).toBeUndefined()
    expectMockWarnToHaveBeenCalledWith(pagePath, expect.stringContaining('SyntaxError'))
  })
})

describe('cleanPath', () => {
  test('removes file extensions', () => {
    expect(cleanPath('/page.tsx')).toBe('/page')
  })

  test('handles root path correctly', () => {
    expect(cleanPath('/index.ts')).toBe('/')
  })

  test('removes nested index paths', () => {
    expect(cleanPath('/blog/index/index.tsx')).toBe('/blog')
  })

  test('normalizes multiple slashes', () => {
    expect(cleanPath('//about//')).toBe('/about')
  })

  test('handles edge cases', () => {
    expect(cleanPath('')).toBe('/')
    expect(cleanPath('index.tsx')).toBe('/')
    expect(cleanPath('/index')).toBe('/')
  })
})

describe('loadPage', () => {
  test('processes valid TSX page with extra params', async () => {
    const page = await loadPage('valid-1.tsx', pagesDir, viewsDir)

    expect(page).toEqual({
      file: join(pagesDir, 'valid-1.tsx'),
      view: join(viewsDir, 'Test.tsx'),
      path: 'valid-1',
      name: 'Test',
    })
  })

  test('processes valid TS page with explicit path', async () => {
    const page = await loadPage('valid-2.ts', pagesDir, viewsDir)

    expect(page).toEqual({
      file: join(pagesDir, 'valid-2.ts'),
      view: join(viewsDir, 'Test.tsx'),
      path: 'test',
    })
  })

  test('processes valid page JSX with redirect and status', async () => {
    const page = await loadPage('valid-3.jsx', pagesDir, viewsDir)

    expect(page).toEqual({
      file: join(pagesDir, 'valid-3.jsx'),
      path: 'valid-3',
      redirect: 'https://domain.com',
      status: 301,
    })
  })

  test('processes valid JS page with view and status', async () => {
    const page = await loadPage('valid-4.js', pagesDir, viewsDir)

    expect(page).toEqual({
      file: join(pagesDir, 'valid-4.js'),
      view: join(viewsDir, 'Test.tsx'),
      path: '*',
      status: 201,
    })
  })

  test('processes valid nested page with view and status', async () => {
    const page = await loadPage('nested/valid.ts', pagesDir, viewsDir)

    expect(page).toEqual({
      file: join(pagesDir, 'nested/valid.ts'),
      view: join(viewsDir, 'Test.tsx'),
      path: 'nested/valid',
    })
  })

  test('processes valid JSON page with path', async () => {
    const page = await loadPage('valid-5.json', pagesDir, viewsDir)

    expect(page).toEqual({
      file: join(pagesDir, 'valid-5.json'),
      view: join(viewsDir, 'Test.tsx'),
      path: 'something',
      status: 201,
    })
  })

  test('processes page with non-existent view', async () => {
    const page = await loadPage('invalid-2.tsx', pagesDir, viewsDir)

    expect(page).toEqual({
      view: join(viewsDir, 'NonExistent.tsx'),
      file: join(pagesDir, 'invalid-2.tsx'),
      path: 'invalid-2',
    })
  })

  test('discards empty page file', async () => {
    const page = await loadPage('invalid-1.tsx', pagesDir, viewsDir)

    expect(page).toBeUndefined()
  })

  test('discards unsupported page file', async () => {
    const page = await loadPage('invalid-3.tsx', pagesDir, viewsDir)

    expect(page).toBeUndefined()
  })
})

describe('loadPages', async () => {
  const pages = await loadPages(pagesDir, viewsDir)

  test('loads correct number of pages', () => {
    expect(pages.length).toEqual(8)
  })

  test('loads pages in correct order', () => {
    const order = [
      'nested/valid.ts',
      'invalid-2.tsx',
      'invalid-4.tsx',
      'valid-1.tsx',
      'valid-2.ts',
      'valid-3.jsx',
      'valid-4.js',
    ]

    for (let i = 0; i < order.length; ++i) {
      expect(pages[i].file).toBe(join(pagesDir, order[i]))
    }
  })
})

describe('loadView', () => {
  test('loads valid view component', async () => {
    const pageData = {
      file: join(pagesDir, 'valid-1.tsx'),
      view: join(viewsDir, 'Test.tsx'),
      path: '/test',
    }
    const view = await loadView(pageData)

    expect(typeof view).toBe('function')
  })

  test('warns when view is not defined', async () => {
    const page = {
      file: join(pagesDir, 'test.tsx'),
      path: '/test',
    }
    const view = await loadView(page)

    expect(view).toBeUndefined()
    expectMockWarnToHaveBeenCalledWith(page.file, locale.noViewDefined)
  })

  test('warns when view file does not exist', async () => {
    const pageData = {
      file: join(pagesDir, 'test.tsx'),
      view: join(viewsDir, 'NonExistent.tsx'),
      path: '/test',
    }
    const view = await loadView(pageData)

    expect(view).toBeUndefined()
    expectMockWarnToHaveBeenCalledWith(pageData.view, locale.viewNotFoundOrNotSupported)
  })

  test('warns when view file has invalid extension', async () => {
    const pageData = {
      file: join(pagesDir, 'test.tsx'),
      view: join(viewsDir, 'test.txt'),
      path: '/test',
    }
    const view = await loadView(pageData)

    expect(view).toBeUndefined()
    expectMockWarnToHaveBeenCalledWith(pageData.view, locale.viewNotFoundOrNotSupported)
  })

  test('warns when view has no default export', async () => {
    const pageData = {
      file: join(pagesDir, 'test.tsx'),
      view: join(viewsDir, 'NoDefault.tsx'),
      path: '/test',
    }
    const view = await loadView(pageData)

    expect(view).toBeUndefined()
    expectMockWarnToHaveBeenCalledWith(pageData.view, locale.noDefaultExport)
  })

  test('warns when default export is not a function', async () => {
    const pageData = {
      file: join(pagesDir, 'test.tsx'),
      view: join(viewsDir, 'NoFunction.tsx'),
      path: '/test',
    }
    const view = await loadView(pageData)

    expect(view).toBeUndefined()
    expectMockWarnToHaveBeenCalledWith(pageData.view, locale.noDefaultExport)
  })

  test('returns undefined when import fails', async () => {
    const pageData = {
      file: join(pagesDir, 'test.tsx'),
      view: join(viewsDir, 'InvalidSyntax.tsx'),
      path: '/test',
    }
    const view = await loadView(pageData)

    expect(view).toBeUndefined()
    expectMockWarnToHaveBeenCalledWith(pageData.view, expect.stringContaining('BuildMessage'))
  })

  test('handles async view components', async () => {
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
  test('creates redirect handler', async () => {
    const mockContext = { redirect: mock() } as unknown as Context
    const pageData = {
      file: join(viewsDir, 'redirect.tsx'),
      path: '/old',
      redirect: '/new',
      status: 301 as RedirectStatusCode,
    }
    const handler = await createPage(pageData, [])

    await handler?.(mockContext, async () => {})

    expect(handler).toBeDefined()
    expect(mockContext.redirect).toHaveBeenCalledWith(pageData.redirect, pageData.status)
  })

  test('does not create handler when the view is not defined', async () => {
    const pageData = {
      file: join(viewsDir, 'test.tsx'),
      path: '/test',
    }
    const handler = await createPage(pageData, [])

    expect(handler).toBeUndefined()
  })

  test('does not create handler when the view is invalid', async () => {
    const pageData = {
      file: join(viewsDir, 'test.tsx'),
      view: join(viewsDir, 'NoDefault.tsx'),
      path: '/test',
    }
    const handler = await createPage(pageData, [])

    expect(handler).toBeUndefined()
  })

  test('does not create handler when the view is non-existent', async () => {
    const pageData = {
      file: join(viewsDir, 'test.tsx'),
      view: join(viewsDir, 'NonExistent.tsx'),
      path: '/test',
    }
    const handler = await createPage(pageData, [])

    expect(handler).toBeUndefined()
  })

  test('creates handler with status code', async () => {
    const mockContext = {
      status: mock(),
      render: mock(),
    } as unknown as Context
    const pageData = {
      file: join(viewsDir, 'test.tsx'),
      view: join(viewsDir, 'Test.tsx'),
      path: '/test',
      status: 201 as StatusCode,
    }
    const handler = await createPage(pageData, [])

    await handler?.(mockContext, async () => {})

    expect(handler).toBeDefined()
    expect(mockContext.status).toHaveBeenCalledWith(201)
  })

  test('handles Response objects thrown from view', async () => {
    const customResponse = new Response('Custom response', { status: 418 })
    const mockContext = {
      render: mock(() => {
        throw customResponse
      }),
    } as unknown as Context
    const pageData = {
      file: join(pagesDir, 'test.tsx'),
      view: join(viewsDir, 'Test.tsx'),
      path: '/test',
    }
    const handler = await createPage(pageData, [])
    const response = await handler?.(mockContext, async () => {})

    expect(handler).toBeDefined()
    expect(response).toBe(customResponse)
  })

  test('throws non-Response errors', async () => {
    const testError = new Error('Test error')
    const mockContext = {
      render: mock(() => {
        throw testError
      }),
    } as unknown as Context
    const pageData = {
      file: join(pagesDir, 'test.tsx'),
      view: join(viewsDir, 'Test.tsx'),
      path: '/test',
    }
    const handler = await createPage(pageData, [])
    const response = handler?.(mockContext, async () => {})

    expect(handler).toBeDefined()
    expect(response).rejects.toThrow(testError)
  })

  test('passes correct data to view component', async () => {
    const mockView = mock()
    const mockViewModule = () => ({ default: mockView })
    const mockContext = { render: mock() } as unknown as Context
    const pageViewPath = join(viewsDir, 'Mock.tsx')
    const pageData: PageData = {
      file: join(pagesDir, 'valid-1.tsx'),
      view: pageViewPath,
      path: '/test',
    }
    const pageList: PageList = [pageData]

    mock.module(pageViewPath, mockViewModule)

    const handler = await createPage(pageData, pageList)

    await handler?.(mockContext, async () => {})

    expect(handler).toBeDefined()
    expect(mockView).toHaveBeenCalledWith({
      context: mockContext,
      pages: pageList,
      page: pageData,
    })
  })

  test('handles empty view response', async () => {
    const mockContext = { render: mock() } as unknown as Context
    const pageData = {
      file: join(pagesDir, 'test.tsx'),
      view: join(viewsDir, 'Empty.tsx'),
      path: '/test',
    }
    const handler = await createPage(pageData, [])

    await handler?.(mockContext, async () => {})

    expect(handler).toBeDefined()
    expect(mockContext.render).toHaveBeenCalledWith('')
  })
})

describe('createPages', async () => {
  test('registers all valid pages', async () => {
    const app = new Hono()
    const pages = await loadPages(pagesDir, viewsDir)

    await createPages(app, pages)

    expect(app.routes.length).toEqual(6)
  })

  test('registers pages in correct order', async () => {
    const app = new Hono()
    const pages = await loadPages(pagesDir, viewsDir)
    const order = ['/nested/valid', '/valid-1', '/test', '/valid-3', '/*']

    await createPages(app, pages)

    for (let i = 0; i < order.length; ++i) {
      expect(app.routes[i].path).toBe(order[i])
    }
  })
})

describe('mikrob', async () => {
  test('mikrob initializes application with default directories', async () => {
    const app = await mikrob()

    expect(app.routes.length).toBe(1)
  })

  test('handles non-existent directories', async () => {
    const app = await mikrob({
      staticDir: 'non-existent',
      pagesDir: 'non-existent',
      viewsDir: 'non-existent',
    })

    expect(app.routes.length).toBe(1)
  })

  test('mikrob initializes application with custom directories', async () => {
    const app = await mikrob({ staticDir, pagesDir, viewsDir })

    expect(app.routes.length).toBe(7)
  })

  test('applies static file serving middleware', async () => {
    const serveStaticMock = mock()

    await mikrob({
      staticDir,
      pagesDir,
      viewsDir,
      serveStatic: serveStaticMock,
    })

    expect(serveStaticMock).toHaveBeenCalledWith({ root: staticDir })
  })

  test('registers routes from pages', async () => {
    const app = await mikrob({ staticDir, pagesDir, viewsDir })
    const registeredPaths = app.routes.map((route) => route.path)

    expect(registeredPaths).toContain('/test')
    expect(registeredPaths).toContain('/valid-1')
  })

  test('handles request to existing page', async () => {
    const app = await mikrob({ staticDir, pagesDir, viewsDir })

    const request = new Request('http://localhost/valid-1', {
      headers: { Accept: 'text/html', 'Content-Type': 'text/html' },
    })

    const response = await app.fetch(request)
    const text = await response.text()

    expect(response.status).toBe(200)
    expect(text).toContain('Hello Test!')
  })

  test('handles request to non-existent page', async () => {
    const app = await mikrob()
    const response = await app.request('/non-existent')

    expect(response.status).toBe(404)
  })

  test('handles redirect pages', async () => {
    const app = await mikrob({ staticDir, pagesDir, viewsDir })
    const response = await app.request('/valid-3')

    expect(response.status).toBe(301)
    expect(response.headers.get('Location')).toBe('https://domain.com')
  })

  test('handles pages with custom status codes', async () => {
    const app = await mikrob({ staticDir, pagesDir, viewsDir })
    const response = await app.request('/valid-4')

    expect(response.status).toBe(201)
  })

  test('serves static files when configured', async () => {
    const mockServeStatic = mock(() => async () => new Response('static')) as typeof serveStaticBun
    const app = await mikrob({
      staticDir,
      pagesDir,
      viewsDir,
      serveStatic: mockServeStatic,
    })
    const response = await app.request('/static/test.txt')
    const text = await response.text()

    expect(text).toBe('static')
  })

  test('applies JSX renderer middleware', async () => {
    const app = await mikrob({ staticDir, pagesDir, viewsDir })
    const response = await app.request('/valid-1')

    expect(response.headers.get('Content-Type')).toContain('text/html')
  })
})
