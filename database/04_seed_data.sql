-- ============================================================================
-- KARE SMART LAB EQUIPMENT MANAGEMENT SYSTEM
-- Migration 04: Seed Data for Laboratory Operations & Testing
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. SEED STUDENTS
-- ----------------------------------------------------------------------------
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

-- ----------------------------------------------------------------------------
-- 2. SEED FINGERPRINT TEMPLATES
-- ----------------------------------------------------------------------------
INSERT INTO public.fingerprint_templates (template_id, student_id, active, enrolled_at)
VALUES
    (1, 'a0000001-0000-0000-0000-000000000001', true, now() - INTERVAL '30 days'),
    (2, 'a0000001-0000-0000-0000-000000000002', true, now() - INTERVAL '25 days'),
    (3, 'a0000001-0000-0000-0000-000000000003', true, now() - INTERVAL '20 days'),
    (4, 'a0000001-0000-0000-0000-000000000004', true, now() - INTERVAL '15 days'),
    (5, 'a0000001-0000-0000-0000-000000000005', true, now() - INTERVAL '10 days')
ON CONFLICT (template_id) DO NOTHING;

-- ----------------------------------------------------------------------------
-- 3. SEED LAB EQUIPMENT INVENTORY
-- ----------------------------------------------------------------------------
INSERT INTO public.equipment (id, asset_id, name, category, location, status, condition, description)
VALUES
    ('b0000001-0000-0000-0000-000000000001', 'EQ-DSO-101', 'Tektronix TBS1052B Digital Storage Oscilloscope (50MHz)', 'Testing & Measurement', 'Bench A-01', 'available', 'good', '2-channel digital storage oscilloscope with 1 GS/s sample rate'),
    ('b0000001-0000-0000-0000-000000000002', 'EQ-DSO-102', 'Tektronix TBS1052B Digital Storage Oscilloscope (50MHz)', 'Testing & Measurement', 'Bench A-02', 'issued', 'good', 'Calibrated in January 2026. Equipped with 2 probes.'),
    ('b0000001-0000-0000-0000-000000000003', 'EQ-FGEN-201', 'Agilent 33220A 20MHz Function / Arbitrary Waveform Generator', 'Signal Sources', 'Bench B-01', 'available', 'good', 'Standard sine, square, ramp, noise and arbitrary waveforms'),
    ('b0000001-0000-0000-0000-000000000004', 'EQ-DMM-301', 'Fluke 179 True RMS Digital Multimeter', 'Measurement', 'Cabinet C-01', 'available', 'good', 'Includes temperature probe and TL75 test leads'),
    ('b0000001-0000-0000-0000-000000000005', 'EQ-DMM-302', 'Fluke 179 True RMS Digital Multimeter', 'Measurement', 'Cabinet C-01', 'issued', 'good', 'Equipped with heavy duty alligator clips'),
    ('b0000001-0000-0000-0000-000000000006', 'EQ-RPI4-401', 'Raspberry Pi 4 Model B (8GB RAM) Lab Kit', 'Embedded Systems', 'Cabinet D-02', 'available', 'good', 'Kit includes official 32GB microSD, 5.1V PSU, and HDMI cable'),
    ('b0000001-0000-0000-0000-000000000007', 'EQ-FPGA-501', 'Digilent Basys 3 Artix-7 FPGA Trainer Board', 'Digital Design', 'Cabinet E-01', 'available', 'good', 'Equipped with USB-JTAG programming cable and vivado license guide'),
    ('b0000001-0000-0000-0000-000000000008', 'EQ-SOLD-601', 'Hakko FX-888D Digital Soldering Station (ESD-Safe)', 'Fabrication', 'Bench F-01', 'damaged', 'damaged', 'Heating element requires replacement. Tagged out for repair.'),
    ('b0000001-0000-0000-0000-000000000009', 'EQ-PSU-701', 'Keysight E3631A Triple Output DC Power Supply (80W)', 'Power Supplies', 'Bench B-02', 'maintenance', 'needs_repair', 'Channel 2 calibration offset out of spec. Scheduled maintenance.'),
    ('b0000001-0000-0000-0000-000000000010', 'EQ-SENS-801', 'Advanced IoT Sensor Kit (37-in-1 Sensor Modules)', 'IoT & Sensors', 'Cabinet D-03', 'available', 'good', 'Includes ultrasonic, gas, PIR, temperature, and accelerometer modules')
ON CONFLICT (asset_id) DO NOTHING;

-- ----------------------------------------------------------------------------
-- 4. SEED SCAN EVENTS
-- ----------------------------------------------------------------------------
INSERT INTO public.scan_events (template_id, student_id, status, device_id, is_test, created_at)
VALUES
    (1, 'a0000001-0000-0000-0000-000000000001', 'matched', 'esp32-lab-01', false, now() - INTERVAL '15 minutes'),
    (2, 'a0000001-0000-0000-0000-000000000002', 'matched', 'esp32-lab-01', false, now() - INTERVAL '45 minutes'),
    (99, NULL, 'not_found', 'esp32-lab-01', false, now() - INTERVAL '2 hours'),
    (4, 'a0000001-0000-0000-0000-000000000004', 'matched', 'esp32-lab-01', false, now() - INTERVAL '3 hours'),
    (1, 'a0000001-0000-0000-0000-000000000001', 'matched', 'esp32-lab-01', true, now() - INTERVAL '4 hours');

-- ----------------------------------------------------------------------------
-- 5. SEED DEVICE HEARTBEAT
-- ----------------------------------------------------------------------------
INSERT INTO public.device_heartbeats (device_id, ip_address, status, uptime_seconds, free_heap, firmware_version, created_at)
VALUES
    ('esp32-lab-01', '192.168.1.150', 'online', 86420, 185430, '1.2.0', now() - INTERVAL '30 seconds');
