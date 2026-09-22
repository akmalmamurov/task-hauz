# HAUZ frontend take-home starter

A blank TanStack Start app plus the Appwrite Function you will call from it.
Read `TASK.md` for what to build. This file is only about getting it running.

## What you need

- Node 22 or newer
- A free Appwrite Cloud account at https://cloud.appwrite.io

## Setup

Budget 20 minutes. If you get stuck for longer than that, email us instead of
grinding on it. Setup friction is not what we are testing.

### 1. Install dependencies

```bash
npm install
```

### 2. Create an Appwrite project

In the Appwrite Console, create a new project. From **Overview**, copy the
**Project ID** and the **API Endpoint**. The endpoint is region specific, for
example `https://fra.cloud.appwrite.io/v1`.

Put both into `appwrite.config.json`, replacing `REPLACE_WITH_YOUR_PROJECT_ID`
and the `endpoint` if your region differs.

### 3. Push the database, table and Function

```bash
npx appwrite login
npm run appwrite:push
```

That creates the `main` database, the `personal_accounts` table with its unique
index, and deploys the `personal-account` Function. The first deployment takes a
minute or two while Appwrite builds it.

Confirm it worked: the Function should appear in the Console under **Functions**
with a ready deployment, and its **Execute access** should be `users`.

One warning about that command. `appwrite push table` treats
`appwrite.config.json` as the full picture of your schema and deletes tables in
the project that are not in it. On the fresh project you just made there is
nothing to delete, so it is safe here. Do not run it against a project that has
other tables in it.

### 4. Create an API key

Console, **Overview**, **Integrations**, **API keys**, **Create API key**.

Give it these scopes:

- `sessions.write`
- `users.read`
- `users.write`
- `execution.write`

Copy the secret once. You cannot read it again.

### 5. Fill in your environment

```bash
cp .env.example .env
```

Fill in `APPWRITE_ENDPOINT`, `APPWRITE_PROJECT_ID` and `APPWRITE_API_KEY`.
`.env` is git-ignored. Do not commit it.

### 6. Run it

```bash
npm run dev
```

http://localhost:3000

## What is in here

```
src/
  router.tsx                        router setup, one QueryClient per request
  routes/__root.tsx                 document shell; resolves auth state for SSR
  routes/index.tsx                  home
  routes/signin.tsx                 email, then the six digit code
  routes/onboarding.tsx             first name, last name, role
  routes/profile.tsx                view and edit the personal account
  components/header.tsx             "Sign in", or the first name and "Log out"
  components/page.tsx               the one column every page is laid out in
  components/ui/                    shadcn/ui primitives, vendored and trimmed
  modules/                          one folder per feature the routes call into
    auth/                           the sign-in schemas and their hooks
    personal-account/               the profile schemas, the PATCH body, hooks
  hooks/                            shared across features
    use-send.ts                     a server function as a mutation, with the
                                    success toast and the normalised failure
    use-form-errors.ts              a failure's field issues, back on the form
  types/                            shapes shared by the server and the browser
    personal-account.ts             the account shape and the AccountState union
    action-error.ts                 the one failure shape the UI reads
  constants/                        limits and paths, named once
  utils/safe-redirect.ts            which `redirect` targets are allowed
  lib/                              small helpers: cn(), the toast wrappers
  server/                           server only; never reaches the browser
    env.ts                          APPWRITE_* read from process.env, via zod
    appwrite.ts                     the key-authorised and session clients
    session.ts                      the httpOnly cookies, named in one place
    current-user.ts                 who is signed in, from the session cookie
    auth.ts                         request a code, verify it, log out
    personal-account-function.ts    the only caller of the Function
    personal-account.ts             account state, create, update
functions/personal-account/         the Function, unchanged from the starter
appwrite.config.json                database, table and Function definitions
```

Read [`NOTES.md`](NOTES.md) for the decisions behind that layout and for the
three places this app deliberately does not do what the brief asked.

### How a page talks to the server

A route never calls a server function directly. It renders a form, and the
feature module owns everything else:

```
route  ──  zod schema      what the form accepts, and the message if it does not
       ──  feature hook    calls the server function, raises an ActionError
       ──  useSend         one toast on success, one normalised failure
       ──  useFormErrors   field issues go back under their inputs
```

So there is one answer to "where is this rule written" (the schema), one to
"what happens when it fails" (`ActionError`), and one to "where does the
message appear": under the field if it belongs to a field, in a toast if it
does not.

### Routes

| Path | Signed out | Signed in, no account | Signed in |
|---|---|---|---|
| `/` | sign-in link | link to onboarding | link to the profile |
| `/signin` | email, then code | redirects to `redirect` | redirects to `redirect` |
| `/onboarding` | redirects to `/signin` | the form | redirects to `redirect` |
| `/profile` | redirects to `/signin?redirect=%2Fprofile` | redirects to `/onboarding` | view and edit |

Every one of those redirects is decided in `beforeLoad`, so on a hard load the
server answers `307` and the browser is never sent a frame of the wrong page.

Other scripts:

```bash
npm run build       production build
npm run typecheck   tsc --noEmit
npm test            vitest over the pure modules (schemas, safeRedirect)
npm run appwrite    the Appwrite CLI, scoped to this project's config
```

### Checking the secrets never reach the browser

```bash
npm run build
grep -rl "node-appwrite\|APPWRITE_API_KEY\|hauz_session" dist/client/   # no hits
```

## The Function

One Appwrite Function with three routes. It is deployed with **Execute access:
users**, which means a signed-in Appwrite user can execute it and a guest
cannot.

| Route | Body | Result |
|---|---|---|
| `GET /personal-account` | | `200` with the account, `404` if the caller has none |
| `POST /personal-account` | `firstName`, `lastName`, `role` | `201` created, `200` if it already exists, `409` if it exists with a different role |
| `PATCH /personal-account` | any of `firstName`, `lastName`, `contactEmail`, `bio` | `200` with the updated account |

`role` is either `property_owner` or `realtor`.

On `PATCH`, a field you leave out keeps its stored value and `null` clears it.
Every route answers `401` when the execution has no signed-in Appwrite user.

Errors come back as `{ "error": "<code>", "message": "...", "issues": [...] }`.
Codes you may see: `unauthorized`, `not_found`, `invalid_request`,
`personal_account_inconsistent`, `internal_error`.

You can read the source under `functions/personal-account/src/`. You may change
it if you need to, but say why in `NOTES.md`.

## Email codes

Appwrite Cloud sends the sign-in codes from its own mail server on the free
plan. Check your spam folder. If nothing arrives after a few minutes, Cloud may
be rate limiting you, so wait and retry rather than clicking send repeatedly.
