-- ============================================================================
-- KARE SMART LAB SYSTEM
-- FIX RPC AUTHENTICATION (08_fix_rpc_actor.sql)
-- ============================================================================
-- Allows rpc_issue_equipment and rpc_return_equipment to accept an optional
-- p_actor_id so that server-side service-role calls (where auth.uid() is NULL)
-- can pass the authenticated staff profile ID directly.
-- ============================================================================

-- 1. UPDATE rpc_issue_equipment
CREATE OR REPLACE FUNCTION public.rpc_issue_equipment(
    p_student_id      UUID,
    p_equipment_id    UUID,
    p_due_at          TIMESTAMPTZ DEFAULT NULL,
    p_remarks         TEXT DEFAULT NULL,
    p_lab_id          UUID DEFAULT NULL,
    p_issue_condition TEXT DEFAULT 'good',
    p_actor_id        UUID DEFAULT NULL
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
    v_actor_id := COALESCE(p_actor_id, auth.uid());
    IF v_actor_id IS NULL THEN
        RAISE EXCEPTION 'AUTH_REQUIRED: Authenticated staff session required';
    END IF;

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

-- 2. UPDATE rpc_return_equipment
CREATE OR REPLACE FUNCTION public.rpc_return_equipment(
    p_transaction_id UUID,
    p_condition      TEXT DEFAULT 'good',
    p_remarks        TEXT DEFAULT NULL,
    p_actor_id       UUID DEFAULT NULL
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_actor_id         UUID;
    v_trans            RECORD;
    v_equipment        RECORD;
    v_returned_at      TIMESTAMPTZ := now();
    v_new_status       TEXT;
    v_equip_new_status TEXT;
BEGIN
    v_actor_id := COALESCE(p_actor_id, auth.uid());
    IF v_actor_id IS NULL THEN
        RAISE EXCEPTION 'AUTH_REQUIRED: Authenticated staff session required';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = v_actor_id AND active = true) THEN
        RAISE EXCEPTION 'STAFF_INACTIVE: Account is not authorized or active';
    END IF;

    IF p_condition NOT IN ('good', 'fair', 'damaged', 'needs_repair') THEN
        RAISE EXCEPTION 'INVALID_CONDITION: Condition must be good, fair, damaged, or needs_repair';
    END IF;

    SELECT id, equipment_id, student_id, status, issued_at, due_at INTO v_trans
    FROM public.equipment_transactions
    WHERE id = p_transaction_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'TRANSACTION_NOT_FOUND: Specified transaction does not exist';
    END IF;

    IF v_trans.status NOT IN ('active', 'overdue') THEN
        RAISE EXCEPTION 'TRANSACTION_ALREADY_CLOSED: Transaction is already marked as %', v_trans.status;
    END IF;

    SELECT id, name, asset_id INTO v_equipment
    FROM public.equipment
    WHERE id = v_trans.equipment_id
    FOR UPDATE;

    v_new_status := 'returned';
    IF p_condition IN ('damaged', 'needs_repair') THEN
        v_equip_new_status := 'maintenance';
    ELSE
        v_equip_new_status := 'available';
    END IF;

    UPDATE public.equipment_transactions
    SET
        returned_by = v_actor_id,
        returned_at = v_returned_at,
        status = v_new_status,
        return_condition = p_condition,
        return_remarks = p_remarks
    WHERE id = p_transaction_id;

    UPDATE public.equipment
    SET
        status = v_equip_new_status,
        condition = p_condition,
        updated_at = v_returned_at
    WHERE id = v_trans.equipment_id;

    INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, details)
    VALUES (
        v_actor_id,
        'RETURN_EQUIPMENT',
        'equipment_transactions',
        p_transaction_id::text,
        jsonb_build_object(
            'equipment_id', v_trans.equipment_id,
            'student_id', v_trans.student_id,
            'return_condition', p_condition,
            'returned_at', v_returned_at
        )
    );

    RETURN jsonb_build_object(
        'success', true,
        'transaction_id', p_transaction_id,
        'returned_at', v_returned_at,
        'status', v_new_status,
        'equipment_status', v_equip_new_status,
        'condition', p_condition
    );
END; $$;
