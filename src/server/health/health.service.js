import { config } from '../../config/config.js'
import { getServiceOAuthAccessToken } from '../common/services/apiBaseClient/oauth-token.js'

async function checkAccountApiToken() {
  await getServiceOAuthAccessToken({
    clientId: config.get('accountApi.clientId'),
    clientSecret: config.get('accountApi.clientSecret'),
    scope: config.get('accountApi.scope'),
    tokenEndpoint: config.get('accountApi.tokenEndpoint')
  })
}

export async function runHealthChecks() {
  const [accountToken] = await Promise.allSettled([checkAccountApiToken()])

  const checks = {
    'account-token': toCheckResult(accountToken)
  }

  const allOk = Object.values(checks).every((c) => c.ok)

  return { message: allOk ? 'success' : 'degraded', checks }
}

function toCheckResult(settled) {
  if (settled.status === 'fulfilled') {
    return { ok: true }
  }
  return { ok: false, error: settled.reason?.message ?? String(settled.reason) }
}
