/**
 * The Personal Account as the app sees it.
 *
 * Shared by the server functions and the routes, so the schema that validates
 * what the Function returned is the same one the UI is typed against. It is
 * the shape describe() builds in the Function's handlers.js.
 *
 * Nothing secret is in here, so it is safe on the client and safe to render.
 */

import { z } from 'zod'

export const PERSONAL_ROLES = ['property_owner', 'realtor'] as const

export type PersonalRole = (typeof PERSONAL_ROLES)[number]

/** Role is chosen once, at onboarding, and cannot be changed afterwards. */
export const ROLE_LABELS: Record<PersonalRole, string> = {
  property_owner: 'Property owner',
  realtor: 'Realtor',
}

export const personalAccountSchema = z.object({
  personalAccountId: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  role: z.enum(PERSONAL_ROLES),
  // Cleared optional fields read back as null, never as "".
  contactEmail: z.string().nullable(),
  bio: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

export type PersonalAccount = z.infer<typeof personalAccountSchema>

/**
 * What the app knows about the caller, resolved server side.
 *
 * `unavailable` is a separate state on purpose, and it is the one that matters
 * most. If a transient failure were folded into `onboarding` then a backend
 * blip would march an existing member into onboarding, where picking a role
 * would earn them a 409 and no way forward. "We could not find out" is not the
 * same answer as "there is nothing to find".
 */
export type AccountState =
  | { status: 'signed-out' }
  | { status: 'onboarding'; email: string }
  | { status: 'ready'; email: string; account: PersonalAccount }
  | { status: 'unavailable'; email: string }
