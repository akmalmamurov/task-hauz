import { zodResolver } from '@hookform/resolvers/zod'
import { createFileRoute, redirect, useRouter } from '@tanstack/react-router'
import { useForm } from 'react-hook-form'

import { Page } from '@/components/page'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
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
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { PATH } from '@/constants/path'
import { useFormErrors } from '@/hooks/use-form-errors'
import { showError } from '@/lib/message'
import {
  profileFormSchema,
  useUpdatePersonalAccount,
  type ProfileFormValues,
} from '@/modules/personal-account'
import { ROLE_LABELS, type PersonalAccount } from '@/types/personal-account'

export const Route = createFileRoute('/profile')({
  /**
   * Both redirects run before the page renders, and on a hard load that
   * happens on the server, so a signed-out visitor never sees a frame of the
   * profile and lands back here afterwards.
   *
   * The account itself was already resolved by the root route on this
   * request, so this page costs no extra Appwrite call.
   */
  beforeLoad: ({ context }) => {
    const state = context.accountState

    if (state.status === 'signed-out') {
      throw redirect({ href: PATH.signInWithRedirect(PATH.profile) })
    }

    // Signed in but never onboarded. There is no profile to show yet, and
    // onboarding will send them straight back here when it is done.
    if (state.status === 'onboarding') {
      throw redirect({ href: PATH.onboardingWithRedirect(PATH.profile) })
    }

    return { state }
  },
  component: Profile,
})

function Profile() {
  const { state } = Route.useRouteContext()

  if (state.status === 'unavailable') {
    return (
      <Page>
        <Alert variant="destructive" className="mx-auto max-w-md">
          <AlertTitle>Your profile</AlertTitle>
          <AlertDescription>
            We could not load your profile just now. Reload the page to try again.
          </AlertDescription>
        </Alert>
      </Page>
    )
  }

  // Keyed by the account id so the form's own state is thrown away if the
  // signed-in person ever changes underneath it, and kept otherwise: a
  // half-typed bio must survive an unrelated re-render.
  return (
    <Page>
      <ProfileForm key={state.account.personalAccountId} account={state.account} />
    </Page>
  )
}

const PROFILE_FIELDS = ['firstName', 'lastName', 'contactEmail', 'bio'] as const

/** Cleared optional fields come back as null; an input wants a string. */
const toFormValues = (account: PersonalAccount): ProfileFormValues => ({
  firstName: account.firstName,
  lastName: account.lastName,
  contactEmail: account.contactEmail ?? '',
  bio: account.bio ?? '',
})

function ProfileForm({ account }: { account: PersonalAccount }) {
  const router = useRouter()
  const updatePersonalAccount = useUpdatePersonalAccount()

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: toFormValues(account),
  })
  const applyErrors = useFormErrors(form, PROFILE_FIELDS)

  const onSubmit = form.handleSubmit((values) =>
    updatePersonalAccount.mutate(values, {
      onSuccess: (saved) => {
        // The Function is the source of truth for what was stored, so the
        // form is reset from its answer rather than from what was typed.
        form.reset(toFormValues(saved))

        // Refreshes the root route's account state, so a changed first name
        // shows up in the header without a reload. A failure here leaves a
        // stale header, not a lost save, so it must not be reported as one.
        void router.invalidate()
      },
      onError: (error) => {
        // The session went away between the page load and the save. Sending
        // them through sign-in beats showing an error they cannot act on.
        if (error.code === 'unauthorized') {
          window.location.assign(PATH.signInWithRedirect(PATH.profile))
          return
        }

        const { unmatched } = applyErrors(error)
        // useSend already toasts a failure that carries no field issues. This
        // is the other case: issues that belong to no field on this form,
        // which would otherwise be swallowed.
        if (unmatched && error.issues?.length) showError(error.message)
      },
    }),
  )

  return (
    <Card className="mx-auto max-w-md">
      <CardHeader>
        <CardTitle>Your profile</CardTitle>
        <CardDescription>
          {/*
            Not a field. The role is chosen once, at onboarding, and the
            Function has no way to change it, so showing it as an input would
            be a lie.
          */}
          You are signed in as a{' '}
          <strong className="text-foreground font-medium">
            {ROLE_LABELS[account.role].toLowerCase()}
          </strong>
          , chosen when the account was created and not editable.
        </CardDescription>
      </CardHeader>

      <Form {...form}>
        {/*
          noValidate because the schema is what decides whether the form may be
          sent. Left on, the browser refuses a malformed email itself, in a
          bubble that says something else, and our message under the field never
          gets the chance to appear.
        */}
        <form onSubmit={onSubmit} noValidate>
          <CardContent className="grid gap-6">
            <FormField
              control={form.control}
              name="firstName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>First name</FormLabel>
                  <FormControl>
                    <Input autoComplete="given-name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="lastName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Last name</FormLabel>
                  <FormControl>
                    <Input autoComplete="family-name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="contactEmail"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Contact email</FormLabel>
                  <FormControl>
                    <Input type="email" autoComplete="email" {...field} />
                  </FormControl>
                  <FormDescription>Optional. Clear it to remove it.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="bio"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Bio</FormLabel>
                  <FormControl>
                    <Textarea rows={4} {...field} />
                  </FormControl>
                  <FormDescription>Optional. Clear it to remove it.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>

          <CardFooter className="mt-6">
            <Button type="submit" isLoading={updatePersonalAccount.isPending}>
              Save
            </Button>
          </CardFooter>
        </form>
      </Form>
    </Card>
  )
}
