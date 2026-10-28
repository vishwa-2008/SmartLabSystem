-- ============================================================================
-- KARE SMART LAB EQUIPMENT MANAGEMENT SYSTEM
-- Migration 06: Redesign Additions
-- Run in Supabase SQL Editor AFTER migrations 01-05
-- ALL changes are ADDITIVE — existing data is NEVER deleted.
-- ============================================================================

-- 1. ADD issue_condition TO equipment_transactions
ALTER TABLE public.equipment_transactions
  ADD COLUMN IF NOT EXISTS issue_condition TEXT
  CHECK (issue_condition IN ('good', 'fair', 'damaged', 'needs_repair'));

-- 2. FIX 'missing' STATUS on equipment
ALTER TABLE public.equipment DROP CONSTRAINT IF EXISTS equipment_status_check;
ALTER TABLE public.equipment ADD CONSTRAINT equipment_status_check
  CHECK (status IN ('available', 'issued', 'overdue', 'damaged', 'maintenance', 'missing'));

-- 3. ADD device_id TO fingerprint_templates
ALTER TABLE public.fingerprint_templates
  ADD COLUMN IF NOT EXISTS device_id TEXT;

-- 4. REPLACE rpc_issue_equipment WITH issue_condition SUPPORT
CREATE OR REPLACE FUNCTION public.rpc_issue_equipment(
    p_student_id      UUID,
    p_equipment_id    UUID,
    p_due_at          TIMESTAMPTZ,
    p_remarks         TEXT DEFAULT NULL,
    p_lab_id          UUID DEFAULT NULL,
    p_issue_condition TEXT DEFAULT 'good'
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_actor_id        UUID;
    v_student         RECORD;
    v_equipment       RECORD;
    v_transaction_id  UUID;
    v_issued_at       TIMESTAMPTZ := now();
    v_due_date        TIMESTAMPTZ;
    v_resolved_lab_id UUID;
    v_valid_condition TEXT;
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
    v_valid_condition := CASE WHEN p_issue_condition IN ('good','fair','damaged','needs_repair')
        THEN p_issue_condition ELSE 'good' END;

    UPDATE public.equipment SET status = 'issued', updated_at = v_issued_at WHERE id = p_equipment_id;

    INSERT INTO public.equipment_transactions (
        student_id, equipment_id, issued_by, issued_at, due_at,
        status, issue_remarks, issue_condition, lab_id
    ) VALUES (
        p_student_id, p_equipment_id, v_actor_id, v_issued_at, v_due_date,
        'active', p_remarks, v_valid_condition, v_resolved_lab_id
    ) RETURNING id INTO v_transaction_id;

    INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, details)
    VALUES (v_actor_id, 'ISSUE_EQUIPMENT', 'equipment_transactions', v_transaction_id::text,
        jsonb_build_object('student_id', p_student_id, 'student_reg', v_student.reg_number,
            'equipment_id', p_equipment_id, 'equipment_asset', v_equipment.asset_id,
            'issue_condition', v_valid_condition, 'due_at', v_due_date, 'lab_id', v_resolved_lab_id));

    RETURN jsonb_build_object('success', true, 'transaction_id', v_transaction_id,
        'issued_at', v_issued_at, 'due_at', v_due_date,
        'student_name', v_student.full_name, 'student_reg', v_student.reg_number,
        'equipment_name', v_equipment.name, 'asset_id', v_equipment.asset_id);
END; $$;

-- 5. NEW RPC: rpc_get_outstanding
CREATE OR REPLACE FUNCTION public.rpc_get_outstanding(
    p_search   TEXT DEFAULT NULL,
    p_lab_id   UUID DEFAULT NULL,
    p_page     INT  DEFAULT 1,
    p_per_page INT  DEFAULT 50
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_actor_id UUID;
    v_is_hod   BOOLEAN;
    v_lab_ids  UUID[];
    v_offset   INT;
    v_data     JSONB;
    v_total    BIGINT;
BEGIN
    v_actor_id := auth.uid();
    IF v_actor_id IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
    v_is_hod := public.is_hod();
    v_offset  := (p_page - 1) * p_per_page;

    IF NOT v_is_hod THEN
        SELECT array_agg(lab_id) INTO v_lab_ids FROM public.lab_assignments
        WHERE user_id = v_actor_id AND is_active = true;
        IF v_lab_ids IS NULL THEN v_lab_ids := ARRAY[]::UUID[]; END IF;
    END IF;

    SELECT count(*),
           jsonb_agg(q ORDER BY q->>'issued_at' ASC)
    INTO v_total, v_data
    FROM (
        SELECT jsonb_build_object(
            'id', t.id,
            'issued_at', t.issued_at,
            'due_at', t.due_at,
            'status', t.status,
            'issue_condition', t.issue_condition,
            'issue_remarks', t.issue_remarks,
            'lab_id', t.lab_id,
            'is_overdue', (t.due_at < now() AND t.status = 'active'),
            'hours_outstanding', EXTRACT(EPOCH FROM (now() - t.issued_at)) / 3600,
            'student', jsonb_build_object('id', s.id, 'full_name', s.full_name,
                'reg_number', s.reg_number, 'department', s.department,
                'section', s.section, 'year', s.year),
            'equipment', jsonb_build_object('id', e.id, 'name', e.name,
                'asset_id', e.asset_id, 'category', e.category),
            'laboratory', jsonb_build_object('id', lab.id, 'name', lab.name, 'lab_code', lab.lab_code),
            'issued_by_staff', jsonb_build_object('full_name', pr.full_name, 'role', pr.role)
        ) AS q
        FROM public.equipment_transactions t
        JOIN public.students s ON s.id = t.student_id
        JOIN public.equipment e ON e.id = t.equipment_id
        LEFT JOIN public.laboratories lab ON lab.id = t.lab_id
        LEFT JOIN public.profiles pr ON pr.id = t.issued_by
        WHERE t.status IN ('active', 'overdue')
          AND (v_is_hod OR (t.lab_id = ANY(v_lab_ids)))
          AND (p_lab_id IS NULL OR t.lab_id = p_lab_id)
          AND (p_search IS NULL OR p_search = ''
               OR s.full_name ILIKE '%' || p_search || '%'
               OR s.reg_number ILIKE '%' || p_search || '%'
               OR e.name ILIKE '%' || p_search || '%'
               OR e.asset_id ILIKE '%' || p_search || '%')
        ORDER BY t.issued_at ASC
        LIMIT p_per_page OFFSET v_offset
    ) sub;

    RETURN jsonb_build_object('data', COALESCE(v_data, '[]'::jsonb),
        'total', COALESCE(v_total, 0), 'page', p_page, 'per_page', p_per_page);
END; $$;

-- 6. UPDATE rpc_get_dashboard_stats WITH outstanding_count
CREATE OR REPLACE FUNCTION public.rpc_get_dashboard_stats()
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_students BIGINT; v_equipment BIGINT; v_issued BIGINT; v_available BIGINT;
    v_overdue BIGINT; v_damaged BIGINT; v_returned BIGINT; v_outstanding BIGINT;
    v_scans BIGINT; v_online BIGINT; v_labs BIGINT; v_staff BIGINT;
BEGIN
    SELECT count(*) INTO v_students FROM public.students WHERE active = true;
    SELECT count(*) INTO v_equipment FROM public.equipment;
    SELECT count(*) INTO v_issued FROM public.equipment WHERE status = 'issued';
    SELECT count(*) INTO v_available FROM public.equipment WHERE status = 'available';
    SELECT count(*) INTO v_damaged FROM public.equipment WHERE status IN ('damaged','maintenance','missing');
    SELECT count(*) INTO v_returned FROM public.equipment_transactions WHERE status = 'returned';
    SELECT count(*) INTO v_labs FROM public.laboratories WHERE is_active = true;
    SELECT count(*) INTO v_staff FROM public.profiles WHERE active = true AND role = 'lab_incharge';
    SELECT count(*) INTO v_overdue FROM public.equipment_transactions WHERE status = 'active' AND due_at < now();
    SELECT count(*) INTO v_outstanding FROM public.equipment_transactions WHERE status IN ('active','overdue');
    SELECT count(*) INTO v_scans FROM public.scan_events WHERE created_at >= date_trunc('day', now());
    SELECT count(DISTINCT device_id) INTO v_online FROM public.device_heartbeats WHERE created_at >= (now() - INTERVAL '5 minutes');
    RETURN jsonb_build_object(
        'total_students', v_students, 'total_equipment', v_equipment,
        'currently_issued', v_issued, 'available_equipment', v_available,
        'overdue_equipment', v_overdue, 'damaged_equipment', v_damaged,
        'returned_equipment', v_returned, 'outstanding_count', v_outstanding,
        'today_scans', v_scans, 'online_devices', v_online,
        'total_labs', v_labs, 'active_staff', v_staff, 'computed_at', now());
END; $$;

GRANT EXECUTE ON FUNCTION public.rpc_issue_equipment(UUID,UUID,TIMESTAMPTZ,TEXT,UUID,TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_get_outstanding(TEXT,UUID,INT,INT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_get_dashboard_stats() TO authenticated;

-- Optional cleanup (run manually after confirming empty):
-- SELECT COUNT(*) FROM public.enrollment_sessions;
-- DROP TABLE IF EXISTS public.enrollment_sessions CASCADE;
-- SELECT COUNT(*) FROM public.student_lab_access;
-- DROP TABLE IF EXISTS public.student_lab_access CASCADE;
