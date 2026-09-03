---
name: push-and-deploy
description: Commit and push Fireline game code to GitHub (publishing the web build to GitHub Pages) and deploy any changed Firebase backend config (Firestore rules/indexes). Use at the end of a development milestone (a feature, phase, or meaningful chunk of work), not after every small edit.
---

# Push and Deploy — Fireline

Fireline has two independently deployable halves:

- **Frontend** — React + Phaser, built by Vite, published to GitHub Pages at
  `https://lanternforgestudios.github.io/Fireline/` via `.github/workflows/deploy.yml`.
  That workflow only fires on push to **`main`**.
- **Backend** — Firebase (`fireline-lf` project): Firestore security rules/indexes today,
  possibly Cloud Functions later. Deployed with the Firebase CLI, independent of GitHub Actions.

"Push" handles the frontend half; "deploy" handles the backend half. Do both together at a
milestone so the live site and the live backend never drift out of sync with each other.

## When to run this

At the end of a milestone — a completed feature, a finished phase of the GDD roadmap, or any
point where the working tree is in a shippable state. Not after every single file edit; batch
related changes into one milestone commit. If unsure whether the current state counts as a
milestone, ask before pushing.

## Steps

### 1. Sanity-check the working tree

```bash
git status
```

Look for anything unexpected (stray files, someone else's in-progress work). If the tree
contains changes unrelated to what was just built, stop and check with the user before
sweeping them into the commit.

### 2. Build and lint

```bash
npm run build
npm run lint
```

Both must pass clean. A broken build pushed to `main` breaks the live site — never push past a
failing build. Fix the issue, or stop and report it, rather than pushing anyway.

### 3. Commit

Stage the specific files that make up this milestone (avoid `git add -A` if there's unrelated
clutter in the tree) and commit with a message describing *what shipped*, not a diff summary —
e.g. "Add Firestore-backed player progression and Google/email auth" not "Update App.tsx,
add firebase/*". Follow whatever commit-trailer convention is currently in effect for the
session (Co-Authored-By trailers etc.) — this skill doesn't hardcode them since they can change
per session.

### 4. Push — publishes the frontend

The deploy workflow only triggers on `main`, so both the working branch and `main` need the
commit:

```bash
git push
git push origin HEAD:main
```

If `origin/main` has diverged (someone else pushed there), stop and reconcile rather than
force-pushing — check with the user.

Confirm the Actions run picks it up:

```bash
gh run list --workflow=deploy.yml --limit 1  # if gh is available
```

or just note that the GitHub Actions tab / the live URL will reflect it in a minute or two.

### 5. Deploy — publishes the backend

Only needed when `firestore.rules`, `firestore.indexes.json`, or (in future) `functions/` changed
in this milestone. Skip this step if the milestone was frontend-only.

```bash
firebase login:list        # confirm we're authenticated; if not, ask the user to run
                            # `! firebase login` themselves (interactive OAuth, can't be
                            # done headlessly)
firebase deploy --only firestore:rules,firestore:indexes
```

Add other `--only` targets (`functions`, etc.) as the backend grows — deploy only what actually
changed, not the whole project every time.

### 6. Report back

State plainly what shipped: the commit(s), whether Pages/backend (or both) were touched, and the
live URL. If either push or deploy was skipped (e.g. backend unchanged), say so rather than
letting it be assumed both happened.

## Guardrails

- Never force-push `main`.
- Never skip the build/lint check to push faster.
- Firebase config values (API keys, reCAPTCHA site key) checked into this repo are public by
  design (Firebase's own documented guidance) — nothing here should ever need `--no-verify` or
  secret-scrubbing before a push.
- This is a solo/small-team hobby project without branch protection or required review, which is
  why this skill pushes straight to `main` instead of opening a PR — revisit this if that ever
  changes.
