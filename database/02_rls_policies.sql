-- ============================================================================
-- KARE SMART LAB EQUIPMENT MANAGEMENT SYSTEM
-- Migration 02: Row Level Security (RLS) & Access Policies
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fingerprint_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.equipment ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.equipment_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scan_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.device_heartbeats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enrollment_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- HELPER FUNCTIONS FOR AUTHORIZATION
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS TEXT AS $$
DECLARE
    v_role TEXT;
BEGIN
    SELECT role INTO v_role
    FROM public.profiles
    WHERE id = auth.uid() AND active = true;
    RETURN v_role;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND active = true
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.is_hod()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'HOD' AND active = true
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ----------------------------------------------------------------------------
-- PROFILES POLICIES
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Staff can view all profiles" ON public.profiles;
CREATE POLICY "Staff can view all profiles"
ON public.profiles FOR SELECT
USING (public.is_staff());

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
ON public.profiles FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "HOD can manage all profiles" ON public.profiles;
CREATE POLICY "HOD can manage all profiles"
ON public.profiles FOR ALL
USING (public.is_hod())
WITH CHECK (public.is_hod());

-- ----------------------------------------------------------------------------
-- STUDENTS POLICIES
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Staff can view students" ON public.students;
CREATE POLICY "Staff can view students"
ON public.students FOR SELECT
USING (public.is_staff());

DROP POLICY IF EXISTS "Staff can insert students" ON public.students;
CREATE POLICY "Staff can insert students"
ON public.students FOR INSERT
WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS "Staff can update students" ON public.students;
CREATE POLICY "Staff can update students"
ON public.students FOR UPDATE
USING (public.is_staff())
WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS "HOD can delete students" ON public.students;
CREATE POLICY "HOD can delete students"
ON public.students FOR DELETE
USING (public.is_hod());

-- ----------------------------------------------------------------------------
-- FINGERPRINT TEMPLATES POLICIES
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Staff can view fingerprint templates" ON public.fingerprint_templates;
CREATE POLICY "Staff can view fingerprint templates"
ON public.fingerprint_templates FOR SELECT
USING (public.is_staff());

DROP POLICY IF EXISTS "Staff can manage templates" ON public.fingerprint_templates;
CREATE POLICY "Staff can manage templates"
ON public.fingerprint_templates FOR ALL
USING (public.is_staff())
WITH CHECK (public.is_staff());

-- ----------------------------------------------------------------------------
-- EQUIPMENT POLICIES
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Staff can view equipment" ON public.equipment;
CREATE POLICY "Staff can view equipment"
ON public.equipment FOR SELECT
USING (public.is_staff());

DROP POLICY IF EXISTS "Staff can insert equipment" ON public.equipment;
CREATE POLICY "Staff can insert equipment"
ON public.equipment FOR INSERT
WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS "Staff can update equipment" ON public.equipment;
CREATE POLICY "Staff can update equipment"
ON public.equipment FOR UPDATE
USING (public.is_staff())
WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS "HOD can delete equipment" ON public.equipment;
CREATE POLICY "HOD can delete equipment"
ON public.equipment FOR DELETE
USING (public.is_hod());

-- ----------------------------------------------------------------------------
-- EQUIPMENT TRANSACTIONS POLICIES
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Staff can view transactions" ON public.equipment_transactions;
CREATE POLICY "Staff can view transactions"
ON public.equipment_transactions FOR SELECT
USING (public.is_staff());

DROP POLICY IF EXISTS "Staff can record transactions" ON public.equipment_transactions;
CREATE POLICY "Staff can record transactions"
ON public.equipment_transactions FOR INSERT
WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS "Staff can update transactions" ON public.equipment_transactions;
CREATE POLICY "Staff can update transactions"
ON public.equipment_transactions FOR UPDATE
USING (public.is_staff())
WITH CHECK (public.is_staff());

-- ----------------------------------------------------------------------------
-- SCAN EVENTS POLICIES
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Staff can view scan events" ON public.scan_events;
CREATE POLICY "Staff can view scan events"
ON public.scan_events FOR SELECT
USING (public.is_staff());

DROP POLICY IF EXISTS "Staff can create test scans" ON public.scan_events;
CREATE POLICY "Staff can create test scans"
ON public.scan_events FOR INSERT
WITH CHECK (public.is_staff());

-- ----------------------------------------------------------------------------
-- DEVICE HEARTBEATS POLICIES
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Staff can view device heartbeats" ON public.device_heartbeats;
CREATE POLICY "Staff can view device heartbeats"
ON public.device_heartbeats FOR SELECT
USING (public.is_staff());

-- ----------------------------------------------------------------------------
-- ENROLLMENT SESSIONS POLICIES
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Staff can view and manage enrollment sessions" ON public.enrollment_sessions;
CREATE POLICY "Staff can view and manage enrollment sessions"
ON public.enrollment_sessions FOR ALL
USING (public.is_staff())
WITH CHECK (public.is_staff());

-- ----------------------------------------------------------------------------
-- AUDIT LOGS POLICIES
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Staff can view audit logs" ON public.audit_logs;
CREATE POLICY "Staff can view audit logs"
ON public.audit_logs FOR SELECT
USING (public.is_hod());

DROP POLICY IF EXISTS "Staff can insert audit logs" ON public.audit_logs;
CREATE POLICY "Staff can insert audit logs"
ON public.audit_logs FOR INSERT
WITH CHECK (public.is_staff());
