import Boom from '@hapi/boom'
import { loadAccountDetails } from '../common/helpers/load-account-details.js'
import { SESSION_USER_STRATEGY } from './session-user.js'

const REGULATOR_ADMIN_SERVICE_ROLE_ID = 4
const REGULATOR_BASIC_SERVICE_ROLE_ID = 5

export function isRegulator(accountDetails) {
  const serviceRoleId = accountDetails?.serviceRoleId
  return (
    serviceRoleId === REGULATOR_ADMIN_SERVICE_ROLE_ID ||
    serviceRoleId === REGULATOR_BASIC_SERVICE_ROLE_ID
  )
}

export function isRegulatorAdmin(accountDetails) {
  return accountDetails?.serviceRoleId === REGULATOR_ADMIN_SERVICE_ROLE_ID
}

/**
 * Route prerequisite that verifies the authenticated user holds a regulator service role.
 * Returns HTTP 403 Forbidden via Boom if the user lacks a regulator role.
 *
 * @param {import('@hapi/hapi').Request} request
 * @param {import('@hapi/hapi').ResponseToolkit} h
 * @returns {Promise<import('@hapi/hapi').Lifecycle.ReturnValue>}
 */
export async function requireRegulatorRole(request, h) {
  let accountDetails = request.app?.accountDetails
  if (accountDetails === undefined && !request.app?.accountDetailsError) {
    const details = await loadAccountDetails(request)
    accountDetails = details.accountDetails
  }

  if (!isRegulator(accountDetails)) {
    return Boom.forbidden('User does not hold a regulator service role')
  }

  return h.continue
}

/**
 * Shared route options for routes restricted to authenticated regulator users.
 * Combines the session-user authentication strategy and the regulator role prerequisite
 * so routes cannot be half-configured or leave out role validation.
 */
export const regulatorRouteOptions = {
  auth: SESSION_USER_STRATEGY,
  pre: [requireRegulatorRole]
}
