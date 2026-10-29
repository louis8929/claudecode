---
paths:
  - "frontend/**"
  - "**/*.jsx"
  - "**/*.tsx"
  - "**/src/**/*.ts"
  - "**/src/**/*.js"
  - "**/package.json"
---

# React rules

## Components
- Function components + hooks only. One exported component per file; file name = component name.
- Props are typed (TypeScript types or PropTypes). No `any` in TypeScript.
- Keep components presentational where possible; move data fetching into custom hooks (`useXxx`).
- Lists render with stable, unique `key`s — never the array index for reorderable/filterable lists.

## Hooks
- Follow the Rules of Hooks (top level, React functions only).
- `useEffect` dependency arrays are complete; do not silence `react-hooks/exhaustive-deps`.
- Effects that subscribe, time out, or fetch must clean up (`AbortController`, `clearTimeout`, unsubscribe).
- Don't use effects to derive state that can be computed during render.
- `useMemo` / `useCallback` only when a measured or obvious re-render cost exists.

## State and data
- Server state through one data layer (e.g. React Query / a shared API client), not ad-hoc `fetch` in components.
- Handle the three states for every async call: loading, error, success.
- API base URL comes from environment config (`import.meta.env` / `process.env.REACT_APP_*`), never hard-coded hosts.

## Security
- No `dangerouslySetInnerHTML` unless the content is sanitized (DOMPurify) and the reason is commented.
- No `eval`, `new Function`, or `javascript:` URLs.
- Do not store access tokens in `localStorage`/`sessionStorage`; authentication goes through
  **OKTA** (Workforce for internal users, CIAM for customers) using the official SDK.
- Never put tokens or PII in URLs or query strings.

## Accessibility
- Interactive elements are real `<button>`/`<a>`; every input has a label; images have `alt`.
- Keyboard reachable, visible focus, no information conveyed by colour alone.

## Hygiene
- No `console.log` in committed code. No commented-out code.
- Error boundaries around route-level components.
