/**
 * Server-only configuration.
 *
 * Importing this module from anything that reaches the browser is a bug: it
 * reads the Appwrite API key. Nothing here has a VITE_ prefix, so Vite will
 * not inline these values, but that is a safety net and not the rule. The rule
 * is that only files under src/server import this.
 */

import { z } from 'zod'

const envSchema = z.object({
  APPWRITE_ENDPOINT: z.url(),
  APPWRITE_PROJECT_ID: z.string().min(1),
  APPWRITE_API_KEY: z.string().min(1),
  APPWRITE_FUNCTION_ID: z.string().min(1),
})

/**
 * Validated once, at first import, so a missing variable is a startup failure
 * with a readable message rather than an Appwrite 401 halfway through sign-in.
 */
function readEnv() {
  const parsed = envSchema.safeParse(process.env)

  if (!parsed.success) {
    const missing = parsed.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('\n  ')

    // The names are safe to print. The values are not, and are not printed.
    throw new Error(`Invalid Appwrite environment:\n  ${missing}`)
  }

  return parsed.data
}

export const env = readEnv()
