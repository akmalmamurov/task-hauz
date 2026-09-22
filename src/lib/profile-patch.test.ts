import assert from 'node:assert/strict'
import { test } from 'node:test'

import { buildProfilePatch } from './profile-patch.ts'
import type { ProfileFormValues, ProfilePatch } from './profile-patch.ts'

function form(overrides: Partial<ProfileFormValues> = {}): ProfileFormValues {
  return {
    firstName: 'Aziza',
    lastName: 'Karimova',
    contactEmail: 'aziza@example.com',
    bio: 'Realtor in Tashkent.',
    ...overrides,
  }
}

/**
 * The per-field matrix. The Function accepts three inputs per field and the
 * form produces one, so this table is the whole mapping in one place.
 */
const fieldCases: Array<{
  name: string
  values: Partial<ProfileFormValues>
  expected: Partial<ProfilePatch>
}> = [
  // contactEmail: optional and nullable, so "" means clear.
  { name: 'contactEmail set', values: { contactEmail: 'a@b.com' }, expected: { contactEmail: 'a@b.com' } },
  { name: 'contactEmail empty clears', values: { contactEmail: '' }, expected: { contactEmail: null } },
  { name: 'contactEmail whitespace clears', values: { contactEmail: '   ' }, expected: { contactEmail: null } },
  { name: 'contactEmail trimmed', values: { contactEmail: '  a@b.com  ' }, expected: { contactEmail: 'a@b.com' } },

  // bio: same rules.
  { name: 'bio set', values: { bio: 'Hello.' }, expected: { bio: 'Hello.' } },
  { name: 'bio empty clears', values: { bio: '' }, expected: { bio: null } },
  { name: 'bio whitespace clears', values: { bio: '  \t ' }, expected: { bio: null } },
  { name: 'bio trimmed', values: { bio: '  Hello.  ' }, expected: { bio: 'Hello.' } },

  // firstName / lastName: required columns, so they are never null.
  { name: 'firstName trimmed', values: { firstName: '  Aziza  ' }, expected: { firstName: 'Aziza' } },
  { name: 'lastName trimmed', values: { lastName: '  Karimova  ' }, expected: { lastName: 'Karimova' } },
]

test('buildProfilePatch maps form values onto the wire shape', async (t) => {
  for (const { name, values, expected } of fieldCases) {
    await t.test(name, () => {
      const result = buildProfilePatch(form(values))

      assert.equal(result.ok, true)
      if (!result.ok) return

      for (const [field, value] of Object.entries(expected)) {
        assert.deepEqual(result.patch[field as keyof ProfilePatch], value)
      }
    })
  }
})

const requiredCases: Array<{ name: string; values: Partial<ProfileFormValues>; fields: string[] }> = [
  { name: 'firstName empty', values: { firstName: '' }, fields: ['firstName'] },
  { name: 'firstName whitespace', values: { firstName: '   ' }, fields: ['firstName'] },
  { name: 'lastName empty', values: { lastName: '' }, fields: ['lastName'] },
  { name: 'lastName whitespace', values: { lastName: '\t' }, fields: ['lastName'] },
  { name: 'both empty', values: { firstName: '', lastName: '' }, fields: ['firstName', 'lastName'] },
]

test('buildProfilePatch refuses to send a blank required field', async (t) => {
  for (const { name, values, fields } of requiredCases) {
    await t.test(name, () => {
      const result = buildProfilePatch(form(values))

      assert.equal(result.ok, false)
      if (result.ok) return

      assert.deepEqual(Object.keys(result.errors).sort(), [...fields].sort())
    })
  }
})

/**
 * The rules the Function would apply anyway. They are checked here so a typo
 * is a message under the field instead of a rejected server function, which
 * throws rather than returning issues the form can display.
 */
const rejectedCases: Array<{ name: string; values: Partial<ProfileFormValues>; fields: string[] }> = [
  { name: 'email without an @', values: { contactEmail: 'aziza.example.com' }, fields: ['contactEmail'] },
  { name: 'email without a domain', values: { contactEmail: 'aziza@' }, fields: ['contactEmail'] },
  { name: 'email that is only an @', values: { contactEmail: '@' }, fields: ['contactEmail'] },
  { name: 'email over 254 characters', values: { contactEmail: `${'a'.repeat(250)}@b.com` }, fields: ['contactEmail'] },
  { name: 'firstName over 100 characters', values: { firstName: 'a'.repeat(101) }, fields: ['firstName'] },
  { name: 'lastName over 100 characters', values: { lastName: 'a'.repeat(101) }, fields: ['lastName'] },
  { name: 'bio over 2000 characters', values: { bio: 'a'.repeat(2001) }, fields: ['bio'] },
  {
    name: 'several at once',
    values: { firstName: '', contactEmail: 'nope', bio: 'a'.repeat(2001) },
    fields: ['firstName', 'contactEmail', 'bio'],
  },
]

test('buildProfilePatch reports what the Function would refuse', async (t) => {
  for (const { name, values, fields } of rejectedCases) {
    await t.test(name, () => {
      const result = buildProfilePatch(form(values))

      assert.equal(result.ok, false)
      if (result.ok) return

      assert.deepEqual(Object.keys(result.errors).sort(), [...fields].sort())
    })
  }
})

test('an empty optional field is cleared, not rejected as invalid', async (t) => {
  await t.test('a blank email is not an invalid email', () => {
    const result = buildProfilePatch(form({ contactEmail: '   ' }))

    assert.equal(result.ok, true)
    if (!result.ok) return

    assert.equal(result.patch.contactEmail, null)
  })

  await t.test('a value exactly at the limit is accepted', () => {
    const result = buildProfilePatch(
      form({ firstName: 'a'.repeat(100), bio: 'a'.repeat(2000) }),
    )

    assert.equal(result.ok, true)
  })
})

/**
 * The two invariants the Function's contract depends on. If either breaks the
 * visitor gets a 400 they cannot act on, so they are asserted against every
 * row above plus the awkward combinations.
 */
test('invariants', async (t) => {
  const everyShape = [
    form(),
    ...fieldCases.map(({ values }) => form(values)),
    form({ contactEmail: '', bio: '' }),
    form({ contactEmail: '   ', bio: '   ' }),
  ]

  await t.test('an empty string never reaches the Function', () => {
    for (const values of everyShape) {
      const result = buildProfilePatch(values)
      if (!result.ok) continue

      for (const value of Object.values(result.patch)) {
        assert.notEqual(value, '', `empty string in ${JSON.stringify(result.patch)}`)
      }
    }
  })

  await t.test('the body always carries all four fields, so "at least one field" cannot fire', () => {
    for (const values of everyShape) {
      const result = buildProfilePatch(values)
      if (!result.ok) continue

      assert.deepEqual(Object.keys(result.patch).sort(), [
        'bio',
        'contactEmail',
        'firstName',
        'lastName',
      ])
    }
  })

  await t.test('the required fields are never null', () => {
    for (const values of everyShape) {
      const result = buildProfilePatch(values)
      if (!result.ok) continue

      assert.equal(typeof result.patch.firstName, 'string')
      assert.equal(typeof result.patch.lastName, 'string')
    }
  })
})

test('clearing both optional fields at once is a single valid patch', () => {
  const result = buildProfilePatch(form({ contactEmail: '', bio: '' }))

  assert.equal(result.ok, true)
  if (!result.ok) return

  assert.deepEqual(result.patch, {
    firstName: 'Aziza',
    lastName: 'Karimova',
    contactEmail: null,
    bio: null,
  })
})

test('saving without changing anything is still a complete, valid patch', () => {
  const values = form()
  const result = buildProfilePatch(values)

  assert.equal(result.ok, true)
  if (!result.ok) return

  assert.deepEqual(result.patch, {
    firstName: 'Aziza',
    lastName: 'Karimova',
    contactEmail: 'aziza@example.com',
    bio: 'Realtor in Tashkent.',
  })
})
