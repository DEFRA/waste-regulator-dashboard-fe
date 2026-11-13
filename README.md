# waste-regulator-dashboard-fe

[![Security Rating](https://sonarcloud.io/api/project_badges/measure?project=DEFRA_waste-regulator-dashboard-fe&metric=security_rating)](https://sonarcloud.io/summary/new_code?id=DEFRA_waste-regulator-dashboard-fe)
[![Quality Gate Status](https://sonarcloud.io/api/project_badges/measure?project=DEFRA_waste-regulator-dashboard-fe&metric=alert_status)](https://sonarcloud.io/summary/new_code?id=DEFRA_waste-regulator-dashboard-fe)
[![Coverage](https://sonarcloud.io/api/project_badges/measure?project=DEFRA_waste-regulator-dashboard-fe&metric=coverage)](https://sonarcloud.io/summary/new_code?id=DEFRA_waste-regulator-dashboard-fe)

Core delivery platform Node.js Frontend Template.

- [Requirements](#requirements)
  - [Node.js](#nodejs)
- [Server-side Caching](#server-side-caching)
- [Redis](#redis)
- [Welsh language support](#welsh-language-support)
- [Local Development](#local-development)
  - [Setup](#setup)
    - [Nix dev shell (optional)](#nix-dev-shell-optional)
  - [Development](#development)
  - [HTTPS for local development](#https-for-local-development)
  - [Production](#production)
  - [Npm scripts](#npm-scripts)
  - [Update dependencies](#update-dependencies)
  - [Formatting](#formatting)
    - [Windows prettier issue](#windows-prettier-issue)
- [Docker](#docker)
  - [Development image](#development-image)
  - [Production image](#production-image)
  - [Docker Compose](#docker-compose)
  - [Dependabot](#dependabot)
  - [SonarCloud](#sonarcloud)
- [Licence](#licence)
  - [About the licence](#about-the-licence)

## Requirements

### Node.js

Please install [Node.js](http://nodejs.org/) `>= v22` and [npm](https://nodejs.org/) `>= v9`. You will find it
easier to use the Node Version Manager [nvm](https://github.com/creationix/nvm)

To use the correct version of Node.js for this application, via nvm:

```bash
cd waste-regulator-dashboard-fe
nvm use
```

You can alternatively use [mise-en-place](https://mise.jdx.dev/) with [`idiomatic_version_file_enable_tools`](https://mise.jdx.dev/configuration.html#idiomatic-version-files) enabled which will respect the [`.nvmrc`](.nvmrc).

## Server-side Caching

We use Catbox for server-side caching. By default the service will use CatboxRedis when deployed and CatboxMemory for
local development.
You can override the default behaviour by setting the `SESSION_CACHE_ENGINE` environment variable to either `redis` or
`memory`.

Please note: CatboxMemory (`memory`) is _not_ suitable for production use! The cache will not be shared between each
instance of the service and it will not persist between restarts.

## Redis

Redis is an in-memory key-value store. Every instance of a service has access to the same Redis key-value store similar
to how services might have a database (or MongoDB). All frontend services are given access to a namespaced prefixed that
matches the service name. e.g. `my-service` will have access to everything in Redis that is prefixed with `my-service`.

If your service does not require a session cache to be shared between instances or if you don't require Redis, you can
disable setting `SESSION_CACHE_ENGINE=false` or changing the default value in `src/config/index.js`.

## Welsh language support

Locale support follows the same approach as [waste-packaging-regulators-fe](https://github.com/DEFRA/waste-packaging-regulators-fe): translations live in `src/server/locales/en.json` and `cy.json`, resolved via `getLocale(request)` (`?lang=` query param, then OAuth session `authLocale`, then `Accept-Language`, default `en`).

- Append `?lang=cy` to CDP-internal links when the active locale is Welsh (English uses no lang query param).
- Links to the Azure-hosted regulator service do not receive `?lang=cy` — that service manages locale via its own session culture.
- Welsh locale is saved to session before OAuth redirect and cleared after sign-in completes.
- Missing Welsh keys fall back to English automatically.

## Proxy

We are using forward-proxy which is set up by default. To make use of this: `import { fetch } from 'undici'` then
because of the `setGlobalDispatcher(new ProxyAgent(proxyUrl))` calls will use the ProxyAgent Dispatcher

If you are not using Wreck, Axios or Undici or a similar http that uses `Request`. Then you may have to provide the
proxy dispatcher:

To add the dispatcher to your own client:

```javascript
import { ProxyAgent } from 'undici'

return await fetch(url, {
  dispatcher: new ProxyAgent({
    uri: proxyUrl,
    keepAliveTimeout: 10,
    keepAliveMaxTimeout: 10
  })
})
```

## Signing in with Entra ID (proof of concept)

Regulators sign in with Azure AD B2C today. This branch adds **Entra ID** as a second way to sign in, so we can move over safely. Nothing changes unless you ask for it: the default is B2C.

### In one minute

- You choose the sign-in with one setting, `AUTH_PROVIDER` (`b2c` is the default, `entra` turns the new one on).
- On CDP the app proves who it is to Entra ID **without a password**. It asks AWS for a short-lived token and shows that instead of a client secret. This is called a federated credential, and it is how `waste-disposal-fee-frontend` does it too.
- On your own machine there is no AWS, so you use a client secret instead.
- Entra ID says who the person is. Whether they are allowed in is still decided by the Account API, as before. The Account API knows people by their **old B2C id**, so that id is copied onto each Entra ID user once, and comes back in the sign-in token (see the yellow note in the diagram).

### How a sign-in works

![How an Entra ID sign-in works. Set up once beforehand: an admin copies each person's old B2C id onto their Entra ID user. Then the regulator opens a page and is sent to Entra ID, comes back with a code, the dashboard gets a short-lived token from AWS STS and swaps the code for tokens that include the old B2C id, starts a fresh session, asks the Account API whether the person is a regulator using that id, then shows the page](docs/images/entra-sign-in.png)

_The diagram is drawn from [`docs/images/entra-sign-in.mmd`](docs/images/entra-sign-in.mmd) (Mermaid). To change it, edit that file and re-render the PNG with `npx @mermaid-js/mermaid-cli -i docs/images/entra-sign-in.mmd -o docs/images/entra-sign-in.png -s 2 -b white`._

While you are signed in, the dashboard renews the Entra ID token in the background just before it runs out. If renewing fails, you are asked to sign in again. Signing out clears the session and then sends you to Entra ID to sign out there, where you may be asked to pick the account first.

### Turning it on

| Setting                          | What it is                                                                                                                               |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `AUTH_PROVIDER`                  | `b2c` (default) or `entra`                                                                                                               |
| `ENTRA_ID_AUTHORITY`             | The tenant, for example `https://login.microsoftonline.com/<tenant id>`                                                                  |
| `ENTRA_ID_CLIENT_ID`             | The app registration's client id                                                                                                         |
| `ENTRA_ID_API_SCOPE`             | The app's own scope, `api://<client id>/.default`. Needed so the token carries the user's roles                                          |
| `ENTRA_ID_EXTERNAL_BASE_URL`     | The public address of this app, for example `https://<host>`. Add a path if it is served under a prefix. Required on CDP                 |
| `FEDERATED_CREDENTIALS_AUDIENCE` | The audience on the federated credential. Default `waste-regulator-dashboard-fe`                                                         |
| `ENTRA_ID_CLIENT_SECRET`         | Local development only                                                                                                                   |
| `ENTRA_ID_CREDENTIAL_TYPE`       | `federated` (the default on CDP) or `secret` (the default locally). A secret is refused when `NODE_ENV=production`                       |
| `ENTRA_ID_REQUIRED_ROLE`         | Optional. If set, only people with this app role can sign in. Empty means no check                                                       |
| `ENTRA_ID_ACCOUNT_ID_CLAIM`      | Optional. Which claim holds the id the Account API knows the person by. Default `oid`. Use it to carry the old B2C object id (see below) |
| `SESSION_COOKIE_TTL`             | Session length. Defaults to 4 hours with Entra ID, 30 seconds with B2C                                                                   |

The cookie settings `AUTH_COOKIE_PASSWORD` and `AUTH_COOKIE_SECURE` are shared with B2C. If Entra ID is selected but something is missing, the sign-in page says what is missing instead of failing in a confusing way.

To try it on your machine you need an app registration in the `defradev` tenant. Then:

```bash
AUTH_PROVIDER=entra MOCK_AUTH=false MOCK_API=true \
ENTRA_ID_AUTHORITY=https://login.microsoftonline.com/<tenant id> \
ENTRA_ID_CLIENT_ID=<client id> ENTRA_ID_CLIENT_SECRET=<secret> \
ENTRA_ID_API_SCOPE=api://<client id>/.default \
ENTRA_ID_EXTERNAL_BASE_URL=http://localhost:7154 npm run dev
```

`MOCK_AUTH` is ignored when Entra ID is on. After signing in, `/whoami` shows what Entra ID told us about you (never the tokens).

### The old B2C id (the yellow note in the diagram)

The Account API, and many tables behind it, identify people by their **B2C object id**. An Entra ID object id is different. So there is a one-off job before anyone can sign in:

1. An admin copies each person's old B2C id onto their Entra ID user, as a custom attribute. Matching is by email, and a person checks the list before anything is written. About 120 internal users.
2. The app registration is set up to send that attribute back as a claim in the sign-in token.
3. Set `ENTRA_ID_ACCOUNT_ID_CLAIM` to that claim's name. The dashboard then asks the Account API with that id.

Anyone without it falls back to their Entra ID id, and is refused until they are fixed. Only admins must ever be able to write that attribute, because it decides whose account loads. Draft scripts for steps 1 and 2 are written but have not been run against a real tenant.

### Tests

The journey tests run the whole sign-in against a fake Entra ID and a fake AWS STS. They show, among other things, that the token request carries the AWS token and no secret, that renewing and failed renewing behave, that a forged callback is turned away, that a replayed callback after signing in just goes on to the page, and that signing in starts a clean session. Run them with `npm test`.

### Not done yet

- It has not been run against a real Entra ID tenant or on CDP. That also means nobody has seen Entra ID accept the AWS token yet.
- The old B2C id is not on the Entra ID users yet, and the claim is not set up on an app registration. Until then real regulators will not find their account.
- Whether the CDP proxy covers the AWS and Entra ID calls needs checking on a deploy.
- Role checks are optional and off by default.
- The app registrations still have to be requested through ServiceNow.

## Local Development

### Setup

Install application dependencies:

```bash
npm install
```

#### Nix dev shell (optional)

[`flake.nix`](./flake.nix) provides a dev shell with tools used by this repo.

Run `nix develop` or use [direnv](https://direnv.net/) to activate the development tools for this repo

We have not added nodejs to the nix shell, preferring nvm/mise due to more precise version pinning in order to to avoid unexpected behaviour differences across minor node versions.

### Development

To run the application in `development` mode run:

```bash
npm run dev
```

### Mock API

With `MOCK_API=true` (the default outside production), the dashboard's Account API
call is intercepted in-process by [Mock Service Worker](https://mswjs.io/) and
answered from a local fixture. The production code makes ordinary `fetch` calls and
is unaware of the mock — nothing is branched on `MOCK_API` outside the mock layer.

See [`src/mocks/README.md`](./src/mocks/README.md) for the mock layer's design and
how to override the fixture in tests.

### HTTPS for local development

Azure AD B2C will only redirect back to an HTTPS URL, so the app needs to serve
HTTPS locally for end-to-end auth flows to work.

The server enables TLS automatically when **both** are true:

1. `NODE_ENV=development` (set by `npm run dev` and `nodemon.json`)
2. `certs/localhost-key.pem` and `certs/localhost-cert.pem` exist at the repo root

In production the app continues to serve plain HTTP behind an edge terminator —
this setup is dev-only.

To generate a trusted local cert pair, install [mkcert] and run:

```bash
npm run setup:certs
```

Then start the app as normal:

```bash
npm run dev
```

The startup log will show `https://localhost:7154` once TLS is active. You will
also want to set `AUTH_COOKIE_SECURE=true` in `run-dev.sh` so the session cookie
is marked secure.

[mkcert]: https://github.com/FiloSottile/mkcert

### Production

To mimic the application running in `production` mode locally run:

```bash
npm start
```

### Npm scripts

All available Npm scripts can be seen in [package.json](./package.json)
To view them in your command line run:

```bash
npm run
```

### Update dependencies

To update dependencies use [npm-check-updates](https://github.com/raineorshine/npm-check-updates):

> The following script is a good start. Check out all the options on
> the [npm-check-updates](https://github.com/raineorshine/npm-check-updates)

```bash
ncu --interactive --format group
```

### Formatting

#### Windows prettier issue

If you are having issues with formatting of line breaks on Windows update your global git config by running:

```bash
git config --global core.autocrlf false
```

## Docker

### Development image

> [!TIP]
> For Apple Silicon users, you may need to add `--platform linux/amd64` to the `docker run` command to ensure
> compatibility fEx: `docker build --platform=linux/arm64 --no-cache --tag waste-regulator-dashboard-fe`

Build:

```bash
docker build --target development --no-cache --tag waste-regulator-dashboard-fe:development .
```

Run:

```bash
docker run -p 7154:7154 waste-regulator-dashboard-fe:development
```

### Production image

Build:

```bash
docker build --no-cache --tag waste-regulator-dashboard-fe .
```

Run:

```bash
docker run -p 7154:7154 waste-regulator-dashboard-fe
```

### Docker Compose

A local environment with:

- Localstack for AWS services (S3, SQS)
- Redis
- MongoDB
- This service.
- A commented out backend example.

```bash
docker compose up --build -d
```

### Dependabot

We have added an example dependabot configuration file to the repository. You can enable it by renaming
the [.github/example.dependabot.yml](.github/example.dependabot.yml) to `.github/dependabot.yml`

### SonarCloud

Instructions for setting up SonarCloud can be found in [sonar-project.properties](./sonar-project.properties).

## Licence

THIS INFORMATION IS LICENSED UNDER THE CONDITIONS OF THE OPEN GOVERNMENT LICENCE found at:

<http://www.nationalarchives.gov.uk/doc/open-government-licence/version/3>

The following attribution statement MUST be cited in your products and applications when using this information.

> Contains public sector information licensed under the Open Government license v3

### About the licence

The Open Government Licence (OGL) was developed by the Controller of Her Majesty's Stationery Office (HMSO) to enable
information providers in the public sector to license the use and re-use of their information under a common open
licence.

It is designed to encourage use and re-use of information freely and flexibly, with only a few conditions.
