import { zodResolver } from '@hookform/resolvers/zod'
import { createFileRoute, redirect, useRouter } from '@tanstack/react-router'
import { useForm } from 'react-hook-form'
import { z } from 'zod'

import { Page } from '@/components/page'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp'
import { EMAIL_CODE_LENGTH, EMAIL_CODE_TTL_MINUTES } from '@/constants'
import { PATH } from '@/constants/path'
import { useFormErrors } from '@/hooks/use-form-errors'
import {
  codeFormSchema,
  emailFormSchema,
  useCancelSignIn,
  useRequestEmailCode,
  useVerifyEmailCode,
  type CodeFormValues,
  type EmailFormValues,
} from '@/modules/auth'
import { getPendingSignIn } from '@/server/auth'
import { safeRedirect } from '@/utils/safe-redirect'

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

  return <Page>{pending ? <CodeStep email={pending.email} /> : <EmailStep />}</Page>
}

function EmailStep() {
  const router = useRouter()
  const requestEmailCode = useRequestEmailCode()

  const form = useForm<EmailFormValues>({
    resolver: zodResolver(emailFormSchema),
    defaultValues: { email: '' },
  })

  const onSubmit = form.handleSubmit((values) =>
    requestEmailCode.mutate(values, {
      // Re-runs the loader, which now sees the pending cookie and renders the
      // code step.
      onSuccess: () => void router.invalidate(),
    }),
  )

  return (
    <Card className="mx-auto max-w-md">
      <CardHeader>
        <CardTitle>Sign in</CardTitle>
        <CardDescription>
          We will email you a {EMAIL_CODE_LENGTH} digit code.
        </CardDescription>
      </CardHeader>

      <Form {...form}>
        <form onSubmit={onSubmit}>
          <CardContent>
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input type="email" autoComplete="email" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>

          <CardFooter className="mt-6">
            <Button type="submit" isLoading={requestEmailCode.isPending}>
              Send code
            </Button>
          </CardFooter>
        </form>
      </Form>
    </Card>
  )
}

/** The only field the server can put an error on, so the only one we map. */
const CODE_FIELDS = ['code'] as const

function CodeStep({ email }: { email: string }) {
  const { target } = Route.useRouteContext()
  const router = useRouter()
  const verifyEmailCode = useVerifyEmailCode()
  const cancelSignIn = useCancelSignIn()

  const form = useForm<CodeFormValues>({
    resolver: zodResolver(codeFormSchema),
    defaultValues: { code: '' },
  })
  const applyErrors = useFormErrors(form, CODE_FIELDS)

  const onSubmit = form.handleSubmit((values) =>
    verifyEmailCode.mutate(values, {
      onSuccess: () => {
        // Everyone goes via /onboarding, and its beforeLoad decides: someone
        // who already has an account is redirected straight on to `target`,
        // server side, before anything paints. Keeping that decision in one
        // place beats asking the same question here as well.
        //
        // A full navigation, so the next document is rendered by a server that
        // can see the new session cookie. That is what makes the header
        // correct on the first paint of the destination.
        window.location.assign(PATH.onboardingWithRedirect(target))
      },
      // A wrong or expired code comes back as an issue on `code`, so it lands
      // under the input instead of in a toast above it.
      onError: applyErrors,
    }),
  )

  return (
    <Card className="mx-auto max-w-md">
      <CardHeader>
        <CardTitle>Enter your code</CardTitle>
        <CardDescription>
          We emailed a {EMAIL_CODE_LENGTH} digit code to{' '}
          <strong className="text-foreground font-medium">{email}</strong>. It is valid for{' '}
          {EMAIL_CODE_TTL_MINUTES} minutes, and it may land in your spam folder.
        </CardDescription>
      </CardHeader>

      <Form {...form}>
        <form onSubmit={onSubmit}>
          <CardContent>
            <FormField
              control={form.control}
              name="code"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Code</FormLabel>
                  <FormControl>
                    <InputOTP maxLength={EMAIL_CODE_LENGTH} autoComplete="one-time-code" {...field}>
                      <InputOTPGroup>
                        {Array.from({ length: EMAIL_CODE_LENGTH }, (_, index) => (
                          <InputOTPSlot key={index} index={index} />
                        ))}
                      </InputOTPGroup>
                    </InputOTP>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>

          <CardFooter className="mt-6 gap-2">
            <Button type="submit" isLoading={verifyEmailCode.isPending}>
              Continue
            </Button>
            <Button
              type="button"
              variant="ghost"
              isLoading={cancelSignIn.isPending}
              onClick={() =>
                cancelSignIn.mutate(undefined, {
                  onSuccess: () => void router.invalidate(),
                })
              }
            >
              Use a different email
            </Button>
          </CardFooter>
        </form>
      </Form>
    </Card>
  )
}
