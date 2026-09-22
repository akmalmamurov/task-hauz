/**
 * Profile reads and writes, all of them through the Function.
 *
 * The web app never touches the personal_accounts table. The Function owns
 * that table, and it is also the only thing that enforces the invariants the
 * app depends on: one account per Appwrite user, and a role that cannot change
 * after creation.
 *
 * No user id is ever sent. TASK.md asks for the signed-in user's id to travel
 * with the changes, but the Function reads its caller from
 * x-appwrite-user-id and strips unknown body keys, so sending one would be
 * dead weight that teaches the next reader the wrong model. Worse, if someone
 * later "fixed" the Function to honour it, every user could edit every other
 * user's profile.
 */

import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

import {
  PERSONAL_ROLES,
  personalAccountSchema,
  type AccountState,
} from '../lib/personal-account'
import { resolveCurrentUser } from './current-user'
import { callPersonalAccountFunction } from './personal-account-function'
import { readSessionSecret } from './session'

const createInput = z.object({
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100),
  role: z.enum(PERSONAL_ROLES),
})

/**
 * Mirrors what buildProfilePatch produces: all four fields every time, with
 * null meaning "cleared". firstName and lastName are not nullable because
 * their columns are required.
 */
const updateInput = z.object({
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100),
  contactEmail: z.email().max(254).nullable(),
  bio: z.string().trim().min(1).max(2000).nullable(),
})

/**
 * Who the caller is and whether they have onboarded, in one server round trip,
 * for SSR. Routes read this rather than assembling it themselves.
 */
export const getAccountState = createServerFn({ method: 'GET' }).handler(
  async (): Promise<AccountState> => {
    const user = await resolveCurrentUser()
    if (!user) {
      return { status: 'signed-out' }
    }

    // getCurrentUser already proved the session resolves, so the cookie is
    // there; read it again rather than passing a secret through a return value.
    const secret = readSessionSecret()
    if (!secret) {
      return { status: 'signed-out' }
    }

    const result = await callPersonalAccountFunction({
      sessionSecret: secret,
      method: 'GET',
      expect: personalAccountSchema,
    })

    if (result.ok) {
      return { status: 'ready', email: user.email, account: result.data }
    }

    // 404 is the normal answer for someone who has not onboarded yet.
    if (result.code === 'not_found') {
      return { status: 'onboarding', email: user.email }
    }

    // The session was fine a moment ago, so a 401 here means it has just gone.
    if (result.code === 'unauthorized') {
      return { status: 'signed-out' }
    }

    return { status: 'unavailable', email: user.email }
  },
)

export const createPersonalAccount = createServerFn({ method: 'POST' })
  .validator(createInput)
  .handler(async ({ data }) => {
    const secret = readSessionSecret()
    if (!secret) {
      return {
        ok: false as const,
        code: 'unauthorized' as const,
        message: 'Sign in again to finish setting up.',
      }
    }

    const result = await callPersonalAccountFunction({
      sessionSecret: secret,
      method: 'POST',
      body: data,
      expect: personalAccountSchema,
    })

    if (result.ok) {
      // 201 created, or 200 because it already existed with this role. Both
      // are success: POST is idempotent, which is what actually stops a double
      // submit creating two accounts. The disabled button is only manners.
      return { ok: true as const, account: result.data }
    }

    return {
      ok: false as const,
      code: result.code,
      message: result.message,
      ...(result.code !== 'transport' && result.issues
        ? { issues: result.issues }
        : {}),
    }
  })

export const updatePersonalAccount = createServerFn({ method: 'POST' })
  .validator(updateInput)
  .handler(async ({ data }) => {
    const secret = readSessionSecret()
    if (!secret) {
      return {
        ok: false as const,
        code: 'unauthorized' as const,
        message: 'Sign in again to save your changes.',
      }
    }

    const result = await callPersonalAccountFunction({
      sessionSecret: secret,
      method: 'PATCH',
      body: data,
      expect: personalAccountSchema,
    })

    if (result.ok) {
      return { ok: true as const, account: result.data }
    }

    return {
      ok: false as const,
      code: result.code,
      message: result.message,
      ...(result.code !== 'transport' && result.issues
        ? { issues: result.issues }
        : {}),
    }
  })
