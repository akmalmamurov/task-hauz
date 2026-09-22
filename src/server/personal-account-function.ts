/**
 * The only way this app talks to the personal-account Function.
 *
 * It exists to make one mistake impossible. An Appwrite execution carries two
 * different "statuses" and they mean unrelated things:
 *
 *   execution.status          did Appwrite manage to run the container at all
 *                             (waiting | processing | completed | failed |
 *                             scheduled)
 *   execution.responseStatusCode  what our Function itself answered
 *
 * A Function replying 401 or 409 still produces status 'completed', because
 * the code ran and returned a response. And when status is 'failed', the
 * response status code is meaningless. So callers must branch only on the
 * Function's own code, never on the execution's.
 *
 * Models.Execution therefore does not leave this module. Callers get a result
 * type that has no execution-level status in it, so there is nothing to branch
 * on by accident.
 *
 * Two other things are deliberately absent from the public shape:
 *
 *   execution.logs and execution.errors are populated when the call is made
 *   with an API key and can carry a stack trace from inside the Function. They
 *   are logged server side and never returned; errors.js in the Function warns
 *   that an Appwrite stack trace has been observed to contain the project's
 *   API key.
 *
 *   `async`. responseBody is empty unless the execution is synchronous, so it
 *   is pinned rather than offered as an option.
 */

import { ExecutionMethod } from 'node-appwrite'
import type { ZodType } from 'zod'
import { z } from 'zod'

import { env } from './env'
import { sessionFunctions } from './appwrite'

/** Callers name the method as a plain string; the SDK wants its own enum. */
const EXECUTION_METHODS = {
  GET: ExecutionMethod.GET,
  POST: ExecutionMethod.POST,
  PATCH: ExecutionMethod.PATCH,
} as const

export type FunctionMethod = keyof typeof EXECUTION_METHODS

/** The error codes errors.js can produce. */
const FUNCTION_ERROR_CODES = [
  'unauthorized',
  'not_found',
  'invalid_request',
  'personal_account_inconsistent',
  'internal_error',
] as const

export type FunctionErrorCode = (typeof FUNCTION_ERROR_CODES)[number]

export type FunctionIssue = {
  field: string
  message: string
}

/**
 * `status: null` with `code: 'transport'` is the case where the Function never
 * produced an answer of its own: the container did not complete, the body was
 * not JSON, or it did not match the schema. It is kept distinct from a numeric
 * status so the two can never be compared by mistake.
 */
export type FunctionResult<T> =
  | { ok: true; status: number; data: T }
  | {
      ok: false
      status: number
      code: FunctionErrorCode
      message: string
      issues?: Array<FunctionIssue>
    }
  | { ok: false; status: null; code: 'transport'; message: string }

const errorBodySchema = z.object({
  error: z.string(),
  message: z.string(),
  issues: z
    .array(z.object({ field: z.string(), message: z.string() }))
    .optional(),
})

const TRANSPORT_MESSAGE = 'The profile service is unavailable. Try again.'

function transport<T>(reason: string, detail?: unknown): FunctionResult<T> {
  // The reason is for us, not for the visitor: it can quote an Appwrite
  // failure, and those are not safe to show or to serialize into the HTML.
  console.error(`personal-account Function: ${reason}`, detail ?? '')

  return { ok: false, status: null, code: 'transport', message: TRANSPORT_MESSAGE }
}

function knownCode(value: string): FunctionErrorCode | null {
  return FUNCTION_ERROR_CODES.includes(value as FunctionErrorCode)
    ? (value as FunctionErrorCode)
    : null
}

export async function callPersonalAccountFunction<T>(args: {
  /** Executing as the user is what makes Appwrite inject x-appwrite-user-id. */
  sessionSecret: string
  method: FunctionMethod
  body?: unknown
  /** The success body is parsed against this before it is allowed out. */
  expect: ZodType<T>
}): Promise<FunctionResult<T>> {
  const { sessionSecret, method, body, expect } = args

  let execution
  try {
    execution = await sessionFunctions(sessionSecret).createExecution({
      functionId: env.APPWRITE_FUNCTION_ID,
      method: EXECUTION_METHODS[method],
      xpath: '/personal-account',
      headers: { 'content-type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    })
  } catch (error) {
    return transport('createExecution threw', error)
  }

  // Execution level. Nothing about the Function's own answer is trustworthy
  // unless the container actually completed.
  if (execution.status !== 'completed') {
    return transport(`execution.status was ${execution.status}`, {
      logs: execution.logs,
      errors: execution.errors,
    })
  }

  let parsedBody: unknown
  try {
    parsedBody = JSON.parse(execution.responseBody)
  } catch {
    return transport('responseBody was not JSON', {
      responseStatusCode: execution.responseStatusCode,
    })
  }

  // From here on, only the Function's own status code is consulted.
  const status = execution.responseStatusCode

  if (status >= 200 && status < 300) {
    const success = expect.safeParse(parsedBody)
    if (!success.success) {
      // The Function's response shape changed under us. Better to stop here
      // than to let undefined spread through the UI.
      return transport('success body did not match the expected schema', {
        status,
        issues: success.error.issues,
      })
    }

    return { ok: true, status, data: success.data }
  }

  const errorBody = errorBodySchema.safeParse(parsedBody)
  if (!errorBody.success) {
    return transport('error body did not match the expected shape', { status })
  }

  const code = knownCode(errorBody.data.error)
  if (!code) {
    return transport(`unrecognised error code ${errorBody.data.error}`, { status })
  }

  return {
    ok: false,
    status,
    code,
    message: errorBody.data.message,
    ...(errorBody.data.issues ? { issues: errorBody.data.issues } : {}),
  }
}
