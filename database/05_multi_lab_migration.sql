-- ============================================================================
-- KARE SMART LAB EQUIPMENT MANAGEMENT SYSTEM
-- Migration 05: Multi-Laboratory Support & Lab-Scoped Access Control
-- Run this in Supabase SQL Editor AFTER migrations 01-04
-- ============================================================================

-- 1. LABORATORIES TABLE
CREATE TABLE IF NOT EXISTS public.laboratories (
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
CREATE INDEX IF NOT EXISTS idx_laboratories_lab_code ON public.laboratories(lab_code);
CREATE INDEX IF NOT EXISTS idx_laboratories_department ON public.laboratories(department);
CREATE INDEX IF NOT EXISTS idx_laboratories_is_active ON public.laboratories(is_active);

-- 2. LAB ASSIGNMENTS
CREATE TABLE IF NOT EXISTS public.lab_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lab_id UUID NOT NULL REFERENCES public.laboratories(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    assigned_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    is_active BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT unique_lab_user_assignment UNIQUE (lab_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_lab_assignments_user_id ON public.lab_assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_lab_assignments_lab_id ON public.lab_assignments(lab_id);

-- 3. STUDENT LAB ACCESS
CREATE TABLE IF NOT EXISTS public.student_lab_access (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    lab_id UUID NOT NULL REFERENCES public.laboratories(id) ON DELETE CASCADE,
    granted_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    is_active BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT unique_student_lab_access UNIQUE (student_id, lab_id)
);
CREATE INDEX IF NOT EXISTS idx_student_lab_access_student ON public.student_lab_access(student_id);
CREATE INDEX IF NOT EXISTS idx_student_lab_access_lab ON public.student_lab_access(lab_id);

-- 4. ADD lab_id AND created_by TO EQUIPMENT
ALTER TABLE public.equipment
    ADD COLUMN IF NOT EXISTS lab_id UUID REFERENCES public.laboratories(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_equipment_lab_id ON public.equipment(lab_id);

-- 5. ADD lab_id TO EQUIPMENT_TRANSACTIONS
ALTER TABLE public.equipment_transactions
    ADD COLUMN IF NOT EXISTS lab_id UUID REFERENCES public.laboratories(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_transactions_lab_id ON public.equipment_transactions(lab_id);

-- 6. ADD created_by TO STUDENTS
ALTER TABLE public.students
    ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

-- 7. DEVICES TABLE
CREATE TABLE IF NOT EXISTS public.devices (
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
CREATE INDEX IF NOT EXISTS idx_devices_identifier ON public.devices(device_identifier);
CREATE INDEX IF NOT EXISTS idx_devices_lab_id ON public.devices(lab_id);

-- 8. TRIGGERS FOR NEW TABLES
DROP TRIGGER IF EXISTS set_laboratories_updated_at ON public.laboratories;
CREATE TRIGGER set_laboratories_updated_at
BEFORE UPDATE ON public.laboratories
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_devices_updated_at ON public.devices;
CREATE TRIGGER set_devices_updated_at
BEFORE UPDATE ON public.devices
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 9. HELPER FUNCTIONS FOR LAB-SCOPED ACCESS
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

-- 10. ENABLE RLS ON NEW TABLES
ALTER TABLE public.laboratories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lab_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_lab_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.devices ENABLE ROW LEVEL SECURITY;

-- 11. RLS: LABORATORIES
DROP POLICY IF EXISTS "Staff can view labs they are assigned to" ON public.laboratories;
CREATE POLICY "Staff can view labs they are assigned to"
ON public.laboratories FOR SELECT USING (
    public.is_hod() OR EXISTS (
        SELECT 1 FROM public.lab_assignments
        WHERE lab_id = laboratories.id AND user_id = auth.uid() AND is_active = true
    )
);
DROP POLICY IF EXISTS "HOD can manage laboratories" ON public.laboratories;
CREATE POLICY "HOD can manage laboratories"
ON public.laboratories FOR ALL USING (public.is_hod()) WITH CHECK (public.is_hod());

-- 12. RLS: LAB ASSIGNMENTS
DROP POLICY IF EXISTS "HOD can manage all lab assignments" ON public.lab_assignments;
CREATE POLICY "HOD can manage all lab assignments"
ON public.lab_assignments FOR ALL USING (public.is_hod()) WITH CHECK (public.is_hod());
DROP POLICY IF EXISTS "Lab incharge can view own assignments" ON public.lab_assignments;
CREATE POLICY "Lab incharge can view own assignments"
ON public.lab_assignments FOR SELECT USING (auth.uid() = user_id AND is_active = true);

-- 13. RLS: STUDENT_LAB_ACCESS
DROP POLICY IF EXISTS "Staff can view student lab access" ON public.student_lab_access;
CREATE POLICY "Staff can view student lab access"
ON public.student_lab_access FOR SELECT USING (public.is_staff());
DROP POLICY IF EXISTS "Authorized staff can manage student lab access" ON public.student_lab_access;
CREATE POLICY "Authorized staff can manage student lab access"
ON public.student_lab_access FOR ALL USING (public.is_staff()) WITH CHECK (public.is_staff());

-- 14. RLS: DEVICES
DROP POLICY IF EXISTS "Staff can view devices for their labs" ON public.devices;
CREATE POLICY "Staff can view devices for their labs"
ON public.devices FOR SELECT USING (
    public.is_hod() OR (lab_id IS NOT NULL AND public.is_assigned_to_lab(lab_id))
);
DROP POLICY IF EXISTS "HOD can manage devices" ON public.devices;
CREATE POLICY "HOD can manage devices"
ON public.devices FOR ALL USING (public.is_hod()) WITH CHECK (public.is_hod());

-- 15. UPDATE rpc_issue_equipment TO CAPTURE lab_id
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

-- 16. UPDATED DASHBOARD STATS (adds total_labs, active_staff, returned_equipment)
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
