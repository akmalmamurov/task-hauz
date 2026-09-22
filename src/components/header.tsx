/**
 * The site header.
 *
 * It renders from state the root route already resolved on the server, so it
 * is correct in the very first byte of HTML. Nothing here fetches, and there
 * is no "loading" variant: a header that says "Sign in" for a moment and then
 * corrects itself is the exact bug TASK.md rules out.
 *
 * Log out is a real round trip rather than a link, because the session has to
 * be deleted at Appwrite as well as in the cookie. It finishes with a full
 * navigation so the next document is rendered by a server that can already
 * see the cookie is gone.
 */

import { Link } from '@tanstack/react-router'
import { useState } from 'react'

import type { AccountState } from '@/types/personal-account'
import { logout } from '@/server/auth'

export function Header({ state }: { state: AccountState }) {
  return (
    <header>
      <nav>
        <Link to="/">HAUZ</Link>
        {state.status === 'signed-out' ? (
          <Link to="/signin">Sign in</Link>
        ) : (
          <SignedIn state={state} />
        )}
      </nav>
    </header>
  )
}

function SignedIn({ state }: { state: Exclude<AccountState, { status: 'signed-out' }> }) {
  return (
    <>
      {/*
        'ready' is the normal case and the one TASK.md describes: the person's
        first name, linked to their profile.

        'onboarding' has no name to show yet, and 'unavailable' means we could
        not find out what it is. Neither may fall back to "Sign in": the person
        *is* signed in, and offering sign-in to someone who already has a
        session is both wrong and a dead end. So each says what is true instead.
      */}
      {state.status === 'ready' ? (
        <Link to="/profile">{state.account.firstName}</Link>
      ) : null}
      {state.status === 'onboarding' ? (
        <Link to="/onboarding">Finish setting up</Link>
      ) : null}
      {state.status === 'unavailable' ? <span>Signed in</span> : null}

      <LogOutButton />
    </>
  )
}

function LogOutButton() {
  const [submitting, setSubmitting] = useState(false)

  async function onClick() {
    setSubmitting(true)

    try {
      await logout()
    } catch {
      // The server function failed to reach us or Appwrite. Reloading is still
      // the right move: if the cookie was cleared the header corrects itself,
      // and if it was not the person can try again from a known state.
    }

    window.location.assign('/')
  }

  return (
    <button type="button" onClick={onClick} disabled={submitting}>
      {submitting ? 'Logging out...' : 'Log out'}
    </button>
  )
}
