/**
 * The two cookies this app sets, and the only place either is named.
 *
 * `hauz_session` holds the Appwrite session secret. It is httpOnly, so browser
 * JavaScript cannot read it. That is the whole point: the secret travels
 * between the browser and our server automatically, and never passes through
 * anything a script can reach. It is not in a global, not in the SSR payload,
 * not in localStorage.
 *
 * `hauz_pending_signin` holds which account the emailed code belongs to, for
 * the few minutes between asking for a code and entering it. It is httpOnly
 * too, so the browser cannot point step two at a different account and start
 * guessing codes against it.
 *
 * Both are produced and cleared through one options function, so the flags
 * cannot drift between the place that sets a cookie and the place that clears
 * it. A mismatch there leaves a second cookie under a different scope and the
 * person stays signed in after logging out.
 */

import {
  deleteCookie,
  getCookie,
  getRequestProtocol,
  setCookie,
} from '@tanstack/react-start/server'
import type { CookieSerializeOptions } from 'cookie-es'

const SESSION_COOKIE = 'hauz_session'
const PENDING_COOKIE = 'hauz_pending_signin'

/**
 * `secure` is dropped on plain http so the cookie still works on
 * http://localhost during development; a browser rejects a `secure` cookie
 * from an insecure origin. Production is https, so it is set there.
 */
function cookieOptions(): CookieSerializeOptions {
  return {
    httpOnly: true,
    secure: getRequestProtocol() === 'https',
    // `lax` rather than `strict`: with `strict` a visitor arriving from an
    // external link sends no cookie on that first navigation, so the first
    // paint would show "Sign in" to someone who is signed in. `lax` still
    // withholds the cookie on cross-site POSTs, which is the case that
    // matters.
    sameSite: 'lax',
    path: '/',
  }
}

export function readSessionSecret(): string | undefined {
  const value = getCookie(SESSION_COOKIE)

  // An empty cookie is not a session. Treat it as absent rather than handing
  // an empty secret to Appwrite.
  return value ? value : undefined
}

export function writeSessionSecret(secret: string, expiresAt: string): void {
  setCookie(SESSION_COOKIE, secret, {
    ...cookieOptions(),
    // Match the cookie's lifetime to the Appwrite session's, so the browser
    // stops sending a secret we already know is expired.
    expires: new Date(expiresAt),
  })
}

/**
 * Clearing has to repeat the same path and flags, otherwise the browser keeps
 * a second cookie under a different scope and the person stays signed in.
 */
export function clearSessionSecret(): void {
  deleteCookie(SESSION_COOKIE, cookieOptions())
}

/** Which account the emailed code belongs to, between the two sign-in steps. */
export type PendingSignIn = {
  userId: string
  email: string
}

export function readPendingSignIn(): PendingSignIn | undefined {
  const value = getCookie(PENDING_COOKIE)
  if (!value) {
    return undefined
  }

  // The cookie is ours and httpOnly, but it is still input: an old cookie from
  // a previous shape, or a truncated one, must not throw during SSR.
  try {
    const parsed: unknown = JSON.parse(value)

    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      'userId' in parsed &&
      'email' in parsed &&
      typeof parsed.userId === 'string' &&
      typeof parsed.email === 'string'
    ) {
      return { userId: parsed.userId, email: parsed.email }
    }
  } catch {
    // Fall through and treat it as absent.
  }

  return undefined
}

export function writePendingSignIn(
  pending: PendingSignIn,
  expiresAt: string,
): void {
  setCookie(PENDING_COOKIE, JSON.stringify(pending), {
    ...cookieOptions(),
    // Appwrite's email codes last 15 minutes; expire with them.
    expires: new Date(expiresAt),
  })
}

export function clearPendingSignIn(): void {
  deleteCookie(PENDING_COOKIE, cookieOptions())
}
