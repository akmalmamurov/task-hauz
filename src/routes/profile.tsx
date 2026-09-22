import { createFileRoute, redirect, useRouter } from '@tanstack/react-router'
import { useState } from 'react'

import { ROLE_LABELS, type PersonalAccount } from '@/types/personal-account'
import {
  buildProfilePatch,
  type ProfileFieldErrors,
  type ProfileFormValues,
} from '@/lib/profile-patch'
import { updatePersonalAccount } from '@/server/personal-account'

/** Where a signed-out visitor is sent back to once they have signed in. */
const SELF = '/profile'

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
      throw redirect({ href: `/signin?redirect=${encodeURIComponent(SELF)}` })
    }

    // Signed in but never onboarded. There is no profile to show yet, and
    // onboarding will send them straight back here when it is done.
    if (state.status === 'onboarding') {
      throw redirect({ href: `/onboarding?redirect=${encodeURIComponent(SELF)}` })
    }

    return { state }
  },
  component: Profile,
})

function Profile() {
  const { state } = Route.useRouteContext()

  if (state.status === 'unavailable') {
    return (
      <main>
        <h1>Your profile</h1>
        <p role="alert">
          We could not load your profile just now. Reload the page to try
          again.
        </p>
      </main>
    )
  }

  // Keyed by the account id so the form's own state is thrown away if the
  // signed-in person ever changes underneath it, and kept otherwise: a
  // half-typed bio must survive an unrelated re-render.
  return <ProfileForm key={state.account.personalAccountId} account={state.account} />
}

/** Cleared optional fields come back as null; an input wants a string. */
function toFormValues(account: PersonalAccount): ProfileFormValues {
  return {
    firstName: account.firstName,
    lastName: account.lastName,
    contactEmail: account.contactEmail ?? '',
    bio: account.bio ?? '',
  }
}

function ProfileForm({ account }: { account: PersonalAccount }) {
  const router = useRouter()
  const [values, setValues] = useState(() => toFormValues(account))
  const [fieldErrors, setFieldErrors] = useState<ProfileFieldErrors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  function set<K extends keyof ProfileFormValues>(field: K, value: string) {
    setValues((current) => ({ ...current, [field]: value }))
    setSaved(false)
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault()

    if (submitting) {
      return
    }

    setFieldErrors({})
    setFormError(null)
    setSaved(false)

    // One place decides what the form means: "" clears the optional fields
    // and is an error on the required ones. See lib/profile-patch.ts.
    const built = buildProfilePatch(values)
    if (!built.ok) {
      setFieldErrors(built.errors)
      return
    }

    setSubmitting(true)

    try {
      const result = await updatePersonalAccount({ data: built.patch })

      if (result.ok) {
        // The Function is the source of truth for what was stored, so the
        // form is reset from its answer rather than from what was typed.
        setValues(toFormValues(result.account))
        setSaved(true)

        // Refreshes the root route's account state, so a changed first name
        // shows up in the header without a reload. A failure here leaves a
        // stale header, not a lost save, so it must not reach the catch below
        // and claim the save failed.
        await router.invalidate().catch(() => {})
        return
      }

      // The session went away between the page load and the save. Sending
      // them through sign-in beats showing an error they cannot act on.
      if (result.code === 'unauthorized') {
        window.location.assign(`/signin?redirect=${encodeURIComponent(SELF)}`)
        return
      }

      if (result.code === 'invalid_request' && result.issues) {
        const mapped: ProfileFieldErrors = {}
        for (const issue of result.issues) {
          if (
            issue.field === 'firstName' ||
            issue.field === 'lastName' ||
            issue.field === 'contactEmail' ||
            issue.field === 'bio'
          ) {
            mapped[issue.field] = issue.message
          }
        }

        setFieldErrors(mapped)
        // An issue we could not attach to a field still has to be visible.
        setFormError(Object.keys(mapped).length > 0 ? null : result.message)
        return
      }

      setFormError(result.message)
    } catch {
      // The call never came back with a result of its own: the network, or
      // the server function's validator disagreeing with the form. Neither
      // has anything specific to say that is safe to show, so both get the
      // one honest message. Without this the promise rejected unhandled and
      // pressing Save looked like it did nothing.
      setFormError('We could not save your changes. Try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main>
      <h1>Your profile</h1>

      <form onSubmit={onSubmit}>
        <div>
          <label htmlFor="firstName">First name</label>
          <input
            id="firstName"
            name="firstName"
            autoComplete="given-name"
            value={values.firstName}
            onChange={(event) => set('firstName', event.target.value)}
          />
          {fieldErrors.firstName ? <p role="alert">{fieldErrors.firstName}</p> : null}
        </div>

        <div>
          <label htmlFor="lastName">Last name</label>
          <input
            id="lastName"
            name="lastName"
            autoComplete="family-name"
            value={values.lastName}
            onChange={(event) => set('lastName', event.target.value)}
          />
          {fieldErrors.lastName ? <p role="alert">{fieldErrors.lastName}</p> : null}
        </div>

        <div>
          <label htmlFor="contactEmail">Contact email</label>
          <input
            id="contactEmail"
            name="contactEmail"
            type="email"
            autoComplete="email"
            value={values.contactEmail}
            onChange={(event) => set('contactEmail', event.target.value)}
          />
          <p>Optional. Clear it to remove it.</p>
          {fieldErrors.contactEmail ? (
            <p role="alert">{fieldErrors.contactEmail}</p>
          ) : null}
        </div>

        <div>
          <label htmlFor="bio">Bio</label>
          <textarea
            id="bio"
            name="bio"
            rows={4}
            value={values.bio}
            onChange={(event) => set('bio', event.target.value)}
          />
          <p>Optional. Clear it to remove it.</p>
          {fieldErrors.bio ? <p role="alert">{fieldErrors.bio}</p> : null}
        </div>

        {/*
          Not a field. The role is chosen once, at onboarding, and the Function
          has no way to change it, so showing it as an input would be a lie.
        */}
        <p>
          Role: <strong>{ROLE_LABELS[account.role]}</strong>. Chosen when the
          account was created and not editable.
        </p>

        <button type="submit" disabled={submitting}>
          {submitting ? 'Saving...' : 'Save'}
        </button>
      </form>

      {formError ? <p role="alert">{formError}</p> : null}
      {saved ? <p role="status">Saved.</p> : null}
    </main>
  )
}
