import { Link, createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/')({ component: Home })

/**
 * A landing page only, so there is somewhere to come back to after signing in
 * and somewhere to see the header from. The account state it reads is the one
 * the root route already resolved, so this page costs nothing extra.
 */
function Home() {
  const { accountState } = Route.useRouteContext()

  return (
    <main>
      <h1>HAUZ</h1>

      {accountState.status === 'signed-out' ? (
        <p>
          <Link to="/signin">Sign in</Link> with your email address. We send a
          six digit code, there is no password.
        </p>
      ) : (
        <p>
          You are signed in. <Link to="/profile">Your profile</Link>.
        </p>
      )}
    </main>
  )
}
