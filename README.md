# Personal Mill Management System

A calm, modern, and reliable management system for personal and mess mills built with Next.js (App Router), TypeScript, Tailwind CSS, and Supabase.

---

## 🛠️ Tech Stack

- **Framework:** Next.js 16 (App Router, Turbopack)
- **Language:** TypeScript 5
- **Styling:** Tailwind CSS v4 (Design tokens with light/dark theme)
- **Database & Auth:** Supabase (`@supabase/supabase-js`, `@supabase/ssr`)
- **Validation:** Zod
- **Icons & UI:** Lucide React, Sonner (Toasts)
- **Dates:** date-fns

---

## 📁 Folder Structure

```text
src/
├── app/                  # Routes and layouts (thin; no business logic)
│   ├── layout.tsx        # Root HTML layout with fonts and toast provider
│   ├── page.tsx          # Setup status verification homepage
│   └── globals.css       # Tailwind CSS & design tokens
├── components/
│   ├── ui/               # Small reusable primitives (buttons, cards, inputs)
│   ├── layout/           # App shell components (header, sidebar)
│   └── shared/           # Reusable cross-feature components
├── features/             # Feature modules (components/, actions/, schemas/, types/)
├── lib/
│   ├── supabase/
│   │   ├── client.ts     # Supabase browser client
│   │   └── server.ts     # Supabase server client (async cookies)
│   ├── env.ts            # Safe Zod-validated environment config
│   └── utils.ts          # Utility functions (cn class combiner)
├── hooks/                # Custom React hooks
├── types/                # Domain-wide TypeScript type definitions
└── config/
    └── site.ts           # App name and metadata configuration
docs/                     # Notes and architecture decisions
supabase/                 # Database migrations and seed files
```

---

## 🚀 Setup & Getting Started

### 1. Clone & Install Dependencies

```bash
npm install
```

### 2. Configure Environment Variables

Copy the example environment template:

```bash
cp .env.example .env.local
```

Fill in your Supabase project credentials in `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### 3. Run the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 📋 Available Commands

- `npm run dev` – Starts the local development server with Turbopack.
- `npm run build` – Builds the project for production.
- `npm run start` – Starts the production server.
- `npm run lint` – Runs ESLint checks across the codebase.
- `npx tsc --noEmit` – Runs TypeScript static type checking.
