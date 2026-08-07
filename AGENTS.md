# AGENTS.md

## Project overview

This repository contains a baby activity tracker built with Angular 20, Ionic 8, TypeScript, Firebase, and Capacitor. The application uses Angular standalone components and lazy-loaded routes rather than NgModules.

## Repository layout

- `src/app/pages/`: feature pages, typically with matching `.ts`, `.html`, `.scss`, and `.spec.ts` files.
- `src/app/services/`: application and persistence services with colocated Jasmine tests.
- `src/app/shared/`: shared utilities and validators.
- `src/app/guards/`: functional Angular route guards.
- `src/app/firebase/`: Firebase initialization and tracker storage integration.
- `src/app/app.routes.ts`: top-level lazy-loaded routes and access guards.
- `src/theme/variables.scss`: Ionic theme variables.
- `src/global.scss`: global application styles.
- `src/environments/`: development and production configuration.
- `android/` and `ios/`: Capacitor native projects, when present.

## Development commands

- Install dependencies: `npm install`
- Start the development server: `npm start`
- Build the application: `npm run build`
- Run lint checks: `npm run lint`
- Run tests: `npm test -- --watch=false`
- Run a focused test in the existing Karma setup by temporarily using Jasmine's `fdescribe`/`fit`; remove focused markers before finishing.

## Coding conventions

- Follow the existing TypeScript, Angular, and Ionic patterns in nearby files.
- Build new UI as standalone components/pages and declare required Angular and Ionic dependencies in the component's `imports` array.
- Keep page logic, template, styles, and tests colocated under the page directory.
- Put reusable business or persistence logic in an injectable service instead of duplicating it in pages.
- Lazy-load new pages in `app.routes.ts`. Apply `authGuard` and `caregiverAccessGuard` to authenticated tracker features unless the route intentionally has different access rules.
- Use strict types. Avoid `any`, non-null assertions, and unchecked casts unless integration boundaries make them unavoidable.
- Prefer RxJS or Angular lifecycle-aware cleanup for subscriptions and timers. Do not leave listeners active after a component is destroyed.
- Use Ionic components and theme variables for UI consistency. Keep page-specific styling in its `.scss` file and reserve `global.scss` for genuinely global rules.
- Register any new Ionicons used by templates through the established icon registration pattern.
- Preserve existing data shapes and storage keys unless a migration or compatibility strategy is included.
- Treat baby, caregiver, health, and family information as sensitive. Do not log personal data, authentication tokens, invitation codes, or complete stored records.
- Do not add secrets to environment files. Firebase client configuration may be public, but privileged credentials and service-account keys must never be committed.

## Testing expectations

- Add or update a colocated `*.spec.ts` file whenever behavior changes.
- Cover success, empty-state, validation, and failure paths relevant to the change.
- Mock Firebase, Capacitor, browser, notification, camera, and storage boundaries; unit tests must not depend on live services or device hardware.
- Use deterministic dates and times in tests. Avoid assumptions about the machine's locale or timezone.
- For bug fixes, add a regression test that fails without the fix whenever practical.
- Before handing off a change, run the narrowest relevant tests, then `npm run lint` and `npm run build` when the scope warrants it.

## Change discipline

- Keep changes focused on the requested task and preserve unrelated user modifications.
- Do not edit generated build output or dependency directories.
- Avoid changing native Capacitor projects unless the feature requires native configuration.
- If a data model or Firebase access pattern changes, consider existing users, offline behavior, permissions, and backward compatibility.
- Summarize changed files and verification performed when handing work back.
