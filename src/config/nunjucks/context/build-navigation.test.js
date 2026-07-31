import { buildNavigation } from './build-navigation.js'

function mockRequest(options) {
  return { ...options }
}

describe('#buildNavigation', () => {
  test('Should return empty navigation', () => {
    expect(
      buildNavigation(mockRequest({ path: '/non-existent-path' }))
    ).toEqual([])
  })

  test('Should return empty navigation regardless of path', () => {
    expect(buildNavigation(mockRequest({ path: '/' }))).toEqual([])
  })
})
