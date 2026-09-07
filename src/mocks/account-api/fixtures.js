// Account API mock data: the signed-in user returned by the user-organisations
// lookup. Shape mirrors the raw response the Account API gives
// (GET /api/users/user-organisations -> { user }), which the account service
// then flattens to its view model.

export const mockAccountUser = {
  firstName: 'John',
  lastName: 'Doe',
  email: 'john.doe@example.org',
  serviceRole: 'Regulator Admin',
  serviceRoleId: 4,
  organisations: [{ name: 'Example Environment Agency', nationId: 1 }]
}
