-- ============================================================================
-- KARE SMART LAB SYSTEM
-- FINGERPRINT DATABASE LINK REPAIR SCRIPT (CORRECTED)
-- ============================================================================
-- Run this in your Supabase SQL Editor.
--
-- IMPORTANT: The `students` table does NOT have a template_id column.
-- Fingerprint mappings live ONLY in the `fingerprint_templates` table.
-- The template_id shown on the website is computed by joining fingerprint_templates.
--
-- PROBLEM: When you enrolled a student fingerprint on the ESP32 sensor (stored
-- in hardware slot e.g. #6), the fingerprint_templates table was never updated.
-- So when the student scans, the server finds no row and returns "not_found".
--
-- SOLUTION: Manually insert the mapping for each student below.
-- ============================================================================

-- STEP 1: See ALL fingerprint enrollments currently in the database
SELECT
    ft.template_id AS sensor_slot,
    s.full_name,
    s.reg_number,
    s.department,
    ft.active,
    ft.enrolled_at
FROM public.fingerprint_templates ft
JOIN public.students s ON s.id = ft.student_id
ORDER BY ft.template_id;

-- ============================================================================
-- STEP 2: See which students have NO fingerprint enrollment
-- ============================================================================
SELECT
    s.full_name,
    s.reg_number,
    s.department,
    s.section,
    s.year,
    'NOT ENROLLED - cannot use fingerprint scanner' AS status
FROM public.students s
LEFT JOIN public.fingerprint_templates ft ON ft.student_id = s.id
WHERE ft.id IS NULL
  AND s.active = true
ORDER BY s.full_name;

-- ============================================================================
-- STEP 3: MANUAL LINK — For each student enrolled on the sensor, run this
-- ============================================================================
-- HOW TO USE:
-- 1. First find the student UUID:
--    SELECT id, full_name, reg_number FROM public.students WHERE reg_number = 'YOUR_REG_NUMBER';
--
-- 2. Then insert the fingerprint link (replace the values):
--    INSERT INTO public.fingerprint_templates (template_id, student_id, active, enrolled_at)
--    VALUES (<SLOT_NUMBER>, '<STUDENT_UUID>', true, now())
--    ON CONFLICT (student_id) DO UPDATE SET template_id = EXCLUDED.template_id, active = true, enrolled_at = now()
--    ON CONFLICT (template_id) DO UPDATE SET student_id = EXCLUDED.student_id, active = true, enrolled_at = now();
-- ============================================================================

-- EXAMPLE: Link slot #6 to a specific student by reg number (EDIT THESE VALUES)
-- Uncomment and edit the lines below:

/*
DO $$
DECLARE
  v_student_id UUID;
BEGIN
  -- Find the student by registration number (CHANGE THIS TO THE ACTUAL REG NUMBER)
  SELECT id INTO v_student_id
  FROM public.students
  WHERE reg_number = 'YOUR_REG_NUMBER_HERE'   -- <- CHANGE THIS
    AND active = true
  LIMIT 1;

  IF v_student_id IS NULL THEN
    RAISE EXCEPTION 'Student not found. Check the reg_number.';
  END IF;

  -- Remove any previous fingerprint link for this student
  DELETE FROM public.fingerprint_templates WHERE student_id = v_student_id;

  -- Link the sensor slot to this student (CHANGE 6 TO THE ACTUAL SLOT NUMBER)
  INSERT INTO public.fingerprint_templates (template_id, student_id, active, enrolled_at)
  VALUES (6, v_student_id, true, now());   -- <- CHANGE 6 TO YOUR SLOT NUMBER

  RAISE NOTICE 'SUCCESS: Linked slot #6 to student %', v_student_id;
END $$;
*/

-- ============================================================================
-- STEP 4: After running the fix, verify the link exists
-- ============================================================================
SELECT
    ft.template_id AS sensor_slot,
    s.full_name,
    s.reg_number,
    'LINKED - will work on scan' AS status
FROM public.fingerprint_templates ft
JOIN public.students s ON s.id = ft.student_id
WHERE ft.active = true
ORDER BY ft.template_id;
