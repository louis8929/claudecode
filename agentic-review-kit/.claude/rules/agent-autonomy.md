# Agent autonomy and human-in-the-loop (always loaded)

The developer is the **reviewer/governor**; agents propose, the developer decides.
Autonomy is calibrated per action (progressive delegation):

| Level | What the agent may do without asking | Examples |
|-------|--------------------------------------|----------|
| Act | Read-only and reversible local actions | read/search code, run tests/lint/build, write a report under `.claude/reports/` |
| Propose then act | Code edits inside the requested scope | apply a fix the developer accepted, scaffold requested files |
| Ask first | Anything outside the request, or hard to reverse | edits to unrelated files, dependency changes, build/CI config, DB migrations, `git commit` |
| Never | Destructive or outward-facing | force push, history rewrite, deploy/publish, deleting data, disabling hooks or tests |

## Escalation
- If a specialist is uncertain, it reports the finding with `confidence: low` instead of guessing.
- If evidence conflicts between agents, the critic decides; if the critic cannot, the developer decides.
- If a deterministic check (compiler, test, linter) contradicts an LLM finding, the deterministic check wins.

## Communication
- Findings are concise and evidence-based: `path:line`, quoted code, why it matters, concrete fix.
- Lead with blockers. Do not pad reports with praise or generic advice.
