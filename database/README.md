# KARE Smart Laboratory Database Architecture & Migrations

This folder contains the complete PostgreSQL database schema, Row Level Security (RLS) policies, concurrency-safe Stored Procedures (RPCs), and seed data for the **KARE Smart Lab Equipment Management System**.

## Migration Files Overview

| File | Purpose | Key Objects Created |
| :--- | :--- | :--- |
| `01_initial_schema.sql` | Core schema, primary keys, foreign keys, triggers | `profiles`, `students`, `fingerprint_templates`, `equipment`, `equipment_transactions`, `scan_events`, `device_heartbeats`, `enrollment_sessions`, `audit_logs` |
| `02_rls_policies.sql` | Row Level Security & Staff RBAC | Helper functions (`is_staff()`, `is_hod()`), restrictive policies on all operational tables |
| `03_rpc_functions.sql` | Concurrency-safe Stored Procedures | `rpc_issue_equipment` (row lock `FOR UPDATE`), `rpc_return_equipment`, `rpc_get_dashboard_stats` |
| `04_seed_data.sql` | Initial testing data | 7 KARE students, 10 lab assets (oscilloscopes, power supplies, multimeters, FPGA kits), scan events |

---

## How to Apply Migrations in Supabase

### Option 1: Supabase Web Dashboard (Recommended)
1. Log in to your [Supabase Dashboard](https://supabase.com/dashboard).
2. Open your project.
3. In the left navigation, click on **SQL Editor**.
4. Run the scripts in sequential order:
   - Run `01_initial_schema.sql`
   - Run `02_rls_policies.sql`
   - Run `03_rpc_functions.sql`
   - Run `04_seed_data.sql` (Optional for development/staging)
5. Under **Database > Replication**, enable Realtime replication for:
   - `scan_events`
   - `equipment_transactions`
   - `equipment`
   - `device_heartbeats`

### Option 2: Supabase CLI
```bash
supabase db push
# Or run with psql:
psql -h db.YOUR_PROJECT_ID.supabase.co -U postgres -d postgres -f 01_initial_schema.sql
psql -h db.YOUR_PROJECT_ID.supabase.co -U postgres -d postgres -f 02_rls_policies.sql
psql -h db.YOUR_PROJECT_ID.supabase.co -U postgres -d postgres -f 03_rpc_functions.sql
psql -h db.YOUR_PROJECT_ID.supabase.co -U postgres -d postgres -f 04_seed_data.sql
```

---

## Staff Account Setup (HOD / Lab In-Charge)
When a staff user registers or is invited via Supabase Auth:
1. Supabase Auth creates a record in `auth.users`.
2. Create or verify the corresponding record in `public.profiles`:
```sql
INSERT INTO public.profiles (id, email, full_name, role, active)
VALUES ('<AUTH_USER_UUID>', 'hod.ece@klu.ac.in', 'Dr. S. Ramanathan', 'HOD', true)
ON CONFLICT (id) DO UPDATE SET role = 'HOD', active = true;
```

---

## Concurrency Protection Rationale
- `rpc_issue_equipment`: Uses `SELECT ... FOR UPDATE` on the requested equipment row. If two staff members attempt to issue the same equipment simultaneously, the second transaction is queued and fails safely with `EQUIPMENT_UNAVAILABLE` rather than double-booking the equipment.
- Authoritative server timestamps (`now()`) are applied to all transaction issues and returns. Timestamps supplied by the browser client are never trusted.
