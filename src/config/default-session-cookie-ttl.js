export const thirtySecondsMs = 30000
export const fourHoursMs = 14400000

export function defaultSessionCookieTtlMs(env = process.env) {
  const isProduction = env.NODE_ENV === 'production'
  const mockAuthEnv = env.MOCK_AUTH
  const usesMockAuth =
    mockAuthEnv === 'true' ||
    mockAuthEnv === '1' ||
    (mockAuthEnv !== 'false' && !isProduction)

  if (usesMockAuth) {
    return fourHoursMs
  }

  // Entra ID renews the access token with the refresh token, so the session can
  // last. B2C has no refresh here, which is why it re-runs sign-in every 30s.
  if (env.AUTH_PROVIDER === 'entra') {
    return fourHoursMs
  }

  return thirtySecondsMs
}
