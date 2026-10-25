-- ============================================================================
-- KARE SMART LAB EQUIPMENT MANAGEMENT SYSTEM
-- COMPLETE ALL-IN-ONE DATABASE SETUP (Schema + Multi-Lab + RLS + RPC + Seed)
-- Run this ONCE in the Supabase SQL Editor.
-- It wipes any partial/broken tables and creates the entire database cleanly.
-- ============================================================================

-- Enable required Postgres extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ----------------------------------------------------------------------------
-- STEP 1: DROP OLD / CORRUPTED TABLES CLEANLY (Clean Reset)
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS public.audit_logs CASCADE;
DROP TABLE IF EXISTS public.enrollment_sessions CASCADE;
DROP TABLE IF EXISTS public.device_heartbeats CASCADE;
DROP TABLE IF EXISTS public.scan_events CASCADE;
DROP TABLE IF EXISTS public.equipment_transactions CASCADE;
DROP TABLE IF EXISTS public.equipment CASCADE;
DROP TABLE IF EXISTS public.fingerprint_templates CASCADE;
DROP TABLE IF EXISTS public.student_lab_access CASCADE;
DROP TABLE IF EXISTS public.lab_assignments CASCADE;
DROP TABLE IF EXISTS public.devices CASCADE;
DROP TABLE IF EXISTS public.laboratories CASCADE;
DROP TABLE IF EXISTS public.students CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;

-- ----------------------------------------------------------------------------
-- STEP 2: CREATE CORE DOMAIN TABLES
-- ----------------------------------------------------------------------------

-- 1. PROFILES (Staff members: HOD and Lab In-charge)
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL UNIQUE,
    full_name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'lab_incharge' CHECK (role IN ('HOD', 'lab_incharge')),
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. LABORATORIES (Multi-Lab Support)
CREATE TABLE public.laboratories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    lab_code TEXT NOT NULL UNIQUE,
    department TEXT NOT NULL,
    location TEXT NOT NULL DEFAULT '',
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. LAB ASSIGNMENTS (Maps staff members to their assigned laboratories)
CREATE TABLE public.lab_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lab_id UUID NOT NULL REFERENCES public.laboratories(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    assigned_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    is_active BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT unique_lab_user_assignment UNIQUE (lab_id, user_id)
);

-- 4. STUDENTS
CREATE TABLE public.students (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reg_number TEXT NOT NULL UNIQUE,
    full_name TEXT NOT NULL,
    department TEXT NOT NULL,
    section TEXT NOT NULL,
    year INTEGER NOT NULL CHECK (year >= 1 AND year <= 5),
    phone TEXT,
    active BOOLEAN NOT NULL DEFAULT true,
    photo_url TEXT,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. STUDENT LAB ACCESS (Authorizes students to borrow in specific labs)
CREATE TABLE public.student_lab_access (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    lab_id UUID NOT NULL REFERENCES public.laboratories(id) ON DELETE CASCADE,
    granted_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    is_active BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT unique_student_lab_access UNIQUE (student_id, lab_id)
);

-- 6. FINGERPRINT TEMPLATES
CREATE TABLE public.fingerprint_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id INTEGER NOT NULL UNIQUE CHECK (template_id >= 1 AND template_id <= 1000000),
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    active BOOLEAN NOT NULL DEFAULT true,
    enrolled_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    enrolled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT unique_active_student_fingerprint UNIQUE (student_id)
);

-- 7. EQUIPMENT INVENTORY
CREATE TABLE public.equipment (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_id TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'General',
    location TEXT NOT NULL DEFAULT 'Main Lab',
    status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'issued', 'overdue', 'damaged', 'maintenance')),
    condition TEXT NOT NULL DEFAULT 'good' CHECK (condition IN ('good', 'fair', 'damaged', 'needs_repair')),
    description TEXT,
    lab_id UUID REFERENCES public.laboratories(id) ON DELETE SET NULL,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 8. EQUIPMENT TRANSACTIONS
CREATE TABLE public.equipment_transactions (
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
    lab_id UUID REFERENCES public.laboratories(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 9. SCAN EVENTS (Recorded by ESP32 or verified system test)
CREATE TABLE public.scan_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id INTEGER NOT NULL,
    student_id UUID REFERENCES public.students(id) ON DELETE SET NULL,
    status TEXT NOT NULL CHECK (status IN ('matched', 'not_found', 'error', 'pending')),
    device_id TEXT NOT NULL DEFAULT 'esp32-lab-01',
    is_test BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 10. DEVICE HEARTBEATS
CREATE TABLE public.device_heartbeats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id TEXT NOT NULL,
    ip_address TEXT,
    status TEXT NOT NULL DEFAULT 'online',
    uptime_seconds INTEGER DEFAULT 0,
    free_heap INTEGER DEFAULT 0,
    firmware_version TEXT DEFAULT '1.0.0',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 11. ENROLLMENT SESSIONS (Hardware-portal handshake)
CREATE TABLE public.enrollment_sessions (
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

-- 12. DEVICES
CREATE TABLE public.devices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_name TEXT NOT NULL,
    device_identifier TEXT NOT NULL UNIQUE,
    lab_id UUID REFERENCES public.laboratories(id) ON DELETE SET NULL,
    device_token_hash TEXT,
    last_seen_at TIMESTAMPTZ,
    is_active BOOLEAN NOT NULL DEFAULT true,
    firmware_version TEXT DEFAULT '1.0.0',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 13. AUDIT LOGS
CREATE TABLE public.audit_logs (
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
-- STEP 3: INDEXES FOR HIGH PERFORMANCE
-- ----------------------------------------------------------------------------
CREATE INDEX idx_students_reg_number ON public.students(reg_number);
CREATE INDEX idx_students_department_section ON public.students(department, section);
CREATE INDEX idx_students_active ON public.students(active);

CREATE INDEX idx_equipment_asset_id ON public.equipment(asset_id);
CREATE INDEX idx_equipment_status ON public.equipment(status);
CREATE INDEX idx_equipment_condition ON public.equipment(condition);
CREATE INDEX idx_equipment_lab_id ON public.equipment(lab_id);

CREATE INDEX idx_fingerprint_templates_template_id ON public.fingerprint_templates(template_id);
CREATE INDEX idx_fingerprint_templates_student_id ON public.fingerprint_templates(student_id);

CREATE INDEX idx_transactions_student_id ON public.equipment_transactions(student_id);
CREATE INDEX idx_transactions_equipment_id ON public.equipment_transactions(equipment_id);
CREATE INDEX idx_transactions_status ON public.equipment_transactions(status);
CREATE INDEX idx_transactions_issued_at ON public.equipment_transactions(issued_at DESC);
CREATE INDEX idx_transactions_lab_id ON public.equipment_transactions(lab_id);

CREATE INDEX idx_scan_events_created_at ON public.scan_events(created_at DESC);
CREATE INDEX idx_scan_events_student_id ON public.scan_events(student_id);
CREATE INDEX idx_scan_events_template_id ON public.scan_events(template_id);

CREATE INDEX idx_laboratories_lab_code ON public.laboratories(lab_code);
CREATE INDEX idx_laboratories_department ON public.laboratories(department);
CREATE INDEX idx_lab_assignments_user_id ON public.lab_assignments(user_id);
CREATE INDEX idx_lab_assignments_lab_id ON public.lab_assignments(lab_id);
CREATE INDEX idx_student_lab_access_student ON public.student_lab_access(student_id);
CREATE INDEX idx_student_lab_access_lab ON public.student_lab_access(lab_id);
CREATE INDEX idx_devices_identifier ON public.devices(device_identifier);

CREATE INDEX idx_device_heartbeats_device ON public.device_heartbeats(device_id, created_at DESC);
CREATE INDEX idx_audit_logs_created_at ON public.audit_logs(created_at DESC);

-- Trigger to update updated_at timestamps automatically
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_students_updated_at
BEFORE UPDATE ON public.students
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_equipment_updated_at
BEFORE UPDATE ON public.equipment
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_laboratories_updated_at
BEFORE UPDATE ON public.laboratories
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_devices_updated_at
BEFORE UPDATE ON public.devices
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ----------------------------------------------------------------------------
-- STEP 4: AUTHORIZATION HELPER FUNCTIONS
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS TEXT AS $$
DECLARE v_role TEXT;
BEGIN
    SELECT role INTO v_role FROM public.profiles WHERE id = auth.uid() AND active = true;
    RETURN v_role;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND active = true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.is_hod()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'HOD' AND active = true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.is_assigned_to_lab(p_lab_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    IF public.is_hod() THEN RETURN true; END IF;
    RETURN EXISTS (
        SELECT 1 FROM public.lab_assignments
        WHERE lab_id = p_lab_id AND user_id = auth.uid() AND is_active = true
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.get_authorized_lab_ids()
RETURNS UUID[] AS $$
DECLARE v_lab_ids UUID[];
BEGIN
    IF public.is_hod() THEN
        SELECT array_agg(id) INTO v_lab_ids FROM public.laboratories WHERE is_active = true;
    ELSE
        SELECT array_agg(lab_id) INTO v_lab_ids
        FROM public.lab_assignments WHERE user_id = auth.uid() AND is_active = true;
    END IF;
    RETURN COALESCE(v_lab_ids, ARRAY[]::UUID[]);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ----------------------------------------------------------------------------
-- STEP 5: ROW LEVEL SECURITY (RLS) POLICIES
-- ----------------------------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.laboratories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lab_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_lab_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fingerprint_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.equipment ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.equipment_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scan_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.device_heartbeats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enrollment_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Profiles Policies
CREATE POLICY "Staff can view all profiles" ON public.profiles FOR SELECT USING (public.is_staff());
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "HOD can manage all profiles" ON public.profiles FOR ALL USING (public.is_hod()) WITH CHECK (public.is_hod());

-- Laboratories Policies
CREATE POLICY "Staff can view labs" ON public.laboratories FOR SELECT USING (
    public.is_hod() OR EXISTS (
        SELECT 1 FROM public.lab_assignments WHERE lab_id = laboratories.id AND user_id = auth.uid() AND is_active = true
    )
);
CREATE POLICY "HOD can manage laboratories" ON public.laboratories FOR ALL USING (public.is_hod()) WITH CHECK (public.is_hod());

-- Lab Assignments Policies
CREATE POLICY "HOD can manage all lab assignments" ON public.lab_assignments FOR ALL USING (public.is_hod()) WITH CHECK (public.is_hod());
CREATE POLICY "Staff can view own lab assignments" ON public.lab_assignments FOR SELECT USING (auth.uid() = user_id AND is_active = true);

-- Students Policies
CREATE POLICY "Staff can view students" ON public.students FOR SELECT USING (public.is_staff());
CREATE POLICY "Staff can insert students" ON public.students FOR INSERT WITH CHECK (public.is_staff());
CREATE POLICY "Staff can update students" ON public.students FOR UPDATE USING (public.is_staff()) WITH CHECK (public.is_staff());
CREATE POLICY "HOD can delete students" ON public.students FOR DELETE USING (public.is_hod());

-- Student Lab Access Policies
CREATE POLICY "Staff can view student lab access" ON public.student_lab_access FOR SELECT USING (public.is_staff());
CREATE POLICY "Staff can manage student lab access" ON public.student_lab_access FOR ALL USING (public.is_staff()) WITH CHECK (public.is_staff());

-- Fingerprint Templates Policies
CREATE POLICY "Staff can view fingerprint templates" ON public.fingerprint_templates FOR SELECT USING (public.is_staff());
CREATE POLICY "Staff can manage fingerprint templates" ON public.fingerprint_templates FOR ALL USING (public.is_staff()) WITH CHECK (public.is_staff());

-- Equipment Policies
CREATE POLICY "Staff can view equipment" ON public.equipment FOR SELECT USING (public.is_staff());
CREATE POLICY "Staff can insert equipment" ON public.equipment FOR INSERT WITH CHECK (public.is_staff());
CREATE POLICY "Staff can update equipment" ON public.equipment FOR UPDATE USING (public.is_staff()) WITH CHECK (public.is_staff());
CREATE POLICY "Staff can delete equipment" ON public.equipment FOR DELETE USING (public.is_staff());

-- Equipment Transactions Policies
CREATE POLICY "Staff can view transactions" ON public.equipment_transactions FOR SELECT USING (public.is_staff());
CREATE POLICY "Staff can insert transactions" ON public.equipment_transactions FOR INSERT WITH CHECK (public.is_staff());
CREATE POLICY "Staff can update transactions" ON public.equipment_transactions FOR UPDATE USING (public.is_staff()) WITH CHECK (public.is_staff());

-- Scan Events Policies
CREATE POLICY "Staff can view scan events" ON public.scan_events FOR SELECT USING (public.is_staff());
CREATE POLICY "Staff can insert scan events" ON public.scan_events FOR INSERT WITH CHECK (public.is_staff());

-- Device Heartbeats Policies
CREATE POLICY "Staff can view device heartbeats" ON public.device_heartbeats FOR SELECT USING (public.is_staff());

-- Enrollment Sessions Policies
CREATE POLICY "Staff can manage enrollment sessions" ON public.enrollment_sessions FOR ALL USING (public.is_staff()) WITH CHECK (public.is_staff());

-- Devices Policies
CREATE POLICY "Staff can view devices" ON public.devices FOR SELECT USING (
    public.is_hod() OR (lab_id IS NOT NULL AND public.is_assigned_to_lab(lab_id))
);
CREATE POLICY "HOD can manage devices" ON public.devices FOR ALL USING (public.is_hod()) WITH CHECK (public.is_hod());

-- Audit Logs Policies
CREATE POLICY "HOD can view all audit logs" ON public.audit_logs FOR SELECT USING (public.is_hod());
CREATE POLICY "Staff can insert audit logs" ON public.audit_logs FOR INSERT WITH CHECK (public.is_staff());

-- ----------------------------------------------------------------------------
-- STEP 6: STORED PROCEDURES (RPCs)
-- ----------------------------------------------------------------------------

-- RPC: Issue Equipment (Concurrency-Safe with Row Locking)
CREATE OR REPLACE FUNCTION public.rpc_issue_equipment(
    p_student_id UUID,
    p_equipment_id UUID,
    p_due_at TIMESTAMPTZ,
    p_remarks TEXT DEFAULT NULL,
    p_lab_id UUID DEFAULT NULL
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_actor_id UUID;
    v_student RECORD;
    v_equipment RECORD;
    v_transaction_id UUID;
    v_issued_at TIMESTAMPTZ := now();
    v_due_date TIMESTAMPTZ;
    v_resolved_lab_id UUID;
BEGIN
    v_actor_id := auth.uid();
    IF v_actor_id IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED: Authenticated staff session required'; END IF;
    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = v_actor_id AND active = true) THEN
        RAISE EXCEPTION 'STAFF_INACTIVE: Account is not authorized or active';
    END IF;

    SELECT id, full_name, reg_number, active INTO v_student FROM public.students WHERE id = p_student_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'STUDENT_NOT_FOUND: Specified student does not exist'; END IF;
    IF NOT v_student.active THEN RAISE EXCEPTION 'STUDENT_INACTIVE: Inactive student cannot borrow equipment'; END IF;

    SELECT id, name, asset_id, status, condition, lab_id INTO v_equipment
    FROM public.equipment WHERE id = p_equipment_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'EQUIPMENT_NOT_FOUND: Specified equipment does not exist'; END IF;
    IF v_equipment.status <> 'available' THEN
        RAISE EXCEPTION 'EQUIPMENT_UNAVAILABLE: Equipment is currently % (not available)', v_equipment.status;
    END IF;
    IF v_equipment.condition IN ('damaged', 'needs_repair') THEN
        RAISE EXCEPTION 'EQUIPMENT_UNUSABLE: Equipment condition is % and cannot be issued', v_equipment.condition;
    END IF;

    v_resolved_lab_id := COALESCE(p_lab_id, v_equipment.lab_id);
    v_due_date := COALESCE(p_due_at, v_issued_at + INTERVAL '7 days');

    UPDATE public.equipment SET status = 'issued', updated_at = v_issued_at WHERE id = p_equipment_id;

    INSERT INTO public.equipment_transactions (
        student_id, equipment_id, issued_by, issued_at, due_at, status, issue_remarks, lab_id
    ) VALUES (
        p_student_id, p_equipment_id, v_actor_id, v_issued_at, v_due_date, 'active', p_remarks, v_resolved_lab_id
    ) RETURNING id INTO v_transaction_id;

    INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, details)
    VALUES (v_actor_id, 'ISSUE_EQUIPMENT', 'equipment_transactions', v_transaction_id::text,
        jsonb_build_object('student_id', p_student_id, 'student_reg', v_student.reg_number,
            'equipment_id', p_equipment_id, 'equipment_asset', v_equipment.asset_id,
            'due_at', v_due_date, 'lab_id', v_resolved_lab_id));

    RETURN jsonb_build_object(
        'success', true, 'transaction_id', v_transaction_id,
        'issued_at', v_issued_at, 'due_at', v_due_date,
        'student_name', v_student.full_name, 'student_reg', v_student.reg_number,
        'equipment_name', v_equipment.name, 'asset_id', v_equipment.asset_id
    );
END; $$;

-- RPC: Return Equipment (Concurrency-Safe)
CREATE OR REPLACE FUNCTION public.rpc_return_equipment(
    p_transaction_id UUID,
    p_condition TEXT DEFAULT 'good',
    p_remarks TEXT DEFAULT NULL
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_actor_id UUID;
    v_txn RECORD;
    v_new_status TEXT;
    v_returned_at TIMESTAMPTZ := now();
BEGIN
    v_actor_id := auth.uid();
    IF v_actor_id IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED: Authenticated staff session required'; END IF;
    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = v_actor_id AND active = true) THEN
        RAISE EXCEPTION 'STAFF_INACTIVE: Account is not authorized or active';
    END IF;

    SELECT id, equipment_id, student_id, status INTO v_txn
    FROM public.equipment_transactions WHERE id = p_transaction_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'TRANSACTION_NOT_FOUND: Specified transaction does not exist'; END IF;
    IF v_txn.status <> 'active' THEN
        RAISE EXCEPTION 'TRANSACTION_ALREADY_CLOSED: Transaction is already marked as %', v_txn.status;
    END IF;

    IF p_condition IN ('damaged', 'needs_repair') THEN
        v_new_status := 'damaged';
    ELSE
        v_new_status := 'available';
    END IF;

    UPDATE public.equipment_transactions SET
        status = 'returned', return_condition = p_condition,
        return_remarks = p_remarks, returned_by = v_actor_id,
        returned_at = v_returned_at
    WHERE id = p_transaction_id;

    UPDATE public.equipment SET
        status = v_new_status, condition = p_condition,
        updated_at = v_returned_at
    WHERE id = v_txn.equipment_id;

    INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, details)
    VALUES (v_actor_id, 'RETURN_EQUIPMENT', 'equipment_transactions', p_transaction_id::text,
        jsonb_build_object('equipment_id', v_txn.equipment_id, 'condition', p_condition, 'equipment_status', v_new_status));

    RETURN jsonb_build_object(
        'success', true, 'transaction_id', p_transaction_id,
        'returned_at', v_returned_at, 'condition', p_condition, 'equipment_status', v_new_status
    );
END; $$;

-- RPC: Dashboard Stats
CREATE OR REPLACE FUNCTION public.rpc_get_dashboard_stats()
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_total_students BIGINT; v_total_equipment BIGINT; v_issued_equipment BIGINT;
    v_available_equipment BIGINT; v_overdue_equipment BIGINT; v_damaged_equipment BIGINT;
    v_today_scans BIGINT; v_online_devices BIGINT; v_total_labs BIGINT;
    v_active_staff BIGINT; v_returned_equipment BIGINT;
BEGIN
    SELECT count(*) INTO v_total_students FROM public.students WHERE active = true;
    SELECT count(*) INTO v_total_equipment FROM public.equipment;
    SELECT count(*) INTO v_issued_equipment FROM public.equipment WHERE status = 'issued';
    SELECT count(*) INTO v_available_equipment FROM public.equipment WHERE status = 'available';
    SELECT count(*) INTO v_damaged_equipment FROM public.equipment WHERE status IN ('damaged', 'maintenance');
    SELECT count(*) INTO v_returned_equipment FROM public.equipment_transactions WHERE status = 'returned';
    SELECT count(*) INTO v_total_labs FROM public.laboratories WHERE is_active = true;
    SELECT count(*) INTO v_active_staff FROM public.profiles WHERE active = true AND role = 'lab_incharge';
    SELECT count(*) INTO v_overdue_equipment
        FROM public.equipment_transactions WHERE status = 'active' AND due_at < now();
    SELECT count(*) INTO v_today_scans
        FROM public.scan_events WHERE created_at >= date_trunc('day', now());
    SELECT count(DISTINCT device_id) INTO v_online_devices
        FROM public.device_heartbeats WHERE created_at >= (now() - INTERVAL '5 minutes');

    RETURN jsonb_build_object(
        'total_students', v_total_students, 'total_equipment', v_total_equipment,
        'currently_issued', v_issued_equipment, 'available_equipment', v_available_equipment,
        'overdue_equipment', v_overdue_equipment, 'damaged_equipment', v_damaged_equipment,
        'returned_equipment', v_returned_equipment, 'today_scans', v_today_scans,
        'online_devices', v_online_devices, 'total_labs', v_total_labs,
        'active_staff', v_active_staff, 'computed_at', now()
    );
END; $$;

-- ----------------------------------------------------------------------------
-- STEP 7: SEED PRODUCTION-READY SAMPLE DATA
-- ----------------------------------------------------------------------------

-- 1. Initial Laboratory
INSERT INTO public.laboratories (id, name, lab_code, department, location, description, is_active)
VALUES
    ('c0000001-0000-0000-0000-000000000001', 'IoT & Embedded Systems Laboratory', 'ECE-LAB-01', 'Electronics and Communication', 'Block 3, Room 302', 'Advanced microcontroller and sensor testing laboratory', true)
ON CONFLICT (lab_code) DO NOTHING;

-- 2. Initial Students
INSERT INTO public.students (id, reg_number, full_name, department, section, year, phone, active)
VALUES
    ('a0000001-0000-0000-0000-000000000001', '9921004001', 'Aarav Sharma', 'Computer Science and Engineering', 'A', 3, '+91 98765 43210', true),
    ('a0000001-0000-0000-0000-000000000002', '9921004002', 'Priya Ramanathan', 'Electronics and Communication', 'B', 3, '+91 98765 43211', true),
    ('a0000001-0000-0000-0000-000000000003', '9921004003', 'Karthik Venkatesh', 'Electrical and Electronics', 'A', 4, '+91 98765 43212', true),
    ('a0000001-0000-0000-0000-000000000004', '9921004004', 'Sneha Balasubramanian', 'Computer Science and Engineering', 'C', 2, '+91 98765 43213', true),
    ('a0000001-0000-0000-0000-000000000005', '9921004005', 'Vignesh Sundaram', 'Mechanical Engineering', 'A', 3, '+91 98765 43214', true),
    ('a0000001-0000-0000-0000-000000000006', '9921004006', 'Ananya Krishnan', 'Information Technology', 'B', 2, '+91 98765 43215', true),
    ('a0000001-0000-0000-0000-000000000007', '9921004007', 'Rahul Chandrasekhar', 'Electronics and Communication', 'A', 4, '+91 98765 43216', false)
ON CONFLICT (reg_number) DO NOTHING;

-- 3. Student Lab Access for Initial Lab
INSERT INTO public.student_lab_access (student_id, lab_id, is_active)
SELECT s.id, 'c0000001-0000-0000-0000-000000000001', true
FROM public.students s
ON CONFLICT (student_id, lab_id) DO NOTHING;

-- 4. Initial Fingerprint Templates
INSERT INTO public.fingerprint_templates (template_id, student_id, active, enrolled_at)
VALUES
    (1, 'a0000001-0000-0000-0000-000000000001', true, now() - INTERVAL '30 days'),
    (2, 'a0000001-0000-0000-0000-000000000002', true, now() - INTERVAL '25 days'),
    (3, 'a0000001-0000-0000-0000-000000000003', true, now() - INTERVAL '20 days'),
    (4, 'a0000001-0000-0000-0000-000000000004', true, now() - INTERVAL '15 days'),
    (5, 'a0000001-0000-0000-0000-000000000005', true, now() - INTERVAL '10 days')
ON CONFLICT (template_id) DO NOTHING;

-- 5. Initial Equipment Inventory (Mapped to Initial Lab)
INSERT INTO public.equipment (id, asset_id, name, category, location, status, condition, description, lab_id)
VALUES
    ('b0000001-0000-0000-0000-000000000001', 'EQ-DSO-101', 'Tektronix TBS1052B Digital Storage Oscilloscope (50MHz)', 'Testing & Measurement', 'Bench A-01', 'available', 'good', '2-channel digital storage oscilloscope with 1 GS/s sample rate', 'c0000001-0000-0000-0000-000000000001'),
    ('b0000001-0000-0000-0000-000000000002', 'EQ-DSO-102', 'Tektronix TBS1052B Digital Storage Oscilloscope (50MHz)', 'Testing & Measurement', 'Bench A-02', 'issued', 'good', 'Calibrated in January 2026. Equipped with 2 probes.', 'c0000001-0000-0000-0000-000000000001'),
    ('b0000001-0000-0000-0000-000000000003', 'EQ-FGEN-201', 'Agilent 33220A 20MHz Function / Arbitrary Waveform Generator', 'Signal Sources', 'Bench B-01', 'available', 'good', 'Standard sine, square, ramp, noise and arbitrary waveforms', 'c0000001-0000-0000-0000-000000000001'),
    ('b0000001-0000-0000-0000-000000000004', 'EQ-DMM-301', 'Fluke 179 True RMS Digital Multimeter', 'Measurement', 'Cabinet C-01', 'available', 'good', 'Includes temperature probe and TL75 test leads', 'c0000001-0000-0000-0000-000000000001'),
    ('b0000001-0000-0000-0000-000000000005', 'EQ-DMM-302', 'Fluke 179 True RMS Digital Multimeter', 'Measurement', 'Cabinet C-01', 'issued', 'good', 'Equipped with heavy duty alligator clips', 'c0000001-0000-0000-0000-000000000001'),
    ('b0000001-0000-0000-0000-000000000006', 'EQ-RPI4-401', 'Raspberry Pi 4 Model B (8GB RAM) Lab Kit', 'Embedded Systems', 'Cabinet D-02', 'available', 'good', 'Kit includes official 32GB microSD, 5.1V PSU, and HDMI cable', 'c0000001-0000-0000-0000-000000000001'),
    ('b0000001-0000-0000-0000-000000000007', 'EQ-FPGA-501', 'Digilent Basys 3 Artix-7 FPGA Trainer Board', 'Digital Design', 'Cabinet E-01', 'available', 'good', 'Equipped with USB-JTAG programming cable and vivado license guide', 'c0000001-0000-0000-0000-000000000001'),
    ('b0000001-0000-0000-0000-000000000008', 'EQ-SOLD-601', 'Hakko FX-888D Digital Soldering Station (ESD-Safe)', 'Fabrication', 'Bench F-01', 'damaged', 'damaged', 'Heating element requires replacement. Tagged out for repair.', 'c0000001-0000-0000-0000-000000000001'),
    ('b0000001-0000-0000-0000-000000000009', 'EQ-PSU-701', 'Keysight E3631A Triple Output DC Power Supply (80W)', 'Power Supplies', 'Bench B-02', 'maintenance', 'needs_repair', 'Channel 2 calibration offset out of spec. Scheduled maintenance.', 'c0000001-0000-0000-0000-000000000001'),
    ('b0000001-0000-0000-0000-000000000010', 'EQ-SENS-801', 'Advanced IoT Sensor Kit (37-in-1 Sensor Modules)', 'IoT & Sensors', 'Cabinet D-03', 'available', 'good', 'Includes ultrasonic, gas, PIR, temperature, and accelerometer modules', 'c0000001-0000-0000-0000-000000000001')
ON CONFLICT (asset_id) DO NOTHING;

-- 6. Initial Device
INSERT INTO public.devices (device_name, device_identifier, lab_id, is_active, firmware_version)
VALUES
    ('ESP32 Lab Reader 01', 'esp32-lab-01', 'c0000001-0000-0000-0000-000000000001', true, '1.2.0')
ON CONFLICT (device_identifier) DO NOTHING;

-- 7. Initial Scan Events
INSERT INTO public.scan_events (template_id, student_id, status, device_id, is_test, created_at)
VALUES
    (1, 'a0000001-0000-0000-0000-000000000001', 'matched', 'esp32-lab-01', false, now() - INTERVAL '15 minutes'),
    (2, 'a0000001-0000-0000-0000-000000000002', 'matched', 'esp32-lab-01', false, now() - INTERVAL '45 minutes'),
    (99, NULL, 'not_found', 'esp32-lab-01', false, now() - INTERVAL '2 hours'),
    (4, 'a0000001-0000-0000-0000-000000000004', 'matched', 'esp32-lab-01', false, now() - INTERVAL '3 hours'),
    (1, 'a0000001-0000-0000-0000-000000000001', 'matched', 'esp32-lab-01', true, now() - INTERVAL '4 hours');

-- 8. Initial Device Heartbeat
INSERT INTO public.device_heartbeats (device_id, ip_address, status, uptime_seconds, free_heap, firmware_version, created_at)
VALUES
    ('esp32-lab-01', '192.168.1.150', 'online', 86420, 185430, '1.2.0', now() - INTERVAL '30 seconds');
