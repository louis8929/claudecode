---
name: react-component
description: Scaffold a React component (and optional data hook) with tests that follow the team React rules and the project's existing conventions. Use when the developer asks to create a component, page, form or hook in the frontend.
argument-hint: "<ComponentName> <purpose>, e.g. 'CustomerSummaryCard shows name, status and last invoice'"
---

# /react-component

Request: `$ARGUMENTS`

## 1. Learn the project before writing
- `package.json`: TypeScript or JS, test runner (Vitest/Jest), styling (CSS modules, Tailwind, MUI, styled-components),
  data layer (React Query, Redux Toolkit, SWR, plain API client), router.
- Find 1–2 similar components and their tests; **mirror folder structure, file naming, export style,
  styling approach and test setup.** Existing code wins over this skill when they disagree.

## 2. Confirm the plan (one short message, then wait)
Props (names, types, required), states rendered (loading / error / empty / success), the data source,
and files to create. Ask only what you cannot infer.

## 3. Generate
- `ComponentName.tsx|jsx` — function component, typed props, semantic HTML, labels/alt text,
  no `console.log`, no `any`, no `dangerouslySetInnerHTML`.
- If it fetches data: `useXxx` hook in the project's data layer, with cancellation and the three async states.
- `ComponentName.test.tsx|jsx` — React Testing Library: renders each state, user interaction via `userEvent`,
  queries by role/label, network mocked at the boundary (MSW if the project uses it).
- Export from the folder `index` if the project uses barrel files.

## 4. Finish
Run `/verify frontend --fast`. Report created files as links and results in a few lines.
