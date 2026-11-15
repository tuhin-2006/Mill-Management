# Architecture & Development Guidelines

## 1. Project Directory Structure

```text
src/
├── app/                  # Next.js App Router: routes, layouts, error boundaries (thin layer)
│   ├── (app)/            # Authenticated application shell route group
│   │   ├── layout.tsx    # App shell (desktop sidebar, mobile drawer, header)
│   │   ├── loading.tsx   # Dashboard loading skeleton
│   │   └── page.tsx      # Dashboard view
│   ├── error.tsx         # Root error boundary
│   ├── globals.css       # Tailwind CSS v4 & theme design tokens
│   ├── layout.tsx        # Root layout with fonts, ThemeProvider, and Toaster
│   └── not-found.tsx     # 404 page
├── components/           # Reusable presentation components
│   ├── layout/           # App shell pieces (sidebar, headers, theme toggle)
│   ├── shared/           # Cross-feature components (empty-state, setup-status-card)
│   └── ui/               # Hand-crafted UI primitives (button, card, input, label, badge, skeleton)
├── config/               # App configuration & navigation (site.ts, navigation.ts)
├── features/             # Feature modules (members, meals, expenses, deposits, reports)
├── hooks/                # Reusable React hooks
├── lib/                  # Core utilities & infrastructure
│   ├── supabase/         # Minimal browser & server Supabase clients (@supabase/ssr)
│   ├── env.ts            # Safe Zod-validated environment config
│   └── utils.ts          # Pure helpers (cn with clsx & tailwind-merge)
└── types/                # Global TypeScript domain definitions
docs/                     # Architectural decisions & notes
supabase/                 # Migrations & seed scripts
```

---

## 2. Naming Conventions

- **Files and Folders:** Always use `kebab-case` (e.g. `page-header.tsx`, `setup-status-card.tsx`, `theme-toggle.tsx`).
- **React Components:** Always use `PascalCase` for component functions and exported symbols (e.g. `PageHeader`, `ThemeToggle`, `Button`).
- **Hooks:** Always prefix with `use` in `camelCase` (e.g. `useMediaQuery.ts`, `useDebounce.ts`).
- **Types and Interfaces:** Use `PascalCase` (e.g. `NavItem`, `ButtonProps`, `UserSession`).

---

## 3. Server vs. Client Components

- **Server Components by Default:** Keep all components, pages, and layouts as React Server Components unless client-side capabilities are strictly needed.
- **When to Add `"use client"`:**
  - When using React state or lifecycle hooks (`useState`, `useEffect`, `useReducer`).
  - When listening to browser events (`onClick`, `onChange`, `onSubmit`).
  - When utilizing browser-only APIs (`window`, `localStorage`, `document`).
  - Keep client boundaries as low in the component tree as possible (e.g., `ThemeToggle` is a client component, but its parent `header` can remain a server layout piece).

---

## 4. Where Things Belong

| Location | Responsibility |
| :--- | :--- |
| `src/app/` | Routing, page shells, metadata, error boundaries, loading skeletons. **No business logic.** |
| `src/components/ui/` | Small, un-opinionated UI primitives (button, card, badge). |
| `src/components/layout/` | Shell layouts, headers, sidebars, navigation bars. |
| `src/components/shared/` | Reusable presentation widgets used across multiple features. |
| `src/features/<feature>/` | Isolated domain modules containing `components/`, `actions/`, `schemas/`, and `types/`. |
| `src/lib/` | Reusable clients, third-party wrappers, validation schemas, utilities. |

---

## 5. Strict Feature Isolation Import Rule

- A feature inside `src/features/<name>/` **may** import from:
  - `src/components/*`
  - `src/lib/*`
  - `src/hooks/*`
  - `src/types/*`
  - `src/config/*`
- A feature **must NEVER** import directly from another feature (e.g., `features/meals` must never import from `features/expenses`).
- Cross-feature interactions must occur through shared domain contracts (`src/types/`), standard database relationships, or composed top-level pages.
