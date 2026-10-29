#!/usr/bin/env node
// PostToolUse (*) + SubagentStop: append-only audit trail of agent actions.
// Logs metadata only (tool, file, truncated + redacted command) — never file contents.
import { appendFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { projectDir, readHookInput, redact } from "./lib.mjs";

const input = await readHookInput();
const root = projectDir(input);
const ti = input.tool_input || {};

const entry = {
  ts: new Date().toISOString(),
  session: input.session_id,
  event: input.hook_event_name,
  tool: input.tool_name,
  agent: input.agent_type || undefined,
  file: ti.file_path || ti.path || undefined,
  command: ti.command ? redact(ti.command).slice(0, 200) : undefined,
  subagent: ti.subagent_type || undefined,
};

try {
  const dir = join(root, ".claude", "logs");
  mkdirSync(dir, { recursive: true });
  appendFileSync(join(dir, "audit.jsonl"), JSON.stringify(entry) + "\n");
} catch {
  // never fail the tool call because of logging
}
process.exit(0);
