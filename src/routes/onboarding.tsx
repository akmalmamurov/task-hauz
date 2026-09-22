import { zodResolver } from '@hookform/resolvers/zod'
import { createFileRoute, redirect } from '@tanstack/react-router'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'

import { CardPage } from '@/components/page'
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
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { PATH } from '@/constants/path'
import { useFormErrors } from '@/hooks/use-form-errors'
import {
  onboardingFormSchema,
  useCreatePersonalAccount,
  type OnboardingFormValues,
} from '@/modules/personal-account'
import { PERSONAL_ROLES, ROLE_LABELS } from '@/types/personal-account'
import { safeRedirect } from '@/utils/safe-redirect'

const searchSchema = z.object({
  redirect: z.string().optional(),
})

export const Route = createFileRoute('/onboarding')({
  validateSearch: searchSchema,
  // The root route resolved the account on this request; this reads its
  // answer. Both redirects happen before the page renders, server side on a
  // hard load, so neither is a flash of the wrong screen.
  beforeLoad: ({ search, context }) => {
    const target = safeRedirect(search.redirect)
    const state = context.accountState

    if (state.status === 'signed-out') {
      throw redirect({ href: PATH.signInWithRedirect(PATH.onboardingWithRedirect(target)) })
    }

    // Already onboarded, so there is nothing to fill in. Sending them on is
    // what "someone who already has an account skips this" means.
    if (state.status === 'ready') {
      throw redirect({ href: target })
    }

    return { target, state }
  },
  component: Onboarding,
})

function Onboarding() {
  const { state, target } = Route.useRouteContext()

  // We could not find out whether they have an account. Offering the form here
  // would risk a 409 for someone who already has one, so ask them to retry
  // instead of guessing.
  if (state.status === 'unavailable') {
    return (
      <CardPage>
        <Alert variant="destructive">
          <AlertTitle>One moment</AlertTitle>
          <AlertDescription>
            We could not load your account just now. Reload the page to try again.
          </AlertDescription>
        </Alert>
      </CardPage>
    )
  }

  return (
    <CardPage>
      <OnboardingForm target={target} />
    </CardPage>
  )
}

const ONBOARDING_FIELDS = ['firstName', 'lastName', 'role'] as const

function OnboardingForm({ target }: { target: string }) {
  const createPersonalAccount = useCreatePersonalAccount()
  // Set when the account already exists with the other role. Not a validation
  // error: their input is fine, the state is what disagrees.
  const [roleConflict, setRoleConflict] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)

  const form = useForm<OnboardingFormValues>({
    resolver: zodResolver(onboardingFormSchema),
    defaultValues: { firstName: '', lastName: '' },
  })
  const applyErrors = useFormErrors(form, ONBOARDING_FIELDS)

  const onSubmit = form.handleSubmit((values) => {
    setFormError(null)

    // Double submit is prevented properly by the Function: POST looks the
    // account up first, and the unique index on appwrite_user_id catches the
    // race, so the loser still gets a 200. The disabled button is only manners.
    createPersonalAccount.mutate(values, {
      onSuccess: () => {
        // A full navigation, so the next document is rendered by a server that
        // can already see the new account. Client routing would paint the
        // destination with the pre-onboarding state.
        window.location.assign(target)
      },
      onError: (error) => {
        if (error.code === 'personal_account_inconsistent') {
          setRoleConflict(error.message)
          return
        }

        const { unmatched } = applyErrors(error)
        if (unmatched) setFormError(error.message)
      },
    })
  })

  // The account exists, just not with the role they picked. Onboarding's goal
  // is already met, so the way out is forward, not a retry: the role is fixed
  // at creation and there is nothing they can do here to change it.
  if (roleConflict) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">You already have an account</CardTitle>
          <CardDescription>{roleConflict}</CardDescription>
        </CardHeader>
        <CardContent className="text-muted-foreground text-sm">
          A role is chosen once, when the account is created, and cannot be changed
          afterwards. Contact us if it is wrong.
        </CardContent>
        <CardFooter>
          <Button className="w-full" onClick={() => window.location.assign(target)}>
            Continue
          </Button>
        </CardFooter>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Tell us who you are</CardTitle>
        <CardDescription>
          We need this once, to finish setting up your account.
        </CardDescription>
      </CardHeader>

      <Form {...form}>
        {/* noValidate: the schema decides, not the browser's own bubble. */}
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
              name="role"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>I am a</FormLabel>
                  <FormControl>
                    <RadioGroup value={field.value ?? ''} onValueChange={field.onChange}>
                      {PERSONAL_ROLES.map((role) => (
                        // The whole row is the target, not just the dot: this
                        // is the one choice on the page and it is permanent.
                        <Label
                          key={role}
                          htmlFor={`role-${role}`}
                          className="hover:bg-accent/40 has-[[data-state=checked]]:border-primary cursor-pointer gap-3 rounded-lg border p-3 font-normal"
                        >
                          <RadioGroupItem id={`role-${role}`} value={role} />
                          {ROLE_LABELS[role]}
                        </Label>
                      ))}
                    </RadioGroup>
                  </FormControl>
                  <FormDescription>This cannot be changed later.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {formError ? (
              <Alert variant="destructive">
                <AlertDescription>{formError}</AlertDescription>
              </Alert>
            ) : null}
          </CardContent>

          <CardFooter className="mt-6">
            <Button type="submit" className="w-full" isLoading={createPersonalAccount.isPending}>
              Continue
            </Button>
          </CardFooter>
        </form>
      </Form>
    </Card>
  )
}
