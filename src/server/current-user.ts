/**
 * Resolving the caller from the session cookie.
 *
 * This lives in its own module, and not in auth.ts, for a build reason worth
 * knowing. Routes import auth.ts and personal-account.ts for their server
 * functions, and the TanStack Start plugin strips server function *bodies*
 * from the client build, taking their imports with them. A plain exported
 * function in one of those modules survives that stripping, so anything it
 * imports gets pulled into the client graph. A plain resolveCurrentUser in
 * auth.ts dragged @tanstack/react-start/server in behind it and the build
 * refused it, correctly.
 *
 * So the rule this module encodes: server-only plain functions belong in
 * modules that routes never import, and route-facing server modules reference
 * them only from inside a handler.
 */

import { AppwriteException } from 'node-appwrite'

import { sessionAccount } from './appwrite'
import { clearSessionSecret, readSessionSecret } from './session'

/** What a route is allowed to know about the caller. No secrets in here. */
export type CurrentUser = {
  id: string
  email: string
}

/**
 * Appwrite told us this session is not a session. Anything else, a timeout, a
 * 5xx, a rate limit, says nothing about the visitor and must not cost them
 * their sign-in.
 */
function isDefinitivelyInvalid(error: unknown): boolean {
  if (!(error instanceof AppwriteException)) {
    return false
  }

  return error.code === 401 || error.code === 403 || error.code === 404
}

/**
 * Who is signed in, for SSR.
 *
 * TASK.md says to treat any failure as signed out and delete the cookie. The
 * first half is right and is what happens here: an unresolved visitor renders
 * as signed out, so nothing personal is ever shown on a guess.
 *
 * Deleting the cookie on *any* failure is not right. A timeout or a 502 says
 * nothing about the visitor, and throwing their session away would force them
 * back through an email code that Appwrite Cloud rate limits. So the cookie is
 * only cleared when Appwrite has told us the session is invalid.
 */
export async function resolveCurrentUser(): Promise<CurrentUser | null> {
  const secret = readSessionSecret()
  if (!secret) {
    return null
  }

  try {
    const user = await sessionAccount(secret).get()

    return { id: user.$id, email: user.email }
  } catch (error) {
    if (isDefinitivelyInvalid(error)) {
      clearSessionSecret()

      return null
    }

    // Transient. Render as signed out, but leave the cookie alone so the next
    // request can succeed without another email code.
    console.error('Could not resolve the current user', error)

    return null
  }
}
