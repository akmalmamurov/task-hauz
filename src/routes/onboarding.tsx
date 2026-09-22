import { createFileRoute, redirect } from '@tanstack/react-router'
import { useState } from 'react'
import { z } from 'zod'

import {
  PERSONAL_ROLES,
  ROLE_LABELS,
  type PersonalRole,
} from '../lib/personal-account'
import { safeRedirect } from '../lib/safe-redirect'
import { createPersonalAccount } from '../server/personal-account'

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
      throw redirect({
        href: `/signin?redirect=${encodeURIComponent(`/onboarding?redirect=${target}`)}`,
      })
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
      <main>
        <h1>One moment</h1>
        <p role="alert">
          We could not load your account just now. Reload the page to try
          again.
        </p>
      </main>
    )
  }

  return <OnboardingForm target={target} />
}

type FieldErrors = Partial<Record<'firstName' | 'lastName' | 'role', string>>

function OnboardingForm({ target }: { target: string }) {
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [role, setRole] = useState<PersonalRole | ''>('')

  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [formError, setFormError] = useState<string | null>(null)
  // Set when the account already exists with the other role. Not a validation
  // error: their input is fine, the state is what disagrees.
  const [roleConflict, setRoleConflict] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault()

    // Double submit is prevented properly by the Function: POST looks the
    // account up first, and the unique index on appwrite_user_id catches the
    // race, so the loser still gets a 200. This guard is only so the button
    // does not look ignored.
    if (submitting) {
      return
    }

    setFieldErrors({})
    setFormError(null)

    const errors: FieldErrors = {}
    if (firstName.trim() === '') {
      errors.firstName = 'This field is required.'
    }
    if (lastName.trim() === '') {
      errors.lastName = 'This field is required.'
    }
    if (role === '') {
      errors.role = 'Choose one.'
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors)
      return
    }

    setSubmitting(true)

    try {
      const result = await createPersonalAccount({
        data: { firstName: firstName.trim(), lastName: lastName.trim(), role: role as PersonalRole },
      })

      if (result.ok) {
        // A full navigation, so the next document is rendered by a server that
        // can already see the new account. Client routing would paint the
        // destination with the pre-onboarding state.
        window.location.assign(target)
        return
      }

      if (result.code === 'personal_account_inconsistent') {
        setRoleConflict(result.message)
        return
      }

      if (result.code === 'invalid_request' && result.issues) {
        const mapped: FieldErrors = {}
        for (const issue of result.issues) {
          if (issue.field === 'firstName' || issue.field === 'lastName' || issue.field === 'role') {
            mapped[issue.field] = issue.message
          }
        }

        setFieldErrors(mapped)
        setFormError(Object.keys(mapped).length > 0 ? null : result.message)
        return
      }

      setFormError(result.message)
    } finally {
      setSubmitting(false)
    }
  }

  // The account exists, just not with the role they picked. Onboarding's goal
  // is already met, so the way out is forward, not a retry: the role is fixed
  // at creation and there is nothing they can do here to change it.
  if (roleConflict) {
    return (
      <main>
        <h1>You already have an account</h1>
        <p role="alert">{roleConflict}</p>
        <p>
          A role is chosen once, when the account is created, and cannot be
          changed afterwards. Contact us if it is wrong.
        </p>
        <button type="button" onClick={() => window.location.assign(target)}>
          Continue
        </button>
      </main>
    )
  }

  return (
    <main>
      <h1>Tell us who you are</h1>
      <p>We need this once, to finish setting up your account.</p>

      <form onSubmit={onSubmit}>
        <div>
          <label htmlFor="firstName">First name</label>
          <input
            id="firstName"
            name="firstName"
            autoComplete="given-name"
            value={firstName}
            onChange={(event) => setFirstName(event.target.value)}
          />
          {fieldErrors.firstName ? <p role="alert">{fieldErrors.firstName}</p> : null}
        </div>

        <div>
          <label htmlFor="lastName">Last name</label>
          <input
            id="lastName"
            name="lastName"
            autoComplete="family-name"
            value={lastName}
            onChange={(event) => setLastName(event.target.value)}
          />
          {fieldErrors.lastName ? <p role="alert">{fieldErrors.lastName}</p> : null}
        </div>

        <fieldset>
          <legend>I am a</legend>
          {PERSONAL_ROLES.map((option) => (
            <div key={option}>
              <input
                id={`role-${option}`}
                type="radio"
                name="role"
                value={option}
                checked={role === option}
                onChange={() => setRole(option)}
              />
              <label htmlFor={`role-${option}`}>{ROLE_LABELS[option]}</label>
            </div>
          ))}
          {fieldErrors.role ? <p role="alert">{fieldErrors.role}</p> : null}
          <p>This cannot be changed later.</p>
        </fieldset>

        <button type="submit" disabled={submitting}>
          {submitting ? 'Setting up...' : 'Continue'}
        </button>
      </form>

      {formError ? <p role="alert">{formError}</p> : null}
    </main>
  )
}
