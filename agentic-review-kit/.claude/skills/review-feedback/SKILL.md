---
name: review-feedback
description: Record the developer's verdict on review findings (accepted, rejected, false positive) into the review memory so future reviews improve. Use after /review when the developer says which findings were right or wrong.
argument-hint: "[report path] e.g. 'BE-1 accepted, SEC-3 false positive: Spring already escapes this'"
allowed-tools: Read, Edit, Write, Glob
---

# /review-feedback — improvement loop

Non-parametric learning: the system improves by curating what reviewers see next time,
not by retraining. Keep the memory small, specific and high-signal.

Input: `$ARGUMENTS` (finding ids with verdicts and reasons). If no report path is given, use the
newest file in `.claude/reports/`.

## Steps
1. Read the report and locate each referenced finding.
2. For each verdict, derive a **generalised, reusable** lesson — a pattern, not a one-off:
   - Good: `REJECT · backend · Flagging missing @Transactional on Spring Data repository methods — they are transactional by default.`
   - Bad: `SEC-3 was wrong.`
3. Open `.claude/review-memory/learnings.md` (create it from the template below if missing).
   - If an equivalent lesson exists, increment its `hits` counter instead of adding a duplicate.
   - Otherwise append it under the right section.
4. Keep the file under ~60 lessons: if larger, merge similar lessons and drop the lowest-hit ones.
5. Never store code that contains secrets, customer data, or personal data — describe the pattern instead.
6. Reply with the lessons added/updated (one line each).

## Template
```markdown
# Review learnings
Curated from developer feedback via /review-feedback. Read by review-critic and /review.
Format: VERDICT · area · lesson · hits

## Accepted patterns (raise confidence)

## Rejected patterns (likely false positives)

## Project conventions discovered
```
