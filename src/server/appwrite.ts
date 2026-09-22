/**
 * Two ways to reach Appwrite, kept apart on purpose.
 *
 * `adminClient()` carries the project API key. It can act on any user, so it
 * is only ever used where there is no caller yet: issuing an email token and
 * exchanging it for a session.
 *
 * `userClient(secret)` carries a session secret and acts *as* that user.
 * Appwrite resolves the session itself, which is what makes the caller's
 * identity something we read rather than something we assert. Everything done
 * on behalf of a signed-in person goes through this one.
 *
 * Mixing them up is the whole class of bug this split exists to prevent, so
 * neither client is exported directly as a singleton.
 */

import { Account, Client, Functions, Users } from 'node-appwrite'

import { env } from './env'

function baseClient(): Client {
  return new Client()
    .setEndpoint(env.APPWRITE_ENDPOINT)
    .setProject(env.APPWRITE_PROJECT_ID)
}

function adminClient(): Client {
  return baseClient().setKey(env.APPWRITE_API_KEY)
}

function userClient(sessionSecret: string): Client {
  return baseClient().setSession(sessionSecret)
}

/** Key-authorised. Creates email tokens and exchanges them for sessions. */
export function adminAccount(): Account {
  return new Account(adminClient())
}

/** Key-authorised. Reads and creates the Appwrite User behind an email. */
export function adminUsers(): Users {
  return new Users(adminClient())
}

/** Session-authorised. Reads and ends the caller's own session. */
export function sessionAccount(sessionSecret: string): Account {
  return new Account(userClient(sessionSecret))
}

/**
 * Session-authorised. Executing the Function this way is what makes Appwrite
 * inject `x-appwrite-user-id`, which is the only identity the Function trusts.
 * An API key would execute without a signed-in user and the Function would
 * answer 401.
 */
export function sessionFunctions(sessionSecret: string): Functions {
  return new Functions(userClient(sessionSecret))
}
