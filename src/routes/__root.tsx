import type { QueryClient } from '@tanstack/react-query'
import {
  HeadContent,
  Outlet,
  Scripts,
  createRootRouteWithContext,
} from '@tanstack/react-router'

import { Header } from '../components/header'
import type { AccountState } from '../lib/personal-account'
import { getAccountState } from '../server/personal-account'

import appCss from '../styles.css?url'

export interface RouterContext {
  queryClient: QueryClient
}

/**
 * Who is signed in is resolved here, in the root route's beforeLoad, and for
 * two reasons.
 *
 * It runs on the server before any HTML is produced, and the router waits for
 * it, so the header is right in the first response rather than corrected after
 * hydration. `view-source` on a hard refresh shows the name, not "Sign in".
 *
 * And it runs once per navigation for the whole tree. Putting it in context
 * rather than in each route's loader is what stops /profile and /onboarding
 * asking Appwrite the same question a second time on the same request.
 *
 * beforeLoad rather than loader because child routes need the answer *in their
 * own* beforeLoad, to redirect a signed-out visitor before their page renders.
 * Loader data is not available there; context is.
 */
export const Route = createRootRouteWithContext<RouterContext>()({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'HAUZ' },
    ],
    links: [{ rel: 'stylesheet', href: appCss }],
  }),
  beforeLoad: async (): Promise<{ accountState: AccountState }> => ({
    accountState: await getAccountState(),
  }),
  shellComponent: RootDocument,
  component: RootLayout,
})

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  )
}

function RootLayout() {
  const { accountState } = Route.useRouteContext()

  return (
    <>
      <Header state={accountState} />
      <Outlet />
    </>
  )
}
