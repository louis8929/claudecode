#!/usr/bin/env node
// PreToolUse (Bash|PowerShell): block destructive, outward-facing, or security-reducing commands.
// Deterministic policy layer: the agent cannot talk its way past it.
import { block, readHookInput } from "./lib.mjs";

const input = await readHookInput({ failClosed: true });
const cmd = String(input.tool_input?.command || "");

const RULES = [
  [/\brm\s+-[a-zA-Z]*(r[a-zA-Z]*f|f[a-zA-Z]*r)\b/, "Recursive forced delete (rm -rf)."],
  [/\bRemove-Item\b[^|;]*-Recurse\b[^|;]*-Force\b|\bRemove-Item\b[^|;]*-Force\b[^|;]*-Recurse\b/i, "Recursive forced delete (Remove-Item -Recurse -Force)."],
  [/\b(rmdir|rd)\s+\/s\b/i, "Recursive directory delete."],
  [/\bgit\s+push\b[^|;&]*(\s--force\b|\s-f\b|\s--force-with-lease\b|\s\+\S)/, "Force push rewrites shared history."],
  [/\bgit\s+reset\s+--hard\b/, "git reset --hard discards work."],
  [/\bgit\s+clean\s+-[a-zA-Z]*f/, "git clean -f deletes untracked files."],
  [/\bgit\s+(checkout|restore)\s+(--\s+)?\.(\s|$)/, "Discards all local changes."],
  [/\bgit\s+branch\s+-D\b/, "Force-deletes a branch."],
  [/\bgit\s+(commit|push|merge|rebase)\b[^|;&]*--no-verify\b/, "Skipping git hooks is not allowed."],
  [/\bgit\s+(filter-branch|filter-repo)\b|\bgit\s+rebase\b[^|;&]*\s-i\b/, "History rewriting."],
  [/\b(curl|wget|iwr|Invoke-WebRequest|irm|Invoke-RestMethod)\b[^|]*\|\s*(sudo\s+)?(sh|bash|zsh|pwsh|powershell|iex|Invoke-Expression|node|python3?)\b/i, "Piping a remote script into an interpreter."],
  [/\bmvnw?(\.cmd)?\b[^|;&]*\b(deploy|release:perform|release:prepare)\b/, "Maven deploy/release publishes artifacts."],
  [/\b(npm|yarn|pnpm)\s+(publish|unpublish|deprecate)\b/, "Publishing packages."],
  [/\b(npm|yarn|pnpm)\s+(i|install|add)\b[^|;&]*\s(git\+|github:|https?:\/\/)/, "Installing a dependency from a git URL / unverified source."],
  [/\bkubectl\s+(delete|apply|replace|patch|scale|drain)\b/, "Mutating cluster command."],
  [/\bterraform\s+(apply|destroy|import|state\s+rm)\b/, "Mutating infrastructure command."],
  [/\b(aws|gcloud|az)\b[^|;&]*\b(delete|remove|rm|destroy|put-|create-|update-|set-iam|add-iam)/i, "Mutating cloud command."],
  [/\bkafka-topics(\.sh|\.bat)?\b[^|;&]*--(delete|alter)\b/, "Deleting/altering Kafka topics."],
  [/\bkafka-consumer-groups(\.sh|\.bat)?\b[^|;&]*(--reset-offsets[^|;&]*--execute|--delete)\b/, "Resetting offsets / deleting consumer groups."],
  [/\bkafka-(delete-records|configs|acls|reassign-partitions)(\.sh|\.bat)?\b[^|;&]*--(alter|add|remove|execute|offset-json-file)\b/, "Mutating Kafka cluster command."],
  [/\b(DROP\s+(TABLE|DATABASE|SCHEMA)|TRUNCATE\s+TABLE)\b/i, "Destructive SQL."],
  [/\bDELETE\s+FROM\s+\w+\s*(;|"|'|$)/i, "Unbounded DELETE without WHERE."],
  [/\bchmod\s+(-R\s+)?777\b/, "World-writable permissions."],
  [/\bsudo\b|\brunas\b/i, "Privilege escalation."],
  [/\b(Set-ExecutionPolicy|Set-MpPreference|netsh\s+advfirewall|reg\s+(add|delete))\b/i, "Changes system/security settings."],
  [/\.claude[\\/](settings(\.local)?\.json|hooks[\\/])/, "Modifying the agent's own guardrails from a shell command."],
];

for (const [pattern, reason] of RULES) {
  if (pattern.test(cmd)) {
    block(
      `BLOCKED by .claude/hooks/guard-bash.mjs: ${reason}\n` +
        `Command: ${cmd.slice(0, 300)}\n` +
        `Do not retry with a variant or workaround. Explain to the developer what you wanted to do ` +
        `and let them run it themselves if they agree.`
    );
  }
}
process.exit(0);
