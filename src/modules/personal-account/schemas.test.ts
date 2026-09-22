import assert from 'node:assert/strict'
import { describe, test } from 'vitest'

import {
  onboardingFormSchema,
  profileFormSchema,
  toProfilePatch,
  type ProfileFormValues,
} from './schemas'

const form = (overrides: Partial<ProfileFormValues> = {}): ProfileFormValues => ({
  firstName: 'Aziza',
  lastName: 'Karimova',
  contactEmail: 'aziza@example.com',
  bio: 'Realtor in Tashkent.',
  ...overrides,
})

/** What the app actually does: validate with the schema, then map to the wire shape. */
const submit = (values: ProfileFormValues) => {
  const parsed = profileFormSchema.safeParse(values)
  assert.equal(parsed.success, true, `expected ${JSON.stringify(values)} to pass validation`)
  if (!parsed.success) throw new Error('unreachable')

  return toProfilePatch(parsed.data)
}

const fieldCases: Array<{
  name: string
  values: Partial<ProfileFormValues>
  expected: Partial<ReturnType<typeof toProfilePatch>>
}> = [
  { name: 'contactEmail set', values: { contactEmail: 'a@b.com' }, expected: { contactEmail: 'a@b.com' } },
  { name: 'contactEmail empty clears', values: { contactEmail: '' }, expected: { contactEmail: null } },
  { name: 'bio set', values: { bio: 'Hello.' }, expected: { bio: 'Hello.' } },
  { name: 'bio empty clears', values: { bio: '' }, expected: { bio: null } },
  { name: 'bio whitespace clears', values: { bio: '  \t ' }, expected: { bio: null } },
  { name: 'bio trimmed', values: { bio: '  Hello.  ' }, expected: { bio: 'Hello.' } },
  { name: 'firstName trimmed', values: { firstName: '  Aziza  ' }, expected: { firstName: 'Aziza' } },
  { name: 'lastName trimmed', values: { lastName: '  Karimova  ' }, expected: { lastName: 'Karimova' } },
]

describe('the profile form maps onto the wire shape', () => {
  for (const { name, values, expected } of fieldCases) {
    test(name, () => {
      const patch = submit(form(values))

      for (const [field, value] of Object.entries(expected)) {
        assert.deepEqual(patch[field as keyof typeof patch], value)
      }
    })
  }
})

const rejectedCases: Array<{ name: string; values: Partial<ProfileFormValues>; fields: Array<string> }> = [
  { name: 'firstName empty', values: { firstName: '' }, fields: ['firstName'] },
  { name: 'firstName whitespace', values: { firstName: '   ' }, fields: ['firstName'] },
  { name: 'lastName empty', values: { lastName: '' }, fields: ['lastName'] },
  { name: 'firstName over the limit', values: { firstName: 'a'.repeat(101) }, fields: ['firstName'] },
  { name: 'bio over the limit', values: { bio: 'a'.repeat(2001) }, fields: ['bio'] },
  { name: 'email without an @', values: { contactEmail: 'aziza.example.com' }, fields: ['contactEmail'] },
  { name: 'email without a domain', values: { contactEmail: 'aziza@' }, fields: ['contactEmail'] },
  {
    name: 'several at once',
    values: { firstName: '', contactEmail: 'nope', bio: 'a'.repeat(2001) },
    fields: ['firstName', 'contactEmail', 'bio'],
  },
]

describe('the profile schema reports what the Function would refuse', () => {
  for (const { name, values, fields } of rejectedCases) {
    test(name, () => {
      const parsed = profileFormSchema.safeParse(form(values))

      assert.equal(parsed.success, false)
      if (parsed.success) return

      const reported = [...new Set(parsed.error.issues.map((issue) => issue.path.join('.')))].sort()
      assert.deepEqual(reported, [...fields].sort())
    })
  }
})

test('a blank optional field is cleared, not rejected', () => {
  const patch = submit(form({ contactEmail: '   ', bio: '' }))

  assert.equal(patch.contactEmail, null)
  assert.equal(patch.bio, null)
})

/**
 * The two invariants the Function's contract depends on. If either breaks the
 * visitor gets a 400 they cannot act on.
 */
describe('invariants', () => {
  const everyShape = [
    form(),
    ...fieldCases.map(({ values }) => form(values)),
    form({ contactEmail: '', bio: '' }),
    form({ contactEmail: '   ', bio: '   ' }),
  ]

  test('an empty string never reaches the Function', () => {
    for (const values of everyShape) {
      for (const value of Object.values(submit(values))) {
        assert.notEqual(value, '')
      }
    }
  })

  test('the body always carries all four fields', () => {
    for (const values of everyShape) {
      assert.deepEqual(Object.keys(submit(values)).sort(), [
        'bio',
        'contactEmail',
        'firstName',
        'lastName',
      ])
    }
  })

  test('the required fields are never null', () => {
    for (const values of everyShape) {
      const patch = submit(values)
      assert.equal(typeof patch.firstName, 'string')
      assert.equal(typeof patch.lastName, 'string')
    }
  })
})

describe('onboarding requires both names and one of the two roles', () => {
  test('a complete form passes', () => {
    const parsed = onboardingFormSchema.safeParse({
      firstName: 'Aziza',
      lastName: 'Karimova',
      role: 'realtor',
    })

    assert.equal(parsed.success, true)
  })

  test('a blank name is refused', () => {
    const parsed = onboardingFormSchema.safeParse({
      firstName: '  ',
      lastName: 'Karimova',
      role: 'realtor',
    })

    assert.equal(parsed.success, false)
  })

  test('an unknown role is refused', () => {
    const parsed = onboardingFormSchema.safeParse({
      firstName: 'Aziza',
      lastName: 'Karimova',
      role: 'landlord',
    })

    assert.equal(parsed.success, false)
  })
})
