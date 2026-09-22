import { Link, createFileRoute } from '@tanstack/react-router'

import { Page } from '@/components/page'
import { Button } from '@/components/ui/button'
import { PATH } from '@/constants/path'

export const Route = createFileRoute('/')({ component: Home })

/**
 * A landing page only, so there is somewhere to come back to after signing in
 * and somewhere to see the header from. The account state it reads is the one
 * the root route already resolved, so this page costs nothing extra.
 */
function Home() {
  const { accountState } = Route.useRouteContext()

  return (
    <Page className="flex flex-col items-start gap-4">
      <h1 className="text-3xl font-semibold tracking-tight">HAUZ</h1>

      {accountState.status === 'signed-out' ? (
        <>
          <p className="text-muted-foreground">
            Sign in with your email address. We send a six digit code, there is
            no password.
          </p>
          <Button asChild>
            <Link to={PATH.signIn}>Sign in</Link>
          </Button>
        </>
      ) : (
        <>
          <p className="text-muted-foreground">You are signed in.</p>
          <Button asChild>
            <Link to={PATH.profile}>Your profile</Link>
          </Button>
        </>
      )}
    </Page>
  )
}
