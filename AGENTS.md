# Working with the agent

TASK.md asks for the prompts or session exports, and for three things the agent
got wrong that I caught, each linked to the commit that fixed it. There are four
below: the fourth came out of the redesign, after the first three were fixed.

## How it was used

Claude Code (Opus), in a loop of: describe the next slice, read what came back,
push back on it, commit. The standing rules the agent worked under are checked
in as [`CLAUDE.md`](CLAUDE.md) — the secrets rules, "profile data only through
the Function", the SSR header requirement, and "if something in the brief is
wrong or unsafe, do not follow it silently". Most of the disagreements recorded
in [`NOTES.md`](NOTES.md) came out of that last line.

The raw session export is in [`agent-sessions/`](agent-sessions/).

The commit messages are written in Uzbek. The four linked below carry an
English rendering of their subject line in brackets.

## Four things it got wrong

### 1. A mistyped email was a silent failure

Fixed in **`6660002`** — *fix: xato yozilgan email jimgina yo'qolardi, maydon
xatosi emas* ("a mistyped email was a silent failure, not a field error").

`buildProfilePatch` (since replaced by the profile schema and `toProfilePatch`
in `src/modules/personal-account/`) checked only that the required fields were
not blank. A malformed email or an over-long bio therefore went out as a patch,
and the
server function's own zod validator refused the call. The part the agent missed
is that a server function failing validation **throws**; it does not return the
`{ error, issues }` shape the form renders. So the visitor pressed Save and
nothing happened at all — no error, no saved record.

The form now applies the same rules the Function does. The server-side
validators did not change: this is about the answer being explainable, not
about it being enforced.

### 2. The submit handlers could not fail

Fixed in **`750ec27`** — *fix: rad etilgan server funksiya formani soqov
qoldirardi* ("a rejected server function left the form saying nothing").

Both `/profile` and `/onboarding` wrapped their submit in `try { … } finally {
setSubmitting(false) }` with no `catch`. Anything that rejected rather than
returning a result — a dropped connection, the validator above — became an
unhandled promise rejection. The button re-enabled itself and the page said
nothing.

Worth noting the near-miss in the same commit: `router.invalidate()` is
deliberately kept out of that `catch`. It refreshes the header after a save, so
a failure there leaves a stale name, not a lost save, and must not be reported
as a failed save.

### 3. Every route asked Appwrite the same question again

Fixed in **`7291892`** — *refactor: hisob holati qayta so'ralmaydi, kontekstdan
o'qiladi* ("the account state is read from context, not fetched again").

The agent wrote each route to resolve the signed-in account for itself, and
`/onboarding` did it twice over: once in `beforeLoad` for the redirect target
and again in its `loader`. A single page load cost three `account.get` calls
and three Function executions where one of each would do.

The root route's `beforeLoad` now resolves it once and puts it in the router
context. That also moved `/onboarding`'s redirects earlier, from the loader
into `beforeLoad`, so an already-onboarded visitor is sent on before their
route's data is loaded rather than after.

### 4. The browser's own validation swallowed the field error, again

Fixed in **`1a156c6`** — *fix: brauzerning o'z tekshiruvi zod xabarini bo'g'ib
qo'yayotgan edi* ("the browser's own validation was muffling the zod message").

Found during the redesign, and the same failure as the first one wearing
different clothes. With the forms rebuilt on react-hook-form the rules were in
the schema and the messages rendered under the inputs — but `<input
type="email">` means the browser refuses to submit the form at all, in its own
words, so the message the schema produces never got its turn. Nothing in the
code looked wrong; it only showed up by typing a bad address into `/profile`
and pressing Save.

`noValidate` on each form, so there is one validator and one voice.

## Things it got right that I checked anyway

Recorded because "I verified this" is a different claim from "the agent said
so":

- `npm run build`, then a grep over the client output for `node-appwrite`,
  `APPWRITE_API_KEY`, `hauz_session` and `createEmailToken`. No hits. The only
  matches for `setKey` are `setKeyframes` and `getResetKey`.
- `curl` on a cold server: `/profile` while signed out answers `307` with
  `location: /signin?redirect=%2Fprofile`, so no frame of the profile is ever
  sent to a signed-out visitor.
- `view-source` on `/`: the header is in the first response body, not filled in
  after hydration.
- `scripts/probe-function-auth.js` answers empirically whether a session alone
  can execute the Function, rather than taking the agent's word for it.
