# Multi-User Architecture & Security Guide

## 1. Overview & Role Hierarchy

The Mill Management System implements strict three-tier role-based access control (RBAC), enforced simultaneously at the PostgreSQL database layer (Row Level Security & SECURITY DEFINER RPCs), the Next.js server layer (`proxy.ts` & Server Components), and the client presentation layer (`AppShell`).

```
+---------------------------------------------------------------------------------+
|                                 APPLICATION ROLES                               |
+---------------------------------------------------------------------------------+
| 1. ADMIN                  | 2. MEMBER                   | 3. GROUP_LEDGER_VIEWER |
| - Full administrative     | - Read-only personal portal | - Read-only aggregate  |
|   dashboard & operations  | - Own meals & deposits only |   treasury stats only  |
| - Daily meal entries      | - Own balance statement     | - Zero member names    |
| - Member management &     | - Personal CSV export       | - Zero individual rows |
|   account provisioning    | - Zero visibility into      | - Aggregate CSV export |
| - Email audit logs & tests|   other members' records    | - Database-enforced    |
+---------------------------------------------------------------------------------+
```

---

## 2. Row Level Security (RLS) Implementation

All database policies were executed and verified in Supabase PostgreSQL under migration `004_roles_and_multi_user_security.sql`.

### Profiles Table
- `Admin`: Full CRUD over all profiles.
- `All Authenticated Users`: Can only `SELECT` their own profile row (`id = auth.uid()`).

### Members Table
- `Admin`: Full CRUD over all member records.
- `Member`: Can `SELECT` only their own linked member record (`id = current_user_member_id()`).
- `Group Ledger Viewer`: Strictly 0 rows accessible via direct table queries.

### Meal Entries & Deposits Tables
- `Admin`: Full CRUD.
- `Member`: Can `SELECT` only records matching their `member_id`. Cannot write, update, or delete.
- `Group Ledger Viewer`: Direct table queries return 0 rows.

### Group Ledger Viewer Security Isolation
To prevent data leakage of individual meals, deposits, or balances to the Group Ledger Viewer:
- Direct queries against `meal_entries` and `deposits` are blocked by RLS policies.
- Data access is mediated through a PostgreSQL `SECURITY DEFINER` function:
  ```sql
  public.get_group_aggregate_ledger(p_start_date DATE, p_end_date DATE)
  ```
- **Permission Check**: Throws `Access denied` if the caller's role is not `admin` or `group_ledger_viewer`.
- **Output**: Returns JSON containing only aggregate meal counts (lunch, dinner, total), daily expenses, group deposits, and group treasury balance. **Zero member IDs, names, or individual transactions are ever selected or returned.**

---

## 3. Account Provisioning Flow

Only an authenticated `Admin` can create or manage user credentials.

### How to Provision an Account:
1. Log in as Admin (`admin@mill.local`).
2. Navigate to **Members** (`/members`).
3. Click the **Key icon (Provision Credentials)** next to any active member.
4. In the modal:
   - Provide the user's **Login Email Address** (also used for weekly report delivery).
   - Enter a **Password** (minimum 6 characters).
   - Select the **Assigned Role**:
     - `MEMBER`: Automatically links the login account to the chosen member record.
     - `GROUP_LEDGER_VIEWER`: Sets up an aggregate-only viewer.
     - `ADMIN`: Grants full system administrative privileges.
5. Click **Provision Account**. The account is created with `email_confirm: true` via the secure server-side endpoint `/api/admin/provision-user` using the Supabase Service Role Key.

---

## 4. Route Navigation & Protection

| Route | Role: ADMIN | Role: MEMBER | Role: GROUP_LEDGER_VIEWER |
| :--- | :---: | :---: | :---: |
| `/` | Admin Dashboard | Member Personal Dashboard | Viewer Aggregate Dashboard |
| `/meals` | Full Access | Redirected to `/` | Redirected to `/` |
| `/members` | Full Access | Redirected to `/` | Redirected to `/` |
| `/deposits` | Full Access | Redirected to `/` | Redirected to `/` |
| `/ledger` | Full Matrix | Redirected to `/` | Redirected to `/` |
| `/reports` | Full Reports & Balances | Redirected to `/my-statement` | Aggregate-Only Reports |
| `/email-reports` | Full Delivery Logs | Redirected to `/` | Redirected to `/` |
| `/settings` | Full Settings | Redirected to `/` | Redirected to `/` |
| `/my-meals` | Accessible | Own Meals Only | Redirected to `/` |
| `/my-deposits` | Accessible | Own Deposits Only | Redirected to `/` |
| `/my-statement` | Accessible | Own Statement Only | Redirected to `/` |

---

## 5. Automated Verification Results

RLS policy enforcement and data privacy were verified using actual authenticated client sessions:

1. **Admin (`admin@mill.local`)**:
   - Members count returned: **4** (All members).
   - Full read/write access confirmed.
2. **Member (`member@mill.local` -> Tuhin)**:
   - Members count returned: **1** (`Tuhin` only). Rahim, Karim, and Hasan are invisible.
   - Aggregate RPC call: **Blocked** (`Access denied. Only admin or group_ledger_viewer may access aggregate ledger.`).
3. **Group Ledger Viewer (`viewer@mill.local`)**:
   - Direct members count: **0**.
   - Direct meal entries count: **0**.
   - Direct deposits count: **0**.
   - Aggregate RPC: **Succeeded** with total meals (48), lunch (28), dinner (20), total cost (৳3,120), group deposits (৳1,000), and net treasury balance (৳-2,120).
