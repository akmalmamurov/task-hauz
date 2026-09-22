import { createFileRoute, redirect, useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import { z } from 'zod'

import { safeRedirect } from '../lib/safe-redirect'
import {
  cancelSignIn,
  getPendingSignIn,
  requestEmailCode,
  verifyEmailCode,
} from '../server/auth'

/**
 * `redirect` is whatever was in the URL, so it is untrusted until safeRedirect
 * has seen it. It is kept as a loose string here and validated in beforeLoad
 * rather than in the schema, so a hostile value lands the visitor on "/"
 * instead of failing the route.
 */
const searchSchema = z.object({
  redirect: z.string().optional(),
})

export const Route = createFileRoute('/signin')({
  validateSearch: searchSchema,
  beforeLoad: ({ search, context }) => {
    const target = safeRedirect(search.redirect)

    // Someone already signed in has no business on this page: offering them a
    // second sign-in is confusing and creates a redundant Appwrite session.
    // safeRedirect refuses /signin as a target, so this cannot bounce.
    //
    // The root route already asked who is signed in, on this same request, so
    // this reads its answer instead of asking Appwrite again.
    if (context.accountState.status !== 'signed-out') {
      throw redirect({ href: target })
    }

    return { target }
  },
  // Which step to render is resolved on the server from the pending cookie, so
  // a hard refresh of the code screen stays on the code screen.
  loader: async () => ({ pending: await getPendingSignIn() }),
  component: SignIn,
})

function SignIn() {
  const { pending } = Route.useLoaderData()

  return pending ? <CodeStep email={pending.email} /> : <EmailStep />
}

function EmailStep() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    setSubmitting(true)

    try {
      await requestEmailCode({ data: { email } })

      // Re-runs the loader, which now sees the pending cookie and renders the
      // code step.
      await router.invalidate()
    } catch {
      setError('We could not send a code to that address. Check it and retry.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main>
      <h1>Sign in</h1>
      <p>We will email you a six digit code.</p>

      <form onSubmit={onSubmit}>
        <label htmlFor="email">Email</label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />

        <button type="submit" disabled={submitting}>
          {submitting ? 'Sending...' : 'Send code'}
        </button>
      </form>

      {error ? <p role="alert">{error}</p> : null}
    </main>
  )
}

function CodeStep({ email }: { email: string }) {
  const { target } = Route.useRouteContext()
  const router = useRouter()
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    setSubmitting(true)

    try {
      const result = await verifyEmailCode({ data: { code } })

      if (!result.ok) {
        setError(result.message)
        return
      }

      // Everyone goes via /onboarding, and its loader decides: someone who
      // already has an account is redirected straight on to `target`, server
      // side, before anything paints. Keeping that decision in one place beats
      // asking the same question here as well.
      //
      // A full navigation, so the next document is rendered by a server that
      // can see the new session cookie. That is what makes the header correct
      // on the first paint of the destination.
      window.location.assign(
        `/onboarding?redirect=${encodeURIComponent(target)}`,
      )
    } catch {
      setError('Enter the six digit code from your email.')
    } finally {
      setSubmitting(false)
    }
  }

  async function onUseAnotherEmail() {
    await cancelSignIn()
    await router.invalidate()
  }

  return (
    <main>
      <h1>Enter your code</h1>
      <p>
        We emailed a six digit code to <strong>{email}</strong>. It is valid for
        15 minutes, and it may land in your spam folder.
      </p>

      <form onSubmit={onSubmit}>
        <label htmlFor="code">Code</label>
        <input
          id="code"
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          required
          value={code}
          onChange={(event) => setCode(event.target.value)}
        />

        <button type="submit" disabled={submitting}>
          {submitting ? 'Checking...' : 'Continue'}
        </button>
      </form>

      {error ? <p role="alert">{error}</p> : null}

      <button type="button" onClick={onUseAnotherEmail}>
        Use a different email
      </button>
    </main>
  )
}
