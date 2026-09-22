# Agent sessions

The exported Claude Code transcripts for this task go in this folder, one file
per session.

To export from Claude Code: `/export` in the session you want, which writes the
conversation to a file. The raw transcripts also live under
`~/.claude/projects/<project-slug>/*.jsonl` if a session was not exported at
the time.

The standing instructions the agent worked under for every one of those
sessions are checked in as [`../CLAUDE.md`](../CLAUDE.md). Read that first: it
is what most of the pushback in [`../NOTES.md`](../NOTES.md) came out of.
