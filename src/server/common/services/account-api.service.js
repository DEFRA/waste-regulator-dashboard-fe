import { config } from '../../../config/config.js'
import { BaseApiService } from './apiBaseClient/base-api.service.js'
import { mockAccountDetails } from './account.mock.js'

function asGuidString(value) {
  if (typeof value !== 'string') return undefined
  const v = value.trim()
  if (!v) return undefined
  const m =
    /^\{?([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})}?$/i.exec(
      v
    )
  return m ? m[1] : undefined
}

function trimmed(value) {
  return typeof value === 'string' ? value.trim() : ''
}

/** @param {{ profile?: { oid?: string; sub?: string } } | string | null | undefined} sessionUser */
export function getAccountUserIdFromSessionUser(sessionUser) {
  if (typeof sessionUser === 'string') return asGuidString(sessionUser)
  if (!sessionUser || typeof sessionUser !== 'object') return undefined

  return (
    asGuidString(sessionUser.profile?.oid) ||
    asGuidString(sessionUser.profile?.sub)
  )
}

/**
 * Map Account API DTO (`AccountDetailsResponse`, camelCase JSON from ASP.NET Core).
 * @param {*} dto
 */
export function mapAccountDetailsDtoToViewModel(dto) {
  return {
    firstName: trimmed(dto.firstName),
    lastName: trimmed(dto.lastName),
    serviceRole: trimmed(dto.serviceRole ?? ''),
    serviceRoleId: dto.serviceRoleId,
    email: trimmed(dto.contactEmail ?? ''),
    organisationName: trimmed(dto.organisationName ?? ''),
    nationId: dto.nationId
  }
}

export class AccountApiService extends BaseApiService {
  constructor(options = {}) {
    super({
      ...options,
      serviceName: 'account'
    })
  }

  async getAccountDetails(userId, traceId) {
    if (config.get('useMockApi')) {
      this.logger?.debug?.(
        { userId },
        'Returning mock account details (MOCK_API)'
      )
      return mockAccountDetails
    }
    return this.getJson(
      `/api/account/${encodeURIComponent(userId)}`,
      this.getTracingHeader(traceId)
    )
  }
}

export function createAccountApiService(options = {}) {
  return new AccountApiService({
    baseUrl: config.get('accountApi.baseUrl'),
    authMode: config.get('accountApi.authMode'),
    clientId: config.get('accountApi.clientId'),
    clientSecret: config.get('accountApi.clientSecret'),
    scope: config.get('accountApi.scope'),
    tokenEndpoint: config.get('accountApi.tokenEndpoint'),
    tracingHeader: config.get('tracing.header'),
    ...options
  })
}
