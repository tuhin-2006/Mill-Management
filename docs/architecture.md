# Architecture & Decisions

## Structure
The project follows a clean, feature-based modular layout:
- `src/app/`: Thin routing layer with layouts, error boundaries, and root styles.
- `src/components/`: Reusable presentation primitives (`ui/`), layout shells (`layout/`), and cross-feature components (`shared/`).
- `src/features/`: Feature-sliced modules (`components/`, `actions/`, `schemas/`, `types/`) for future domain logic (meals, members, expenses, deposits).
- `src/lib/`: Core helpers and infrastructure:
  - `supabase/`: Browser (`client.ts`) and Server (`server.ts`) clients using `@supabase/ssr`.
  - `env.ts`: Safe Zod environment variable parsing.
  - `utils.ts`: Small utility functions (e.g. `cn`).
- `src/hooks/`: Reusable React hooks.
- `src/types/`: Global domain TypeScript interfaces.
- `src/config/`: App metadata and configuration (`site.ts`).
- `docs/`: Design and architectural decisions.
- `supabase/`: Database migrations, seed data, and schema definitions.
