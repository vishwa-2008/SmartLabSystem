-- ============================================================================
-- KARE SMART LAB EQUIPMENT MANAGEMENT SYSTEM
-- Migration 03: Concurrency-Safe RPC Stored Procedures
-- ============================================================================

-- ----------------------------------------------------------------------------
-- RPC: ISSUE EQUIPMENT (Concurrency-Safe with Row Locking)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rpc_issue_equipment(
    p_student_id UUID,
    p_equipment_id UUID,
    p_due_at TIMESTAMPTZ,
    p_remarks TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_actor_id UUID;
    v_student RECORD;
    v_equipment RECORD;
    v_transaction_id UUID;
    v_issued_at TIMESTAMPTZ := now();
    v_due_date TIMESTAMPTZ;
BEGIN
    v_actor_id := auth.uid();
    IF v_actor_id IS NULL THEN
        RAISE EXCEPTION 'AUTH_REQUIRED: Authenticated staff session required';
    END IF;

    -- Verify actor is active staff
    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = v_actor_id AND active = true) THEN
        RAISE EXCEPTION 'STAFF_INACTIVE: Account is not authorized or active';
    END IF;

    -- Verify student is active
    SELECT id, full_name, reg_number, active INTO v_student
    FROM public.students
    WHERE id = p_student_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'STUDENT_NOT_FOUND: Specified student does not exist';
    END IF;

    IF NOT v_student.active THEN
        RAISE EXCEPTION 'STUDENT_INACTIVE: Inactive student cannot borrow equipment';
    END IF;

    -- Lock the equipment row to prevent concurrent issues by another staff member
    SELECT id, name, asset_id, status, condition INTO v_equipment
    FROM public.equipment
    WHERE id = p_equipment_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'EQUIPMENT_NOT_FOUND: Specified equipment does not exist';
    END IF;

    IF v_equipment.status <> 'available' THEN
        RAISE EXCEPTION 'EQUIPMENT_UNAVAILABLE: Equipment is currently % (not available)', v_equipment.status;
    END IF;

    IF v_equipment.condition IN ('damaged', 'needs_repair') THEN
        RAISE EXCEPTION 'EQUIPMENT_UNUSABLE: Equipment condition is % and cannot be issued', v_equipment.condition;
    END IF;

    -- Calculate due date: default to 7 days from now if not provided
    IF p_due_at IS NULL THEN
        v_due_date := v_issued_at + INTERVAL '7 days';
    ELSE
        v_due_date := p_due_at;
    END IF;

    -- Update equipment status
    UPDATE public.equipment
    SET status = 'issued', updated_at = v_issued_at
    WHERE id = p_equipment_id;

    -- Insert authoritative transaction record
    INSERT INTO public.equipment_transactions (
        student_id,
        equipment_id,
        issued_by,
        issued_at,
        due_at,
        status,
        issue_remarks
    ) VALUES (
        p_student_id,
        p_equipment_id,
        v_actor_id,
        v_issued_at,
        v_due_date,
        'active',
        p_remarks
    ) RETURNING id INTO v_transaction_id;

    -- Write audit log
    INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, details)
    VALUES (
        v_actor_id,
        'ISSUE_EQUIPMENT',
        'equipment_transactions',
        v_transaction_id::text,
        jsonb_build_object(
            'student_id', p_student_id,
            'student_reg', v_student.reg_number,
            'equipment_id', p_equipment_id,
            'equipment_asset', v_equipment.asset_id,
            'due_at', v_due_date
        )
    );

    RETURN jsonb_build_object(
        'success', true,
        'transaction_id', v_transaction_id,
        'issued_at', v_issued_at,
        'due_at', v_due_date,
        'student_name', v_student.full_name,
        'student_reg', v_student.reg_number,
        'equipment_name', v_equipment.name,
        'asset_id', v_equipment.asset_id
    );
END;
$$;

-- ----------------------------------------------------------------------------
-- RPC: RETURN EQUIPMENT (Concurrency-Safe with Consistent Inventory Update)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rpc_return_equipment(
    p_transaction_id UUID,
    p_condition TEXT DEFAULT 'good',
    p_remarks TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_actor_id UUID;
    v_trans RECORD;
    v_equipment RECORD;
    v_returned_at TIMESTAMPTZ := now();
    v_new_status TEXT;
    v_equip_new_status TEXT;
BEGIN
    v_actor_id := auth.uid();
    IF v_actor_id IS NULL THEN
        RAISE EXCEPTION 'AUTH_REQUIRED: Authenticated staff session required';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = v_actor_id AND active = true) THEN
        RAISE EXCEPTION 'STAFF_INACTIVE: Account is not authorized or active';
    END IF;

    IF p_condition NOT IN ('good', 'fair', 'damaged', 'needs_repair') THEN
        RAISE EXCEPTION 'INVALID_CONDITION: Condition must be good, fair, damaged, or needs_repair';
    END IF;

    -- Lock transaction row
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

    -- Lock equipment row
    SELECT id, name, asset_id INTO v_equipment
    FROM public.equipment
    WHERE id = v_trans.equipment_id
    FOR UPDATE;

    IF p_condition IN ('damaged', 'needs_repair') THEN
        v_new_status := 'damaged';
        v_equip_new_status := 'damaged';
    ELSE
        v_new_status := 'returned';
        v_equip_new_status := 'available';
    END IF;

    -- Update transaction
    UPDATE public.equipment_transactions
    SET
        returned_by = v_actor_id,
        returned_at = v_returned_at,
        status = v_new_status,
        return_condition = p_condition,
        return_remarks = p_remarks
    WHERE id = p_transaction_id;

    -- Update inventory item
    UPDATE public.equipment
    SET
        status = v_equip_new_status,
        condition = p_condition,
        updated_at = v_returned_at
    WHERE id = v_trans.equipment_id;

    -- Record audit log
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
END;
$$;

-- ----------------------------------------------------------------------------
-- RPC: GET DASHBOARD STATISTICS (Fast single-query computation)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rpc_get_dashboard_stats()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_total_students BIGINT;
    v_total_equipment BIGINT;
    v_issued_equipment BIGINT;
    v_available_equipment BIGINT;
    v_overdue_equipment BIGINT;
    v_damaged_equipment BIGINT;
    v_today_scans BIGINT;
    v_online_devices BIGINT;
BEGIN
    SELECT count(*) INTO v_total_students FROM public.students WHERE active = true;
    SELECT count(*) INTO v_total_equipment FROM public.equipment;
    SELECT count(*) INTO v_issued_equipment FROM public.equipment WHERE status = 'issued';
    SELECT count(*) INTO v_available_equipment FROM public.equipment WHERE status = 'available';
    SELECT count(*) INTO v_damaged_equipment FROM public.equipment WHERE status IN ('damaged', 'maintenance');

    -- Overdue items: active transactions where due_at < now()
    SELECT count(*) INTO v_overdue_equipment
    FROM public.equipment_transactions
    WHERE status = 'active' AND due_at < now();

    -- Scans recorded since midnight today (UTC/server timezone)
    SELECT count(*) INTO v_today_scans
    FROM public.scan_events
    WHERE created_at >= date_trunc('day', now());

    -- Heartbeats recorded within the last 5 minutes
    SELECT count(DISTINCT device_id) INTO v_online_devices
    FROM public.device_heartbeats
    WHERE created_at >= (now() - INTERVAL '5 minutes');

    RETURN jsonb_build_object(
        'total_students', v_total_students,
        'total_equipment', v_total_equipment,
        'currently_issued', v_issued_equipment,
        'available_equipment', v_available_equipment,
        'overdue_equipment', v_overdue_equipment,
        'damaged_equipment', v_damaged_equipment,
        'today_scans', v_today_scans,
        'online_devices', v_online_devices,
        'computed_at', now()
    );
END;
$$;
