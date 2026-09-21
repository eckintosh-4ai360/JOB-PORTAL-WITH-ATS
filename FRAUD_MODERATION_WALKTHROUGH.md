# Fraud Detection & AI Moderation — Walkthrough

This document covers the trust-and-safety layer: what it detects, how scores are
calculated, how enforcement works, and what has been verified.

---

## 1. What was built

Four detectors and one review workflow, sharing a single scoring engine.

**Detection**
- **Fake companies** — throwaway contact domains, website/contact mismatch, missing
  registration, placeholder descriptions, new accounts posting in volume
- **Duplicate jobs** — exact reposts, near-duplicates by shingled text similarity, and
  cross-employer copies (a scraped advert republished by someone else)
- **Spam recruiters** — advance-fee demands, credential harvesting, off-platform contact,
  one advert sprayed under many titles, burst posting, implausible pay on a thin advert
- **Fake resumes** — the same file under multiple accounts, keyword stuffing, future-dated
  roles, claimed experience exceeding the career span, overlapping full-time roles

**Moderation**
- Automatic screening on job publish, job edit, company setup completion, and resume analysis
- Risk scored 0–100 and banded low / medium / high / critical
- Cases opened for a human at ≥35; automatic enforcement only at ≥80
- Admin queue at `/admin-moderation` showing every rule that fired and its weight
- Append-only event log, so every enforcement action traces to a person and a reason

---

## 2. The core design decision: rules decide, AI interprets

This mirrors the hybrid approach already used for resume scoring, and for a sharper reason
here: **the text being judged is written by the person being judged.**

A model asked "is this job advert fraudulent?" is reading input authored by someone with a
direct interest in the answer. That is a prompt-injection surface, and it is also
non-reproducible — the same advert can score differently on two runs, which is indefensible
when the output suspends a real business.

So the split is:

| | Source | Property |
|---|---|---|
| **Rule score** | `backend/utils/fraudSignals.js` | Deterministic, reproducible, auditable |
| **AI adjustment** | `backend/services/fraudModerationService.js` | Capped at ±15 points |

The rule score is the spine. The model can sharpen a borderline call or defend an innocent
employer, but it **cannot manufacture a case or bury one**. With `FRAUD_AI_MAX_ADJUSTMENT=15`,
a rule score of 20 cannot be pushed to a case (35) and a rule score of 100 cannot be pushed
below critical.

If Groq is unconfigured or failing, assessments still complete and are marked `degraded`.
Detection never depends on the AI provider being up.

### Signal weighting

Weights are combined with **diminishing returns**, not straight addition:

```
score = Σ  weight_i × 0.65^i        (signals sorted heaviest first)
```

Straight addition means eight trivial signals outrank one serious one — which is how naive
scoring buries real fraud under noise. Under this curve:

- twelve trivial signals (weight 12 each) reach **34** — below the case threshold
- one advance-fee demand (weight 90) reaches **90** — critical on its own

That ordering is asserted in the test script (§8).

---

## 3. File map

### Backend — new
| File | Purpose |
|---|---|
| `backend/utils/fraudSignals.js` | All four detectors. Pure functions, no I/O. |
| `backend/services/fraudModerationService.js` | AI adjudication, scoring, case lifecycle, enforcement |
| `backend/controllers/moderationController.js` | Admin queue API |
| `backend/routes/moderationRoutes.js` | `/api/moderation/*`, admin-gated |
| `backend/scripts/checkFraudSignals.js` | Behavioural test for the detectors |

### Backend — modified
| File | Change |
|---|---|
| `backend/controllers/jobController.js` | Screen on create/update; hide `hidden` jobs from listings and direct fetch; block suspended recruiters from posting |
| `backend/controllers/companyController.js` | Screen on setup completion |
| `backend/controllers/aiController.js` | Screen each stored resume analysis |
| `backend/middlewares/authMiddleware.js` | New `adminOnly` guard |
| `backend/routes/jobRoutes.js` | `optionalAuth` on `GET /:id` so owners can still see a hidden job |
| `backend/server.js` | Mounts `/api/moderation` |

### Frontend
| File | Change |
|---|---|
| `src/pages/Admin/ModerationQueue.jsx` | **New.** The review queue |
| `src/App.jsx` | Routes `/admin-moderation`, `/admin/moderation` |
| `src/utils/data.js` | "Trust & Safety" in the admin nav |
| `src/utils/apiPath.js` | `MODERATION` paths |

### Database — new models
- `RiskAssessment` — one scoring run: signals, rule score, AI adjustment, final band
- `ModerationCase` — the workflow object, one open case per entity+category
- `ModerationEvent` — append-only audit trail

### Database — new fields
- `Job.moderationState` (`clear` / `flagged` / `hidden`), `Job.contentHash`, `Job.duplicateOfId`
- `User.trustState` (`clear` / `flagged` / `suspended`), `User.trustReviewedAt`
- `Company.trustState` — the automated signal, kept separate from the editorial `verified` badge

---

## 4. Setup

### Environment

All optional — every value has a working default.

```bash
FRAUD_AI_MAX_ADJUSTMENT=15      # cap on AI influence, in points
FRAUD_AI_MIN_SCORE=30           # rule score below which no AI call is made
FRAUD_CASE_MIN_SCORE=35         # score at which a case opens for a human
FRAUD_AUTO_ACTION_MIN_SCORE=80  # score at which enforcement fires automatically
```

Screening reuses the existing `GROQ_API_KEY`. No new provider.

### Apply the schema

```bash
cd backend
npm run prisma:push
npm run prisma:generate
```

### Verify the detectors

```bash
cd backend
npm run check:fraud
```

---

## 5. Thresholds and what happens at each

| Score | Band | What happens |
|---|---|---|
| 0–34 | low | Assessment recorded. No case, nothing visible to anyone. |
| 35–59 | medium | Case opened. Content stays live. |
| 60–79 | high | Case opened, prioritised above medium. Content stays live. |
| 80–100 | critical | Case opened **and** enforcement fires. |

Automatic enforcement at critical:

- **Job** → `moderationState = hidden`, drops out of listings and direct fetch
- **Recruiter** → `trustState = suspended`, and their live adverts are hidden with them
- **Company** → `trustState = flagged` (flag only; no content removed)
- **Resume** → **nothing.** Never auto-rejected.

That last one is deliberate. The cost of wrongly blocking a real jobseeker is far higher
than the cost of a reviewer reading one more CV, so fake-resume cases are always decided by
a person.

Note also that `flagged` never removes content. Only `hidden` does. A false positive should
never silently kill a real employer's advert.

---

## 6. API reference

All routes require `role === "admin"`.

| Method | Route | Purpose |
|---|---|---|
| `GET` | `/api/moderation/stats` | Queue counts, hidden/suspended totals, dismissal rate, live thresholds |
| `GET` | `/api/moderation/cases` | List. Filters: `state`, `category`, `band`, `page`, `limit` |
| `GET` | `/api/moderation/cases/:id` | One case with signals, AI reasoning, subject, history |
| `POST` | `/api/moderation/cases/:id/decision` | `{ action, note }` |
| `POST` | `/api/moderation/rescan` | `{ entityType, entityId }` — re-run screening |

Actions: `dismiss`, `hide_job`, `restore_job`, `suspend_recruiter`, `reinstate_recruiter`,
`flag_company`, `clear_company`, `reject_resume`, `escalate`.

Every action writes a `ModerationEvent` with the actor's id and name. A decided case cannot
be re-decided (409) — reopening means a fresh scan.

---

## 7. The review screen

`/admin-moderation`, in the admin sidebar as **Trust & Safety**.

The screen is built on one principle: **a reviewer should never have to take the score on
trust.** Before any action button is reachable, the case shows:

- the arithmetic, spelled out — `rules 72 +8 AI = 80`
- every rule that fired, its weight, and a plain-English explanation of what it saw
- the AI verdict, its confidence, and its reasons tagged as supporting fraud or legitimacy
- a note that the model can move the score by at most ±15
- the subject record, and the full case history

The queue sorts by score, not date: a critical case deserves attention ahead of an older
medium one.

The headline stats include a **dismissal rate**. A queue that only ever upholds is not
reviewing, it is rubber-stamping — that number is there to make the failure visible.

---

## 8. What was verified

`npm run check:fraud` — 15 behavioural checks, all passing. The suite deliberately leads
with false-positive cases, because that is the failure mode that ships:

| Case | Result |
|---|---|
| Established clinic, full profile | **0** — clean |
| Genuine micro-business on Gmail, no website | **37** — case opens, no enforcement |
| Shell company on a throwaway domain, 9 jobs in 3h | **98** — critical |
| Advance-fee driver scam | **100** — critical |
| Credential harvesting ("send your bank account number") | **85** — critical |
| Honest nursing advert | **0** — clean |
| Exact repost, same employer | **60** |
| Same advert from a different employer | **85** — scraping scores higher |
| Unrelated jobs | **0** |
| Fabricated resume (stuffed, future-dated, shared file) | **100** |
| Genuine full-length CV | **0** |
| Twelve trivial signals | **34** — below case threshold |

Also verified: schema validates, Prisma client generates, all touched backend files parse,
the module graph loads, frontend builds, and ESLint is unchanged at 78 pre-existing problems.

### Calibration notes found while testing

- A terse senior CV (54 words) scores **28** on `thin_senior_claim` alone. That is below the
  case threshold, so it opens nothing — the signal contributes but does not accuse. A
  full-length version of the same CV scores 0.
- A Gmail-based micro-business lands at 37, which opens a case. This is intentional and
  should be watched: in a market where small firms legitimately use free mail, the dismissal
  rate on `fake_company` is the metric that tells you whether this threshold is right.

---

## 9. Security notes

**Prompt injection.** Every payload sent for adjudication is fenced, explicitly labelled as
untrusted data, and the model is instructed that text resembling an instruction is itself a
fraud signal. Numeric output is clamped on return regardless of what the model says.

**Regional calibration.** The adjudication prompt states that Ghanaian small businesses
legitimately use Gmail and may have no website, so ordinary informality is not treated as
fraud. `free_contact_email` carries weight 18; `disposable_contact_email` carries 55.

**Cost.** AI adjudication only runs at rule score ≥30, so the common case — a clean advert —
costs nothing. Screening runs after the HTTP response via `screenInBackground`, so an
employer never waits on it, and a screening failure can never block a legitimate publish.
Manual rescan is rate-limited at 60/hour.

**Access.** Every moderation route is behind `protect` + `adminOnly`.

---

## 10. Known limits and next steps

1. **Duplicate comparison is bounded** to the 400 most recent live jobs. Correct at current
   volume; beyond a few thousand live adverts this needs a proper index (MinHash/LSH or
   pgvector) rather than an in-process scan.
2. **No appeals flow.** A suspended recruiter sees a message telling them to contact support,
   but there is no in-product route to contest it. That is the most valuable next addition.
3. **Resume screening only runs on analysed resumes.** A CV uploaded to Documents but never
   put through the analyser is not screened.
4. **Rate-limit state is per-process,** like the existing AI limiter. Behind multiple replicas
   it needs Redis.
5. **No reviewer-agreement tracking.** The dismissal rate is visible, but there is no
   per-signal precision breakdown to show *which* rule is generating the false positives.
6. **Not exercised against live data.** Detectors are unit-tested and the API and UI are
   built and linted, but no end-to-end run against a seeded database has been performed.

---

## 11. Quick manual test

```bash
cd backend && npm run prisma:push && npm run dev
# in another shell
npm run dev
```

1. Sign in as an employer and post a job whose description contains
   *"a non-refundable registration fee of GHS 200 is required"*.
2. The job publishes normally — screening runs after the response.
3. Within a second or two it is hidden: it disappears from `/find-jobs`, and a direct link
   404s for the public while still loading for its owner.
4. Sign in as an admin, open **Trust & Safety**. The case is at the top, critical, with
   `candidate_fee` as the heaviest signal and `auto: recruiter suspended`.
5. Open it. Confirm the score arithmetic, the rule list, and the AI reasoning are all shown.
6. Choose **Reinstate recruiter** with a note. The recruiter's jobs return to the listing and
   the note is recorded in the case history.

To test duplicates, publish the same advert twice from one account and then from a second —
the cross-employer copy should score higher than the self-repost.
