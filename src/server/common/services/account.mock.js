/**
 * In-memory fixture returned by the account client when `useMockApi` is set.
 * Shape mirrors the gateway's `AccountDetailsResponse` (camelCase, already
 * flattened to the primary organisation).
 */
export const mockAccountDetails = {
  firstName: 'John',
  lastName: 'Doe',
  contactEmail: 'john.doe@example.org',
  serviceRoleId: 4,
  serviceRole: 'Regulator Admin',
  organisationName: 'Example Environment Agency',
  nationId: 1
}
