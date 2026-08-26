import { vi } from 'vitest'

import { catchAll, errorPageFor } from './errors.js'
import { createServer } from '../../server.js'
import { statusCodes } from '../constants/status-codes.js'

describe('#errors', () => {
  let server

  beforeAll(async () => {
    server = await createServer()
    await server.initialize()
  })

  afterAll(async () => {
    await server.stop({ timeout: 0 })
  })

  test('Should provide expected Not Found page', async () => {
    const { result, statusCode } = await server.inject({
      method: 'GET',
      url: '/non-existent-path'
    })

    expect(result).toEqual(
      expect.stringContaining('Page not found | pEPR: Regulators&#39; Service')
    )
    expect(result).toEqual(
      expect.stringContaining(
        'If you typed the web address, check it is correct.'
      )
    )
    expect(result).toEqual(
      expect.stringContaining('mailto:eprcustomerservice@defra.gov.uk')
    )
    expect(statusCode).toBe(statusCodes.notFound)
  })
})

describe('#errorPageFor', () => {
  test.each([
    [statusCodes.notFound, 'error/not-found', 'Page not found'],
    [
      statusCodes.forbidden,
      'error/access-denied',
      'You do not have permission to access this page'
    ],
    [
      statusCodes.serviceUnavailable,
      'error/service-unavailable',
      'Sorry, the service is unavailable'
    ]
  ])('Should map %i to its own page', (statusCode, view, pageTitle) => {
    expect(errorPageFor(statusCode)).toEqual({ view, pageTitle })
  })

  test.each([
    statusCodes.badRequest,
    statusCodes.unauthorized,
    statusCodes.imATeapot,
    statusCodes.internalServerError
  ])('Should fall back to the problem page for %i', (statusCode) => {
    expect(errorPageFor(statusCode)).toEqual({
      view: 'error/problem-with-service',
      pageTitle: 'Sorry, there is a problem with the service'
    })
  })
})

describe('#catchAll', () => {
  const mockErrorLogger = vi.fn()
  const mockStack = 'Mock error stack'
  const mockRequest = (statusCode) => ({
    response: {
      isBoom: true,
      stack: mockStack,
      output: {
        statusCode
      }
    },
    logger: { error: mockErrorLogger }
  })
  const mockToolkitView = vi.fn()
  const mockToolkitCode = vi.fn()
  const mockToolkit = {
    view: mockToolkitView.mockReturnThis(),
    code: mockToolkitCode.mockReturnThis()
  }

  test('Should pass non-Boom responses straight through', () => {
    const mockContinue = Symbol('continue')

    expect(
      catchAll({ response: {} }, { ...mockToolkit, continue: mockContinue })
    ).toBe(mockContinue)
    expect(mockToolkitView).not.toHaveBeenCalled()
  })

  test('Should provide expected "Page not found" page', () => {
    catchAll(mockRequest(statusCodes.notFound), mockToolkit)

    expect(mockErrorLogger).not.toHaveBeenCalledWith(mockStack)
    expect(mockToolkitView).toHaveBeenCalledWith('error/not-found', {
      pageTitle: 'Page not found',
      availableFrom: ''
    })
    expect(mockToolkitCode).toHaveBeenCalledWith(statusCodes.notFound)
  })

  test('Should provide expected "Access denied" page', () => {
    catchAll(mockRequest(statusCodes.forbidden), mockToolkit)

    expect(mockErrorLogger).not.toHaveBeenCalledWith(mockStack)
    expect(mockToolkitView).toHaveBeenCalledWith('error/access-denied', {
      pageTitle: 'You do not have permission to access this page',
      availableFrom: ''
    })
    expect(mockToolkitCode).toHaveBeenCalledWith(statusCodes.forbidden)
  })

  test('Should provide expected "Service unavailable" page', () => {
    catchAll(mockRequest(statusCodes.serviceUnavailable), mockToolkit)

    expect(mockToolkitView).toHaveBeenCalledWith('error/service-unavailable', {
      pageTitle: 'Sorry, the service is unavailable',
      availableFrom: ''
    })
    expect(mockToolkitCode).toHaveBeenCalledWith(statusCodes.serviceUnavailable)
  })

  // The user's call: an expired or missing session shows the generic problem
  // page rather than bouncing straight to sign-in.
  test('Should provide the problem page for "Unauthorized"', () => {
    catchAll(mockRequest(statusCodes.unauthorized), mockToolkit)

    expect(mockErrorLogger).not.toHaveBeenCalledWith(mockStack)
    expect(mockToolkitView).toHaveBeenCalledWith('error/problem-with-service', {
      pageTitle: 'Sorry, there is a problem with the service',
      availableFrom: ''
    })
    expect(mockToolkitCode).toHaveBeenCalledWith(statusCodes.unauthorized)
  })

  test('Should provide expected default page', () => {
    catchAll(mockRequest(statusCodes.imATeapot), mockToolkit)

    expect(mockErrorLogger).not.toHaveBeenCalledWith(mockStack)
    expect(mockToolkitView).toHaveBeenCalledWith('error/problem-with-service', {
      pageTitle: 'Sorry, there is a problem with the service',
      availableFrom: ''
    })
    expect(mockToolkitCode).toHaveBeenCalledWith(statusCodes.imATeapot)
  })

  test('Should provide the problem page and log the error for internalServerError', () => {
    catchAll(mockRequest(statusCodes.internalServerError), mockToolkit)

    expect(mockErrorLogger).toHaveBeenCalledWith(mockStack)
    expect(mockToolkitView).toHaveBeenCalledWith('error/problem-with-service', {
      pageTitle: 'Sorry, there is a problem with the service',
      availableFrom: ''
    })
    expect(mockToolkitCode).toHaveBeenCalledWith(
      statusCodes.internalServerError
    )
  })
})
