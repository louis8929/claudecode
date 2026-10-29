---
name: review-eval
description: Measure the multiagent reviewer's quality (recall, precision, severity accuracy) on seeded-bug fixtures. Use after changing any reviewer agent, rule, or the /review skill, or when the developer asks to evaluate or benchmark the review system.
allowed-tools: Read, Grep, Glob, Write, Agent
disable-model-invocation: true
---

# /review-eval — validation and measurement

Changes to prompts and rules are changes to the system; measure them like code.

Fixtures: `.claude/skills/review-eval/fixtures/` (deliberately flawed code — never copy into production).
Ground truth: `.claude/skills/review-eval/expected.json`.

## Steps
1. Read `expected.json`.
2. Run the review pipeline exactly as `/review` does (steps 2–5) with the fixture files as the explicit scope:
   specialists in parallel, then `review-critic`. Do not tell the agents these are fixtures or what to find.
3. Match final findings to expected issues: a match = same file, line within ±3, and same issue
   (judge by meaning, not wording).
4. Compute:
   - **Recall** = matched expected / total expected (by severity too: blocker recall must be 100%).
   - **Precision** = matched findings / total final findings (unmatched findings are not automatically wrong —
     list them for manual triage).
   - **Severity accuracy** = matched findings with the expected severity / matched.
   - **Critic effect** = findings rejected by the critic that were in fact expected (should be 0).
5. Append a row to `.claude/skills/review-eval/results.md`:
   `| date | recall | blocker recall | precision | severity acc. | critic false rejects | notes |`
6. Report the row and the misses. If blocker recall < 100% or recall dropped versus the previous row,
   say which agent/rule most likely caused it.
