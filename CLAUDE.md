# nest-test

Agent: **Friday**. NestJS playground for ShadowWalker.

## Stack

- NestJS 11, TypeScript (strict), Express platform
- Package manager: npm
- Tests: Jest + Supertest

## Commands

```bash
npm run start:dev   # watch mode, http://localhost:3000
npm test            # unit (src/**/*.spec.ts)
npm run test:e2e    # e2e (test/)
npm run build
```

## Conventions

- Generate with `npx nest g <schematic> <name>` — do not hand-roll modules/controllers/services when the CLI can.
- TDD: failing test first, then minimal code, then refactor.
- Keep unit tests next to source (`*.spec.ts`). HTTP contracts live in `test/*.e2e-spec.ts`.
- Integration tests belong in `test/` as `*.int-spec.ts` when a feature needs them.
- No `--no-verify`. No Co-Authored-By.
- Fix, do not rewrite, unless asked.
