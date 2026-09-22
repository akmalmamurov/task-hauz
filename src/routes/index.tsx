import { Link, createFileRoute } from '@tanstack/react-router'

import { Page } from '@/components/page'
import { Button } from '@/components/ui/button'
import { EMAIL_CODE_LENGTH } from '@/constants'
import { PATH } from '@/constants/path'

export const Route = createFileRoute('/')({ component: Home })

const HOW_IT_WORKS = [
  'Give us your email address.',
  `Type the ${EMAIL_CODE_LENGTH} digit code we send you.`,
  'Fill in your name and role once, then edit your profile whenever you like.',
]

/**
 * A landing page only, so there is somewhere to come back to after signing in
 * and somewhere to see the header from. The account state it reads is the one
 * the root route already resolved, so this page costs nothing extra.
 */
function Home() {
  const { accountState } = Route.useRouteContext()

  return (
    <Page className="flex min-h-[calc(100dvh-8.5rem)] flex-col justify-center gap-8">
      <div className="flex flex-col items-start gap-4">
        <h1 className="text-4xl font-semibold tracking-tight">HAUZ</h1>

        {accountState.status === 'signed-out' ? (
          <>
            <p className="text-muted-foreground max-w-prose text-lg">
              Sign in with your email address. We send a {EMAIL_CODE_LENGTH} digit code,
              there is no password to remember.
            </p>
            <Button asChild size="lg">
              <Link to={PATH.signIn}>Sign in</Link>
            </Button>
          </>
        ) : (
          <>
            <p className="text-muted-foreground max-w-prose text-lg">
              {accountState.status === 'ready'
                ? `You are signed in as ${accountState.account.firstName}.`
                : 'You are signed in.'}
            </p>
            <Button asChild size="lg">
              <Link to={accountState.status === 'onboarding' ? PATH.onboarding : PATH.profile}>
                {accountState.status === 'onboarding' ? 'Finish setting up' : 'Your profile'}
              </Link>
            </Button>
          </>
        )}
      </div>

      {accountState.status === 'signed-out' ? (
        <ol className="text-muted-foreground grid gap-3 border-t pt-8 text-sm">
          {HOW_IT_WORKS.map((line, index) => (
            <li key={line} className="flex items-center gap-3">
              <span className="text-foreground flex size-6 shrink-0 items-center justify-center rounded-full border text-xs font-medium">
                {index + 1}
              </span>
              {line}
            </li>
          ))}
        </ol>
      ) : null}
    </Page>
  )
}
