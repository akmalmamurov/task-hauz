/**
 * Answers one question empirically: can a session alone execute the Function,
 * or does the API key's execution.write scope actually matter?
 *
 * It matters because the Function derives the caller from
 * `x-appwrite-user-id`, and Appwrite only injects that header when the
 * execution runs as a signed-in user. If a session is enough, the API key
 * never touches the Function and its execution.write scope is unnecessary.
 *
 * The discriminator is the Function's own status code, not the execution's:
 *
 *   404 not_found  -> Appwrite injected a user id; identity worked. The caller
 *                     simply has no personal account yet, which is correct for
 *                     a throwaway user.
 *   401 unauthorized -> no user id was injected; that auth mode cannot be used.
 *
 * Run it with:
 *   node --env-file=.env scripts/probe-function-auth.js
 *
 * It creates a throwaway Appwrite user, reads nothing else, and deletes it
 * again. Nothing is written to the personal_accounts table.
 */

import { Account, Client, Functions, ID, Users } from 'node-appwrite'

const {
  APPWRITE_ENDPOINT: endpoint,
  APPWRITE_PROJECT_ID: projectId,
  APPWRITE_API_KEY: apiKey,
  APPWRITE_FUNCTION_ID: functionId = 'personal-account',
} = process.env

for (const [name, value] of Object.entries({ endpoint, projectId, apiKey })) {
  if (!value) {
    console.error(`Missing ${name}. Run with: node --env-file=.env ${process.argv[1]}`)
    process.exit(1)
  }
}

const base = () => new Client().setEndpoint(endpoint).setProject(projectId)

async function execute(label, client) {
  try {
    const execution = await new Functions(client).createExecution({
      functionId,
      method: 'GET',
      xpath: '/personal-account',
    })

    // Both statuses, side by side, because conflating them is the whole trap:
    // a Function that answers 401 still produces status 'completed'.
    console.log(`\n${label}`)
    console.log(`  execution.status       ${execution.status}`)
    console.log(`  responseStatusCode     ${execution.responseStatusCode}`)
    console.log(`  responseBody           ${execution.responseBody || '(empty)'}`)

    if (execution.responseStatusCode === 404) {
      console.log('  -> identity WORKED (the Function saw a signed-in user)')
    } else if (execution.responseStatusCode === 401) {
      console.log('  -> identity DID NOT work (no x-appwrite-user-id injected)')
    }
  } catch (error) {
    console.log(`\n${label}`)
    console.log(`  threw before the Function ran: ${error.code ?? ''} ${error.type ?? ''} ${error.message}`)
  }
}

const users = new Users(base().setKey(apiKey))
const email = `probe-${Date.now()}@hauz.invalid`
let userId

try {
  const user = await users.create({ userId: ID.unique(), email })
  userId = user.$id
  console.log(`Created throwaway user ${userId}`)

  // The token secret comes back in the response because this call is
  // key-authorised, which is what lets the probe skip the emailed code.
  const adminAccountClient = new Account(base().setKey(apiKey))
  const token = await adminAccountClient.createEmailToken({ userId, email })
  const session = await adminAccountClient.createSession({
    userId,
    secret: token.secret,
  })

  await execute('A. session only (setSession)', base().setSession(session.secret))
  await execute('B. API key only (setKey)', base().setKey(apiKey))
  await execute(
    'C. both (setKey + setSession)',
    base().setKey(apiKey).setSession(session.secret),
  )
} catch (error) {
  console.error('\nProbe failed:', error.code ?? '', error.type ?? '', error.message)
  process.exitCode = 1
} finally {
  if (userId) {
    await users.delete({ userId }).catch(() => {})
    console.log(`\nDeleted throwaway user ${userId}`)
  }
}
