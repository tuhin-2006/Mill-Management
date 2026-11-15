# Personal Mill Management System (ব্যক্তিগত মিল ম্যানেজমেন্ট সিস্টেম)

A modern, fast, and production-quality private meal and expense tracking system for a 4-member mess group, built with **Next.js 16 (App Router)**, **TypeScript**, **Tailwind CSS v4**, and **Supabase (PostgreSQL + Auth)**.

---

## 🌟 Key Features

1. **Private Single-Admin Access:**
   - Dedicated Admin authentication using Supabase Auth.
   - Protected routes with server-side layout verification (unauthenticated requests are redirected to `/login`).
   - Strict Row Level Security (RLS) policies ensuring only the authenticated administrator has read/write permissions.

2. **Meal Sessions & Schedule Rules:**
   - Two daily meal sessions: **Lunch (দুপুর)** and **Dinner (রাত)**.
   - **Saturday to Thursday:** Both Lunch and Dinner enabled.
   - **Friday Special Rule:** Lunch only. Friday Dinner is automatically disabled and hidden to prevent accidental entries.
   - Configurable Meal Price: Default **৳60.00 BDT** per meal (historical entries preserve their original unit price).
   - Timezone: Precise date calculations handled in **Asia/Dhaka**.

3. **Core Modules & Dashboard:**
   - **Main Dashboard (`/`):** Real-time financial summary cards (Total Meals, Total Expenses, Total Deposits, Group Balance, Cost per Member, Active Members), Member balances table with green/red status badges, today's meal records, and quick actions.
   - **Daily Meal Entry (`/meals`):** Visual calendar date picker with Bangladesh weekday indicator, Friday dinner auto-disable warning, 4-member toggles with live cost calculation, and instant save/update/clear controls.
   - **Members Management (`/members`):** Roster listing (Tuhin, Rahim, Karim, Hasan) with editable names, active/inactive statuses, and an individual Ledger History modal showing full meal and deposit logs per member.
   - **Deposit & Balance (`/deposits`):** Add funds with quick preset chips (৳500, ৳1000, ৳2000, ৳5000), date selection, notes, and a searchable/deletable deposit history table.
   - **Total Mill Ledger (`/ledger`):** Comprehensive date-range ledger displaying daily lunch/dinner counts, total meals, and total costs, with one-click **CSV Export**.
   - **History & Reports (`/reports`):** Monthly and all-time audit breakdown (Total Meals, Total Cost, Total Deposits, Net Balance, and individual breakdown per member) with CSV download.
   - **Settings (`/settings`):** Manage meal price (৳ BDT), app title, timezone info, and change admin password.

---

## 🛠️ Tech Stack

- **Framework:** Next.js 16 (App Router, Turbopack)
- **Language:** TypeScript 5 (Strict Mode, 0 any types)
- **Styling:** Tailwind CSS v4 (Modern CSS variables, Light & Dark themes)
- **Database & Auth:** Supabase (PostgreSQL with RLS + GoTrue Auth)
- **State & Data Fetching:** React 19 Server & Client Components
- **Validation:** Zod schemas
- **Icons & UI:** Lucide React & Sonner (Toast notifications)
- **Dates & Currency:** date-fns, Intl Bangladeshi Taka (৳ BDT)

---

## 📁 Project Structure

```text
src/
├── app/
│   ├── (app)/                 # Protected application routes (admin only)
│   │   ├── layout.tsx         # Auth guard & responsive app shell
│   │   ├── page.tsx           # Dashboard view (KPIs, balances, meals)
│   │   ├── meals/page.tsx     # Daily meal entry with Friday dinner rule
│   │   ├── members/page.tsx   # Member roster & detailed ledger modal
│   │   ├── deposits/page.tsx  # Deposit collection & transaction ledger
│   │   ├── ledger/page.tsx    # Daily meal ledger & CSV export
│   │   ├── reports/page.tsx   # Monthly/periodic audit reports & export
│   │   └── settings/page.tsx  # Meal price & admin password settings
│   ├── login/page.tsx         # Secure admin login
│   ├── globals.css            # Tailwind CSS design tokens
│   ├── layout.tsx             # Root layout with fonts, theme, & toast
│   ├── error.tsx              # Error boundary
│   └── not-found.tsx          # 404 page
├── components/
│   ├── layout/                # App shell (collapsible sidebar, mobile drawer, header)
│   ├── shared/                # Shared widgets (MigrationAlert, EmptyState)
│   └── ui/                    # UI primitives (button, card, input, badge, skeleton)
├── config/
│   ├── navigation.ts          # Sidebar navigation items
│   └── site.ts                # Metadata and site configuration
├── lib/
│   ├── supabase/
│   │   ├── client.ts          # Browser Supabase client
│   │   └── server.ts          # Server Supabase client (async cookies)
│   ├── services.ts            # Supabase database queries & business logic
│   ├── date.ts                # Asia/Dhaka date helpers & BDT currency formatter
│   ├── csv.ts                 # Client-side CSV generator & downloader
│   └── utils.ts               # Tailwind cn helper
├── types/
│   └── index.ts               # Domain types (Member, MealEntry, Deposit, Settings)
scripts/
├── setup-admin.mjs            # Admin user provisioner
└── seed.mjs                   # Settings & default member seed script
supabase/
└── migrations/
    └── 001_initial_schema.sql # Complete PostgreSQL schema, RLS, & triggers
```

---

## ⚡ Setup & Supabase Database Migration

### 1. Execute SQL Migration in Supabase

1. Open your Supabase Dashboard SQL Editor (`https://supabase.com/dashboard/project/_/sql`).
2. Click **New query**.
3. Copy the entire contents of [`supabase/migrations/001_initial_schema.sql`](supabase/migrations/001_initial_schema.sql) and paste it into the SQL editor.
4. Click **Run** (or press `Ctrl+Enter`).
5. This creates all tables (`settings`, `members`, `meal_entries`, `deposits`, `adjustments`, `profiles`), enables RLS, creates auto-update triggers, and seeds the 4 initial members (**Tuhin**, **Rahim**, **Karim**, **Hasan**) and default settings (**৳60.00/meal**).

### 2. Verify or Seed Database (Optional)

After running the SQL migration, you can run the seed script to verify:

```bash
node scripts/seed.mjs
```

### 3. Admin Login Credentials

An initial admin account has already been registered in your Supabase Auth:
- **Email:** `admin@mill.local`
- **Password:** `Admin123456!`

*(You can also create a new admin or update credentials at any time by running `node scripts/setup-admin.mjs <your-email> <your-password>` or via the `/settings` page after logging in).*

---

## 🚀 Running Locally

```bash
# 1. Install dependencies (already completed)
npm install

# 2. Start the development server
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🚢 Deployment to Vercel

1. Push your repository to GitHub / GitLab.
2. Import the project into [Vercel](https://vercel.com).
3. In the Vercel project **Settings > Environment Variables**, add your Supabase credentials:
   - `NEXT_PUBLIC_SUPABASE_URL`: `your_supabase_project_url`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`: `your_supabase_anon_key`
   - `SUPABASE_SERVICE_ROLE_KEY`: `your_supabase_service_role_key`
4. Click **Deploy**. The app builds cleanly and is ready for production.
