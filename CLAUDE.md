# CLAUDE.md

Standing rules for this repository. These are not suggestions — they are the
constraints the work is graded against. The brief lives in `TASK.md`; setup and
the Function's API live in `README.md`.

## Secrets and sessions

- The Appwrite session secret and the Appwrite API key must never be readable by
  browser JavaScript. Not in a global, not in a hydrated router/query payload,
  not in `localStorage`, not in a non-httpOnly cookie.
- The session lives in a cookie that is `httpOnly`, `secure`, `sameSite`, and
  `path=/`.
- Every Appwrite SDK call happens on the server: inside TanStack Start server
  functions or server route handlers only. `node-appwrite` must never end up in
  a browser bundle.
- No Appwrite client SDK session handling in the browser. The browser talks to
  our own server functions; only the server talks to Appwrite.
- `APPWRITE_API_KEY` is read from `process.env` in server code only, and is
  never passed through a response body, a loader return value, or an error
  message.

## Profile data

- Profile data goes only through the `personal-account` Appwrite Function.
- Never read or write the `personal_accounts` table directly from the web app —
  no `TablesDB` calls against it from app code, ever. The Function is the only
  writer.
- The caller's identity comes from the Appwrite session the Function execution
  runs under (`x-appwrite-user-id`). Never send a user id from the client and
  never let one influence whose profile is read or written.

## SSR and the header

- The header must be correct on the very first paint after a hard refresh:
  either "Sign in", or the person's first name plus a "Log out" button.
- Auth state is resolved server-side during SSR, before HTML is sent. It is not
  fetched on the client and hydrated in after the fact.
- No flash of "Sign in" for a signed-in user, and no flash of a name for a
  signed-out one. If you cannot see the correct header in `view-source` of the
  first response, it is wrong.
- If loading the current user fails for any reason, treat the person as signed
  out: clear the session cookie and render sign-in.

## Git

- Commit granularly, with clear messages. One logical change per commit.
- Never squash. The full history is part of what is being reviewed.
- Never commit `.env` or any real credential.

## Code style

- Prefer boring, readable code over clever code. Every line has to be defensible
  out loud in an interview, without an agent present.
- No speculative abstraction, no indirection that saves typing but costs
  understanding. Small, obvious functions with honest names.
- Types over `any`. Validate input at the server boundary with zod.
- Match the surrounding code's idiom, comment density, and naming. Comments
  explain *why*, not *what*.

## Working process

- After each phase, stop and explain what was done and why before moving on.
  Do not chain phases together without checking in.
- Do not write application code during a research or planning phase.
- If something in the brief is wrong or unsafe, do not follow it silently: do
  the right thing and record the disagreement in `NOTES.md`.
