-- ============================================================================
-- KARE SMART LAB EQUIPMENT MANAGEMENT SYSTEM
-- Migration 01: Core Schema & Tables
-- ============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ----------------------------------------------------------------------------
-- 1. PROFILES (Staff members: HOD and Lab In-charge)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL UNIQUE,
    full_name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'lab_incharge' CHECK (role IN ('HOD', 'lab_incharge')),
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- 2. STUDENTS
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.students (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reg_number TEXT NOT NULL UNIQUE,
    full_name TEXT NOT NULL,
    department TEXT NOT NULL,
    section TEXT NOT NULL,
    year INTEGER NOT NULL CHECK (year >= 1 AND year <= 5),
    phone TEXT,
    active BOOLEAN NOT NULL DEFAULT true,
    photo_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Ensure all columns exist if the table was previously created with a different schema
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS reg_number TEXT UNIQUE;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS full_name TEXT;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS department TEXT;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS section TEXT;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS year INTEGER;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT true;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS photo_url TEXT;

-- ----------------------------------------------------------------------------
-- 3. FINGERPRINT TEMPLATES
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.fingerprint_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id INTEGER NOT NULL UNIQUE CHECK (template_id >= 1 AND template_id <= 1000000),
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    active BOOLEAN NOT NULL DEFAULT true,
    enrolled_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    enrolled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT unique_active_student_fingerprint UNIQUE (student_id)
);

-- ----------------------------------------------------------------------------
-- 4. EQUIPMENT INVENTORY
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.equipment (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_id TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'General',
    location TEXT NOT NULL DEFAULT 'Main Lab',
    status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'issued', 'overdue', 'damaged', 'maintenance')),
    condition TEXT NOT NULL DEFAULT 'good' CHECK (condition IN ('good', 'fair', 'damaged', 'needs_repair')),
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Ensure all equipment columns exist if the table was previously created with a different schema
ALTER TABLE public.equipment ADD COLUMN IF NOT EXISTS asset_id TEXT UNIQUE;
ALTER TABLE public.equipment ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE public.equipment ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'General';
ALTER TABLE public.equipment ADD COLUMN IF NOT EXISTS location TEXT DEFAULT 'Main Lab';
ALTER TABLE public.equipment ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'available';
ALTER TABLE public.equipment ADD COLUMN IF NOT EXISTS condition TEXT DEFAULT 'good';
ALTER TABLE public.equipment ADD COLUMN IF NOT EXISTS description TEXT;

-- ----------------------------------------------------------------------------
-- 5. EQUIPMENT TRANSACTIONS
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.equipment_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE RESTRICT,
    equipment_id UUID NOT NULL REFERENCES public.equipment(id) ON DELETE RESTRICT,
    issued_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    issued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    due_at TIMESTAMPTZ NOT NULL,
    returned_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    returned_at TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'returned', 'overdue', 'damaged')),
    return_condition TEXT CHECK (return_condition IN ('good', 'fair', 'damaged', 'needs_repair')),
    issue_remarks TEXT,
    return_remarks TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- 6. SCAN EVENTS (Recorded by ESP32 or verified system test)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.scan_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id INTEGER NOT NULL,
    student_id UUID REFERENCES public.students(id) ON DELETE SET NULL,
    status TEXT NOT NULL CHECK (status IN ('matched', 'not_found', 'error', 'pending')),
    device_id TEXT NOT NULL DEFAULT 'esp32-lab-01',
    is_test BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- 7. DEVICE HEARTBEATS
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.device_heartbeats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id TEXT NOT NULL,
    ip_address TEXT,
    status TEXT NOT NULL DEFAULT 'online',
    uptime_seconds INTEGER DEFAULT 0,
    free_heap INTEGER DEFAULT 0,
    firmware_version TEXT DEFAULT '1.0.0',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- 8. ENROLLMENT SESSIONS (Hardware-portal handshake)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.enrollment_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    target_template_id INTEGER CHECK (target_template_id >= 1 AND target_template_id <= 1000),
    status TEXT NOT NULL DEFAULT 'waiting_device' CHECK (status IN ('waiting_device', 'ready_for_finger', 'enrolled', 'failed', 'cancelled')),
    device_id TEXT NOT NULL DEFAULT 'esp32-lab-01',
    initiated_by UUID NOT NULL REFERENCES public.profiles(id),
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at TIMESTAMPTZ
);

-- ----------------------------------------------------------------------------
-- 9. AUDIT LOGS
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT,
    details JSONB DEFAULT '{}'::jsonb,
    ip_address TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- INDEXES FOR HIGH-PERFORMANCE SEARCH & SORTING
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_students_reg_number ON public.students(reg_number);
CREATE INDEX IF NOT EXISTS idx_students_department_section ON public.students(department, section);
CREATE INDEX IF NOT EXISTS idx_students_active ON public.students(active);

CREATE INDEX IF NOT EXISTS idx_equipment_asset_id ON public.equipment(asset_id);
CREATE INDEX IF NOT EXISTS idx_equipment_status ON public.equipment(status);
CREATE INDEX IF NOT EXISTS idx_equipment_condition ON public.equipment(condition);

CREATE INDEX IF NOT EXISTS idx_fingerprint_templates_template_id ON public.fingerprint_templates(template_id);
CREATE INDEX IF NOT EXISTS idx_fingerprint_templates_student_id ON public.fingerprint_templates(student_id);

CREATE INDEX IF NOT EXISTS idx_transactions_student_id ON public.equipment_transactions(student_id);
CREATE INDEX IF NOT EXISTS idx_transactions_equipment_id ON public.equipment_transactions(equipment_id);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON public.equipment_transactions(status);
CREATE INDEX IF NOT EXISTS idx_transactions_issued_at ON public.equipment_transactions(issued_at DESC);

CREATE INDEX IF NOT EXISTS idx_scan_events_created_at ON public.scan_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_scan_events_student_id ON public.scan_events(student_id);
CREATE INDEX IF NOT EXISTS idx_scan_events_template_id ON public.scan_events(template_id);

CREATE INDEX IF NOT EXISTS idx_device_heartbeats_device ON public.device_heartbeats(device_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);

-- Trigger to update updated_at timestamps automatically
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_profiles_updated_at ON public.profiles;
CREATE TRIGGER set_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_students_updated_at ON public.students;
CREATE TRIGGER set_students_updated_at
BEFORE UPDATE ON public.students
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_equipment_updated_at ON public.equipment;
CREATE TRIGGER set_equipment_updated_at
BEFORE UPDATE ON public.equipment
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
