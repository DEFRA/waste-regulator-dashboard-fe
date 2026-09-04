import { vi } from 'vitest'

import { catchAll, errorPageFor, errorPageTitle } from './errors.js'
import { statusCodes } from '../constants/status-codes.js'

describe('#errorPageFor', () => {
  test.each([
    [statusCodes.notFound, 'error/not-found', 'errors.notFound.pageTitle'],
    [
      statusCodes.forbidden,
      'error/access-denied',
      'errors.accessDenied.pageTitle'
    ],
    [
      statusCodes.serviceUnavailable,
      'error/service-unavailable',
      'errors.serviceUnavailable.pageTitle'
    ]
  ])('Should map %i to its own page', (statusCode, view, pageTitleKey) => {
    expect(errorPageFor(statusCode)).toEqual({ view, pageTitleKey })
  })

  test.each([
    statusCodes.badRequest,
    statusCodes.unauthorized,
    statusCodes.imATeapot,
    statusCodes.internalServerError
  ])('Should fall back to the problem page for %i', (statusCode) => {
    expect(errorPageFor(statusCode)).toEqual({
      view: 'error/problem-with-service',
      pageTitleKey: 'errors.problemWithService.pageTitle'
    })
  })
})

describe('#errorPageTitle', () => {
  test('Should return English title by default', () => {
    expect(errorPageTitle(statusCodes.notFound)).toBe('Page not found')
  })
})

describe('#catchAll', () => {
  const mockErrorLogger = vi.fn()
  const mockStack = 'Mock error stack'
  const mockRequest = (statusCode) => ({
    query: {},
    headers: {},
    yar: { get: () => null },
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
      locale: 'en',
      availableFrom: ''
    })
    expect(mockToolkitCode).toHaveBeenCalledWith(statusCodes.notFound)
  })

  test('Should provide expected "Access denied" page', () => {
    catchAll(mockRequest(statusCodes.forbidden), mockToolkit)

    expect(mockErrorLogger).not.toHaveBeenCalledWith(mockStack)
    expect(mockToolkitView).toHaveBeenCalledWith('error/access-denied', {
      pageTitle: 'You do not have permission to access this page',
      locale: 'en',
      availableFrom: ''
    })
    expect(mockToolkitCode).toHaveBeenCalledWith(statusCodes.forbidden)
  })

  test('Should provide expected "Service unavailable" page', () => {
    catchAll(mockRequest(statusCodes.serviceUnavailable), mockToolkit)

    expect(mockToolkitView).toHaveBeenCalledWith('error/service-unavailable', {
      pageTitle: 'Sorry, the service is unavailable',
      locale: 'en',
      availableFrom: ''
    })
    expect(mockToolkitCode).toHaveBeenCalledWith(statusCodes.serviceUnavailable)
  })

  test('Should provide the problem page for "Unauthorized"', () => {
    catchAll(mockRequest(statusCodes.unauthorized), mockToolkit)

    expect(mockErrorLogger).not.toHaveBeenCalledWith(mockStack)
    expect(mockToolkitView).toHaveBeenCalledWith('error/problem-with-service', {
      pageTitle: 'Sorry, there is a problem with the service',
      locale: 'en',
      availableFrom: ''
    })
    expect(mockToolkitCode).toHaveBeenCalledWith(statusCodes.unauthorized)
  })

  test('Should provide expected default page', () => {
    catchAll(mockRequest(statusCodes.imATeapot), mockToolkit)

    expect(mockErrorLogger).not.toHaveBeenCalledWith(mockStack)
    expect(mockToolkitView).toHaveBeenCalledWith('error/problem-with-service', {
      pageTitle: 'Sorry, there is a problem with the service',
      locale: 'en',
      availableFrom: ''
    })
    expect(mockToolkitCode).toHaveBeenCalledWith(statusCodes.imATeapot)
  })

  test('Should provide the problem page and log the error for internalServerError', () => {
    catchAll(mockRequest(statusCodes.internalServerError), mockToolkit)

    expect(mockErrorLogger).toHaveBeenCalledWith(mockStack)
    expect(mockToolkitView).toHaveBeenCalledWith('error/problem-with-service', {
      pageTitle: 'Sorry, there is a problem with the service',
      locale: 'en',
      availableFrom: ''
    })
    expect(mockToolkitCode).toHaveBeenCalledWith(
      statusCodes.internalServerError
    )
  })
})
