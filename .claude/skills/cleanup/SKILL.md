---
name: cleanup
description: Periodic maintenance pass for Fireline — code analysis, security review, simplification/efficiency cleanup, and keeping docs/ in sync with what the code actually does. Run this between feature milestones, not as a substitute for them.
---

# Cleanup — Fireline

A maintenance pass, not a feature pass. Run this periodically (the user will ask, or invoke it
directly) to catch drift that accumulates silently while shipping features: dead code, stale
docs, security issues that crept in, and complexity that could be simpler. This skill orchestrates
the project's existing review skills rather than re-implementing review logic — its job is
sequencing and doc upkeep on top of them.

## Steps

### 1. Establish scope

Default to reviewing everything changed since the last cleanup pass (check `docs/PROGRESS.md`'s
log for the last cleanup entry; if none, use the last several feature milestones — `git log
--oneline -20` for orientation). If the user names a specific area ("clean up the audio code",
"check the Firestore rules"), scope to that instead of the whole repo.

### 2. Code analysis & security

Invoke the `security-review` skill for the current diff/branch state. Separately, invoke
`code-review` at `medium` or `high` effort (`high` if it's been a while since the last cleanup or
scope is broad) for correctness bugs and reuse/simplification/efficiency findings — it covers
both concerns in one pass, so don't also hand-roll a duplicate review.

Points specific to this project worth double-checking even if the generic reviews don't flag them:
- Firestore security rules (`firestore.rules`) still match what the client code actually reads/
  writes — a new field or subcollection added to `playerProfile.ts` without a corresponding rule
  update is a silent security gap, not a lint error.
- Nothing writes Firebase config values as *secrets* (the config itself is meant to be public per
  Firebase's own guidance — see the comment in `src/firebase/config.ts` — don't "fix" that).
- `App Check` enforcement mode and Firestore rule state as currently deployed vs. what's checked
  into the repo (`firebase deploy --only firestore:rules,firestore:indexes` may be behind what's
  in `firestore.rules` if a previous session forgot to deploy — compare, don't assume).

### 3. Simplify & optimize

Invoke the `simplify` skill on the same scope for reuse/simplification/efficiency/altitude
cleanups. This is quality-only (not bug-hunting — step 2 already covered that), so it's fine to
run even when step 2 found nothing.

### 4. Apply fixes

Apply what step 2 and step 3 surfaced, using their own fix/apply flags rather than re-implementing
the edits by hand where those flags exist. After applying, run the project's own verification:

```bash
npm run build   # tsc -b && vite build
npm run lint     # oxlint
```

Both must pass clean before moving on.

### 5. Documentation maintenance

Cross-check these against the current code, not against what they last said:

- **`README.md`** — Status section, Stack section, and Project layout tree. These have gone
  stale before (see the 2026-09-02 PROGRESS.md log entry) — check them every time, don't assume
  they're current just because they were fixed once.
- **`docs/PROGRESS.md`** — the GDD-phase status table and the backend detail checklist should
  reflect what's actually shipped and deployed (not just committed — check whether Firestore
  rules/App Check state match what's live). Add a dated log entry for this cleanup pass itself if
  it made any changes.
- **`docs/ART_ASSETS.md`** — any new PixelLab assets generated since the last pass should be
  recorded with their object/tile IDs; anything in "known follow-ups" that got addressed should be
  checked off.
- **`docs/AUDIO_AND_POLISH.md`** — same treatment: check off resolved items, add newly discovered
  ones. Don't remove unresolved items just because they're old — a stale-but-still-true backlog
  entry is doing its job.

Docs describing something that no longer matches the code are worse than no docs — fix the
mismatch, don't just add a note about it.

### 6. Report

Summarize: what the reviews found, what got fixed vs. left as a tracked follow-up (and why, if a
finding was deliberately not addressed), and which docs changed. If the fixes amount to a
shippable, coherent change, offer to run `push-and-deploy` — don't run it automatically, since a
cleanup pass isn't always meant to ship immediately (e.g. if it surfaced findings the user needs
to weigh in on first).
