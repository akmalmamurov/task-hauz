/**
 * Sign in with an email code, and reading back who is signed in.
 *
 * Two secrets pass through here and neither is allowed to leave the server.
 *
 *   The token secret, the code from the email. Appwrite returns it in the
 *   createEmailToken response when the call is made with an API key. We use
 *   only token.userId and drop the rest; the visitor gets the code by email,
 *   as they should.
 *
 *   The session secret, returned by createSession, again only because the call
 *   is key-authorised. It goes straight into the httpOnly cookie and is never
 *   part of a return value.
 *
 * The pending user id between the two steps also stays in an httpOnly cookie
 * rather than round-tripping through the browser. If the browser chose the
 * user id, anyone could point step two at someone else's account and start
 * guessing codes against it.
 */

import { createServerFn } from '@tanstack/react-start'
import { AppwriteException, ID } from 'node-appwrite'
import { z } from 'zod'

import { adminAccount, sessionAccount } from './appwrite'
import { resolveCurrentUser, type CurrentUser } from './current-user'
import {
  clearPendingSignIn,
  clearSessionSecret,
  readPendingSignIn,
  readSessionSecret,
  writePendingSignIn,
  writeSessionSecret,
} from './session'

export type { CurrentUser }

const emailInput = z.object({
  email: z.email().max(254),
})

const codeInput = z.object({
  // Appwrite's email codes are six digits. Checked here so an obvious typo
  // never costs an Appwrite round trip, and never counts against the rate
  // limit on token attempts.
  code: z
    .string()
    .trim()
    .regex(/^[0-9]{6}$/, 'Enter the six digit code from your email.'),
})

/**
 * Step one. Appwrite creates the user if this email is new, and ignores the
 * generated id if the email already has an account, so new and returning
 * people go through exactly the same call.
 */
export const requestEmailCode = createServerFn({ method: 'POST' })
  .validator(emailInput)
  .handler(async ({ data }) => {
    const token = await adminAccount().createEmailToken({
      userId: ID.unique(),
      email: data.email,
    })

    // token.secret is the emailed code. It is deliberately not read.
    writePendingSignIn({ userId: token.userId, email: data.email }, token.expire)

    return { email: data.email }
  })

/** Which step /signin should render, resolved on the server so a reload works. */
export const getPendingSignIn = createServerFn({ method: 'GET' }).handler(
  async () => {
    const pending = readPendingSignIn()

    return pending ? { email: pending.email } : null
  },
)

export const cancelSignIn = createServerFn({ method: 'POST' }).handler(
  async () => {
    clearPendingSignIn()

    return null
  },
)

/**
 * Step two. The code is exchanged for a session, whose secret goes into the
 * cookie and nowhere else.
 */
export const verifyEmailCode = createServerFn({ method: 'POST' })
  .validator(codeInput)
  .handler(async ({ data }) => {
    const pending = readPendingSignIn()
    if (!pending) {
      return { ok: false as const, message: 'That code has expired. Start again.' }
    }

    try {
      const session = await adminAccount().createSession({
        userId: pending.userId,
        secret: data.code,
      })

      writeSessionSecret(session.secret, session.expire)
      clearPendingSignIn()

      return { ok: true as const }
    } catch (error) {
      // A wrong or expired code is a 401 and is the visitor's to fix. Keep the
      // pending cookie so they can retry without asking for a new code.
      if (error instanceof AppwriteException && error.code === 401) {
        return {
          ok: false as const,
          message: 'That code is not right, or it has expired.',
        }
      }

      if (error instanceof AppwriteException && error.code === 429) {
        return {
          ok: false as const,
          message: 'Too many attempts. Wait a moment and try again.',
        }
      }

      // Anything else is ours, not theirs. The detail is logged server-side;
      // returning it could serialize an Appwrite stack trace into the HTML.
      console.error('createSession failed', error)

      return {
        ok: false as const,
        message: 'We could not sign you in. Try again.',
      }
    }
  })

/**
 * The RPC wrapper for routes. Server-to-server callers use
 * resolveCurrentUser() from ./current-user directly, so they do not go through
 * the server function machinery, and so this module keeps no plain server-only
 * function of its own. See the note at the top of ./current-user.
 */
export const getCurrentUser = createServerFn({ method: 'GET' }).handler(
  async (): Promise<CurrentUser | null> => resolveCurrentUser(),
)

export const logout = createServerFn({ method: 'POST' }).handler(async () => {
  const secret = readSessionSecret()

  if (secret) {
    try {
      await sessionAccount(secret).deleteSession({ sessionId: 'current' })
    } catch (error) {
      // The cookie is cleared either way. A session we cannot delete server
      // side is worse left usable in the browser.
      console.error('Could not delete the Appwrite session', error)
    }
  }

  clearSessionSecret()
  clearPendingSignIn()

  return null
})
