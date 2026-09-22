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

import { Button } from '@/components/ui/button'
import { PATH } from '@/constants/path'
import { useLogout } from '@/modules/auth'

import type { AccountState } from '@/types/personal-account'

export const Header = ({ state }: { state: AccountState }) => (
  <header className="border-b">
    <nav className="mx-auto flex h-14 w-full max-w-2xl items-center justify-between gap-4 px-4">
      <Link to={PATH.home} className="font-semibold tracking-tight">
        HAUZ
      </Link>

      {state.status === 'signed-out' ? (
        <Button asChild variant="ghost" size="sm">
          <Link to={PATH.signIn}>Sign in</Link>
        </Button>
      ) : (
        <SignedIn state={state} />
      )}
    </nav>
  </header>
)

const SignedIn = ({ state }: { state: Exclude<AccountState, { status: 'signed-out' }> }) => (
  <div className="flex items-center gap-1">
    {/*
      'ready' is the normal case and the one TASK.md describes: the person's
      first name, linked to their profile.

      'onboarding' has no name to show yet, and 'unavailable' means we could
      not find out what it is. Neither may fall back to "Sign in": the person
      *is* signed in, and offering sign-in to someone who already has a
      session is both wrong and a dead end. So each says what is true instead.
    */}
    {state.status === 'ready' ? (
      <Button asChild variant="ghost" size="sm">
        <Link to={PATH.profile}>{state.account.firstName}</Link>
      </Button>
    ) : null}
    {state.status === 'onboarding' ? (
      <Button asChild variant="ghost" size="sm">
        <Link to={PATH.onboarding}>Finish setting up</Link>
      </Button>
    ) : null}
    {state.status === 'unavailable' ? (
      <span className="text-muted-foreground px-2 text-sm">Signed in</span>
    ) : null}

    <LogOutButton />
  </div>
)

const LogOutButton = () => {
  const logout = useLogout()

  return (
    <Button
      variant="outline"
      size="sm"
      isLoading={logout.isPending}
      onClick={() =>
        // On settled, not on success. If the call failed we still do not know
        // whether the cookie survived, and reloading is the way to find out:
        // a cleared cookie fixes the header, an intact one leaves the person
        // signed in and able to try again from a known state.
        logout.mutate(undefined, { onSettled: () => window.location.assign(PATH.home) })
      }
    >
      Log out
    </Button>
  )
}
