# The mock API layer

`src/mocks/` is a dev-only mock of the **Account** API, built on
[Mock Service Worker](https://mswjs.io/), so the app can run and be tested without
a live Account service.

It intercepts at the HTTP boundary: production code makes ordinary `fetch` calls
and never branches on `MOCK_API`. `msw` is loaded behind a dynamic `import()` in
`server.js`, so it never enters the production module graph. The one call the
dashboard makes — `GET /api/users/user-organisations` — is served the fixture in
`account-api/fixtures.js`.

`MOCK_API=true` (the default outside production) turns the mock on.

Tests declare the user they need by overriding the handler on the running server
(`getMockServer().use(http.get(...))`) rather than depending on the default
fixture.
