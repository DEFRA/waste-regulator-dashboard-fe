import { describe, it, expect, vi } from 'vitest'
import { clearSiblingAuthCookies } from './clear-sibling-auth-cookies.js'

describe('clearSiblingAuthCookies', () => {
  it('appends expired session and Bell cookies for each sibling path', () => {
    const response = { isBoom: false, header: vi.fn() }

    clearSiblingAuthCookies({ response }, ['/certificates-of-compliance'])

    expect(response.header).toHaveBeenCalledTimes(2)
    expect(response.header).toHaveBeenCalledWith(
      'Set-Cookie',
      expect.stringContaining('session='),
      { append: true }
    )
    expect(response.header).toHaveBeenCalledWith(
      'Set-Cookie',
      expect.stringContaining('bell-azure-ad-b2c='),
      { append: true }
    )
    expect(response.header.mock.calls[0][1]).toContain(
      'Path=/certificates-of-compliance'
    )
  })

  it('does nothing when paths is empty', () => {
    const response = { isBoom: false, header: vi.fn() }

    clearSiblingAuthCookies({ response }, [])

    expect(response.header).not.toHaveBeenCalled()
  })

  it('does nothing when the response is a Boom error', () => {
    const response = { isBoom: true, header: vi.fn() }

    clearSiblingAuthCookies({ response }, ['/certificates-of-compliance'])

    expect(response.header).not.toHaveBeenCalled()
  })
})
