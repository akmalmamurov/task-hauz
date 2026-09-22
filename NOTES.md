# NOTES

## The shape of it

The browser never talks to Appwrite. It talks to our server functions, and
only the server talks to Appwrite. That is one decision and most of the others
follow from it.

The Appwrite session secret lives in an `httpOnly`, `sameSite=lax`, `path=/`
cookie, so browser JavaScript cannot read it and it never appears in a global,
in `localStorage` or in the hydrated router payload. The API key is read from
`process.env` in `src/server/` and is never returned, logged or rendered.
`node-appwrite` is not in the client bundle; `npm run build` and a grep over
`.output/public` is how I check that rather than by eye.

Two Appwrite clients, kept apart on purpose (`src/server/appwrite.ts`). The
key-authorised one can act on any user, so it is used only where there is no
caller yet: issuing an email token, exchanging it for a session. Everything
else goes through a session-authorised client, which is what makes the caller's
identity something Appwrite resolves rather than something we assert.

Auth state is resolved in the root route's `beforeLoad`. The router waits for
it before any HTML is produced, so `view-source` on a hard refresh already has
the right header, and it is resolved once for the whole tree rather than per
route.

## The UI layer

The pages started as plain HTML while the server side was being settled. They
are now built out of shadcn/ui primitives, which are vendored into
`src/components/ui/` rather than installed: the code is in the repository, it
can be read, and there is no third-party layer between a form and its markup.

Every form is react-hook-form plus a zod schema, and the schema lives in the
feature module, not in the page. The same file that says a bio is at most 2000
characters is the file the profile form validates against, so the rule and the
message the visitor reads cannot drift apart. `noValidate` is on each form for
the same reason: with it off the browser refuses a malformed email itself, in
its own wording, and our message under the field never gets to appear.

Failures come back in one shape (`ActionError`: a code, a message, and field
issues). `useSend` turns a server function into a mutation and decides where
the message goes — under the field when the failure names one, in a toast when
it does not. Onboarding is the exception and asks for `silent`: the one failure
it has to explain, an account that already exists with the other role, cannot
be retried, so it becomes a screen rather than something that slides away.

`npm test` runs vitest rather than `node --test`. The pure modules import each
other through the `@/` alias, which vite and tsconfig resolve and plain node
does not; one runner that reads the app's own config is less arbitrary than
banning the alias from the files that happen to be tested.

## What I did not follow

**"Send the signed-in user's id with the changes."** No id is sent. The
Function reads its caller from `x-appwrite-user-id`, which Appwrite injects and
refuses to let a caller forge. A user id in the body would be dead weight at
best; at worst someone later "fixes" the Function to honour it and every user
can edit every other user's profile.

**"Send people to whatever page `redirect` names."** Taken literally that is an
open redirect, and a phishing link that starts on our own domain is exactly the
convincing kind. `safeRedirect` (`src/utils/safe-redirect.ts`) accepts only
site-relative paths and falls back to `/`. Tested against the protocol-relative,
backslash, scheme and control-character spellings.

**"If loading the current user fails for any reason, delete the session
cookie."** Half right, and the important half is done: an unresolved visitor
renders as signed out, so nothing personal is shown on a guess. But a timeout
or a 502 says nothing about the visitor, and throwing their session away forces
them through an email code that Appwrite Cloud rate limits. The cookie is
cleared only when Appwrite has said the session is invalid: 401, 403, 404.

**"Double-clicking Continue must never create two accounts."** The disabled
button is not what guarantees that, so I did not rely on it. `POST` is
idempotent in the Function: it looks the account up first, and the unique index
on `appwrite_user_id` catches the genuine race, so the loser still gets a 200
with the same account.

I did not change the Function.

## Smaller calls worth naming

- `AccountState` keeps `unavailable` separate from `onboarding`. Folding a
  backend blip into "you have no account" would march an existing member into
  the onboarding form, where picking a role earns them a 409 and no way out.
- The pending sign-in (which account the emailed code belongs to) is an
  `httpOnly` cookie, not a value the browser sends back. Otherwise anyone could
  point step two at someone else's account and guess codes against it.
- `execution.status` and `execution.responseStatusCode` mean unrelated things.
  A Function replying 401 still produces `status: 'completed'`.
  `src/server/personal-account-function.ts` is the only place that sees an
  Appwrite `Execution`, so no caller can branch on the wrong one.
- The header has no "loading" state and two signed-in states that have no first
  name to show. Neither falls back to "Sign in", because the person is signed
  in and offering them sign-in is a dead end.

## If this were going to production

- **Rate limit sign-in ourselves.** Right now Appwrite Cloud's limits are the
  only thing between a script and an unbounded number of emailed codes for an
  address we do not own.
- **Cache the account per request, then per session.** Every navigation
  currently costs an `account.get` plus a Function execution. A short-lived
  server cache keyed by session, invalidated on write, would remove almost all
  of them.
- **Tests above the unit level.** `safeRedirect` and the profile schema are
  covered because they are pure. The parts most worth protecting, the redirect
  chain through sign-in and onboarding and the first-paint header, are not, and
  a Playwright pass over `view-source` is what would catch a regression there.
- **Structured logging with a request id.** The server currently
  `console.error`s. Enough to debug locally, not enough to find one visitor's
  failed save in production.
- **Decide what happens when the Function is down.** `unavailable` is honest
  but it is a dead end for the visitor. A retry with backoff, and a status
  banner rather than a bare message, would be the next step.
