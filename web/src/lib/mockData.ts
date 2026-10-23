import { Student, Equipment, EquipmentTransaction, ScanEvent, StaffProfile, DeviceTelemetry } from '@/types';

export const INITIAL_STAFF: StaffProfile[] = [
  {
    id: 'c0000001-0000-0000-0000-000000000001',
    email: 'hod.ece@klu.ac.in',
    full_name: 'Dr. S. Ramanathan',
    role: 'HOD',
    active: true,
    created_at: '2025-08-01T09:00:00Z'
  },
  {
    id: 'c0000001-0000-0000-0000-000000000002',
    email: 'vijayakumar.lab@klu.ac.in',
    full_name: 'Er. K. Vijayakumar',
    role: 'lab_incharge',
    active: true,
    created_at: '2025-08-15T10:30:00Z'
  },
  {
    id: 'c0000001-0000-0000-0000-000000000003',
    email: 'meenakshi.lab@klu.ac.in',
    full_name: 'Mrs. M. Meenakshi',
    role: 'lab_incharge',
    active: true,
    created_at: '2025-09-01T11:00:00Z'
  }
];

export const INITIAL_STUDENTS: Student[] = [
  {
    id: 'a0000001-0000-0000-0000-000000000001',
    reg_number: '9921004001',
    full_name: 'Aarav Sharma',
    department: 'Computer Science and Engineering',
    section: 'A',
    year: 3,
    phone: '+91 98765 43210',
    active: true,
    fingerprint_enrolled: true,
    template_id: 1,
    created_at: '2025-09-10T10:00:00Z'
  },
  {
    id: 'a0000001-0000-0000-0000-000000000002',
    reg_number: '9921004002',
    full_name: 'Priya Ramanathan',
    department: 'Electronics and Communication',
    section: 'B',
    year: 3,
    phone: '+91 98765 43211',
    active: true,
    fingerprint_enrolled: true,
    template_id: 2,
    created_at: '2025-09-12T11:30:00Z'
  },
  {
    id: 'a0000001-0000-0000-0000-000000000003',
    reg_number: '9921004003',
    full_name: 'Karthik Venkatesh',
    department: 'Electrical and Electronics',
    section: 'A',
    year: 4,
    phone: '+91 98765 43212',
    active: true,
    fingerprint_enrolled: true,
    template_id: 3,
    created_at: '2025-09-14T14:15:00Z'
  },
  {
    id: 'a0000001-0000-0000-0000-000000000004',
    reg_number: '9921004004',
    full_name: 'Sneha Balasubramanian',
    department: 'Computer Science and Engineering',
    section: 'C',
    year: 2,
    phone: '+91 98765 43213',
    active: true,
    fingerprint_enrolled: true,
    template_id: 4,
    created_at: '2025-09-15T09:45:00Z'
  },
  {
    id: 'a0000001-0000-0000-0000-000000000005',
    reg_number: '9921004005',
    full_name: 'Vignesh Sundaram',
    department: 'Mechanical Engineering',
    section: 'A',
    year: 3,
    phone: '+91 98765 43214',
    active: true,
    fingerprint_enrolled: true,
    template_id: 5,
    created_at: '2025-09-18T16:00:00Z'
  },
  {
    id: 'a0000001-0000-0000-0000-000000000006',
    reg_number: '9921004006',
    full_name: 'Ananya Krishnan',
    department: 'Information Technology',
    section: 'B',
    year: 2,
    phone: '+91 98765 43215',
    active: true,
    fingerprint_enrolled: false,
    created_at: '2025-09-20T10:20:00Z'
  },
  {
    id: 'a0000001-0000-0000-0000-000000000007',
    reg_number: '9921004007',
    full_name: 'Rahul Chandrasekhar',
    department: 'Electronics and Communication',
    section: 'A',
    year: 4,
    phone: '+91 98765 43216',
    active: false,
    fingerprint_enrolled: false,
    created_at: '2025-09-22T13:00:00Z'
  }
];

export const INITIAL_EQUIPMENT: Equipment[] = [
  {
    id: 'b0000001-0000-0000-0000-000000000001',
    asset_id: 'EQ-DSO-101',
    name: 'Tektronix TBS1052B Digital Storage Oscilloscope (50MHz)',
    category: 'Testing & Measurement',
    location: 'Bench A-01',
    status: 'available',
    condition: 'good',
    description: '2-channel digital storage oscilloscope with 1 GS/s sample rate and USB interface',
    created_at: '2025-08-10T10:00:00Z'
  },
  {
    id: 'b0000001-0000-0000-0000-000000000002',
    asset_id: 'EQ-DSO-102',
    name: 'Tektronix TBS1052B Digital Storage Oscilloscope (50MHz)',
    category: 'Testing & Measurement',
    location: 'Bench A-02',
    status: 'issued',
    condition: 'good',
    description: 'Equipped with 2 passive probes (10X attenuation). Calibrated Jan 2026.',
    created_at: '2025-08-10T10:00:00Z',
    current_borrower: {
      student_id: 'a0000001-0000-0000-0000-000000000001',
      student_name: 'Aarav Sharma',
      reg_number: '9921004001',
      issued_at: '2026-10-20T10:30:00Z',
      due_at: '2026-10-27T17:00:00Z'
    }
  },
  {
    id: 'b0000001-0000-0000-0000-000000000003',
    asset_id: 'EQ-FGEN-201',
    name: 'Agilent 33220A 20MHz Function / Arbitrary Waveform Generator',
    category: 'Signal Sources',
    location: 'Bench B-01',
    status: 'available',
    condition: 'good',
    description: 'Sine, square, ramp, noise and arbitrary waveforms up to 20MHz with 14-bit resolution',
    created_at: '2025-08-12T11:00:00Z'
  },
  {
    id: 'b0000001-0000-0000-0000-000000000004',
    asset_id: 'EQ-DMM-301',
    name: 'Fluke 179 True RMS Digital Multimeter',
    category: 'Measurement',
    location: 'Cabinet C-01',
    status: 'available',
    condition: 'good',
    description: 'Manual and automatic ranging with temperature measurement and backlit display',
    created_at: '2025-08-15T09:30:00Z'
  },
  {
    id: 'b0000001-0000-0000-0000-000000000005',
    asset_id: 'EQ-DMM-302',
    name: 'Fluke 179 True RMS Digital Multimeter',
    category: 'Measurement',
    location: 'Cabinet C-01',
    status: 'overdue',
    condition: 'good',
    description: 'Includes premium test lead set and alligator clips',
    created_at: '2025-08-15T09:30:00Z',
    current_borrower: {
      student_id: 'a0000001-0000-0000-0000-000000000003',
      student_name: 'Karthik Venkatesh',
      reg_number: '9921004003',
      issued_at: '2026-10-10T14:00:00Z',
      due_at: '2026-10-17T17:00:00Z'
    }
  },
  {
    id: 'b0000001-0000-0000-0000-000000000006',
    asset_id: 'EQ-RPI4-401',
    name: 'Raspberry Pi 4 Model B (8GB RAM) Lab Kit',
    category: 'Embedded Systems',
    location: 'Cabinet D-02',
    status: 'available',
    condition: 'good',
    description: 'Kit includes 32GB class-10 MicroSD, 5.1V USB-C power supply, and Micro-HDMI cable',
    created_at: '2025-08-20T13:45:00Z'
  },
  {
    id: 'b0000001-0000-0000-0000-000000000007',
    asset_id: 'EQ-FPGA-501',
    name: 'Digilent Basys 3 Artix-7 FPGA Trainer Board',
    category: 'Digital Design',
    location: 'Cabinet E-01',
    status: 'available',
    condition: 'good',
    description: 'Xilinx Artix-7 FPGA (XC7A35T-1CPG236C) complete with USB programming cable',
    created_at: '2025-08-25T15:20:00Z'
  },
  {
    id: 'b0000001-0000-0000-0000-000000000008',
    asset_id: 'EQ-SOLD-601',
    name: 'Hakko FX-888D Digital Soldering Station (ESD-Safe)',
    category: 'Fabrication',
    location: 'Bench F-01',
    status: 'damaged',
    condition: 'damaged',
    description: 'Ceramic heating element burnt out. Tagged out for repair and replacement.',
    created_at: '2025-08-28T16:00:00Z'
  },
  {
    id: 'b0000001-0000-0000-0000-000000000009',
    asset_id: 'EQ-PSU-701',
    name: 'Keysight E3631A Triple Output DC Power Supply (80W)',
    category: 'Power Supplies',
    location: 'Bench B-02',
    status: 'maintenance',
    condition: 'needs_repair',
    description: 'Channel 2 25V output fluctuates under 0.5A load. Scheduled calibration.',
    created_at: '2025-09-02T10:15:00Z'
  },
  {
    id: 'b0000001-0000-0000-0000-000000000010',
    asset_id: 'EQ-SENS-801',
    name: 'Advanced IoT Sensor Kit (37-in-1 Sensor Modules)',
    category: 'IoT & Sensors',
    location: 'Cabinet D-03',
    status: 'available',
    condition: 'good',
    description: 'Includes ultrasonic, gas, PIR, thermocouple, DHT22, and accelerometer modules',
    created_at: '2025-09-05T12:00:00Z'
  }
];

export const INITIAL_TRANSACTIONS: EquipmentTransaction[] = [
  {
    id: 't0000001-0000-0000-0000-000000000001',
    student_id: 'a0000001-0000-0000-0000-000000000001',
    equipment_id: 'b0000001-0000-0000-0000-000000000002',
    issued_by: 'c0000001-0000-0000-0000-000000000002',
    issued_at: '2026-10-20T10:30:00Z',
    due_at: '2026-10-27T17:00:00Z',
    status: 'active',
    issue_remarks: 'Required for Embedded Systems Lab Assignment 4',
    created_at: '2026-10-20T10:30:00Z',
    student: {
      id: 'a0000001-0000-0000-0000-000000000001',
      reg_number: '9921004001',
      full_name: 'Aarav Sharma',
      department: 'Computer Science and Engineering',
      section: 'A'
    },
    equipment: {
      id: 'b0000001-0000-0000-0000-000000000002',
      asset_id: 'EQ-DSO-102',
      name: 'Tektronix TBS1052B Digital Storage Oscilloscope (50MHz)',
      category: 'Testing & Measurement'
    },
    issuer: {
      full_name: 'Er. K. Vijayakumar',
      role: 'lab_incharge'
    }
  },
  {
    id: 't0000001-0000-0000-0000-000000000002',
    student_id: 'a0000001-0000-0000-0000-000000000003',
    equipment_id: 'b0000001-0000-0000-0000-000000000005',
    issued_by: 'c0000001-0000-0000-0000-000000000002',
    issued_at: '2026-10-10T14:00:00Z',
    due_at: '2026-10-17T17:00:00Z',
    status: 'overdue',
    issue_remarks: 'Power Electronics mini project testing',
    created_at: '2026-10-10T14:00:00Z',
    student: {
      id: 'a0000001-0000-0000-0000-000000000003',
      reg_number: '9921004003',
      full_name: 'Karthik Venkatesh',
      department: 'Electrical and Electronics',
      section: 'A'
    },
    equipment: {
      id: 'b0000001-0000-0000-0000-000000000005',
      asset_id: 'EQ-DMM-302',
      name: 'Fluke 179 True RMS Digital Multimeter',
      category: 'Measurement'
    },
    issuer: {
      full_name: 'Er. K. Vijayakumar',
      role: 'lab_incharge'
    }
  },
  {
    id: 't0000001-0000-0000-0000-000000000003',
    student_id: 'a0000001-0000-0000-0000-000000000002',
    equipment_id: 'b0000001-0000-0000-0000-000000000006',
    issued_by: 'c0000001-0000-0000-0000-000000000001',
    issued_at: '2026-10-15T09:00:00Z',
    due_at: '2026-10-22T17:00:00Z',
    returned_by: 'c0000001-0000-0000-0000-000000000002',
    returned_at: '2026-10-21T16:30:00Z',
    status: 'returned',
    return_condition: 'good',
    issue_remarks: 'IoT edge computing experiment',
    return_remarks: 'Returned in clean condition with all kit cables',
    created_at: '2026-10-15T09:00:00Z',
    student: {
      id: 'a0000001-0000-0000-0000-000000000002',
      reg_number: '9921004002',
      full_name: 'Priya Ramanathan',
      department: 'Electronics and Communication',
      section: 'B'
    },
    equipment: {
      id: 'b0000001-0000-0000-0000-000000000006',
      asset_id: 'EQ-RPI4-401',
      name: 'Raspberry Pi 4 Model B (8GB RAM) Lab Kit',
      category: 'Embedded Systems'
    },
    issuer: {
      full_name: 'Dr. S. Ramanathan',
      role: 'HOD'
    },
    returner: {
      full_name: 'Er. K. Vijayakumar',
      role: 'lab_incharge'
    }
  }
];

export const INITIAL_SCANS: ScanEvent[] = [
  {
    id: 's0000001-0000-0000-0000-000000000001',
    template_id: 1,
    student_id: 'a0000001-0000-0000-0000-000000000001',
    status: 'matched',
    device_id: 'esp32-lab-01',
    is_test: false,
    created_at: new Date(Date.now() - 1000 * 60 * 12).toISOString(),
    student: {
      id: 'a0000001-0000-0000-0000-000000000001',
      reg_number: '9921004001',
      full_name: 'Aarav Sharma',
      department: 'Computer Science and Engineering',
      section: 'A'
    }
  },
  {
    id: 's0000001-0000-0000-0000-000000000002',
    template_id: 2,
    student_id: 'a0000001-0000-0000-0000-000000000002',
    status: 'matched',
    device_id: 'esp32-lab-01',
    is_test: false,
    created_at: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
    student: {
      id: 'a0000001-0000-0000-0000-000000000002',
      reg_number: '9921004002',
      full_name: 'Priya Ramanathan',
      department: 'Electronics and Communication',
      section: 'B'
    }
  },
  {
    id: 's0000001-0000-0000-0000-000000000003',
    template_id: 999999,
    student_id: null,
    status: 'not_found',
    device_id: 'esp32-lab-01',
    is_test: false,
    created_at: new Date(Date.now() - 1000 * 60 * 110).toISOString(),
    student: null
  },
  {
    id: 's0000001-0000-0000-0000-000000000004',
    template_id: 4,
    student_id: 'a0000001-0000-0000-0000-000000000004',
    status: 'matched',
    device_id: 'esp32-lab-01',
    is_test: false,
    created_at: new Date(Date.now() - 1000 * 60 * 180).toISOString(),
    student: {
      id: 'a0000001-0000-0000-0000-000000000004',
      reg_number: '9921004004',
      full_name: 'Sneha Balasubramanian',
      department: 'Computer Science and Engineering',
      section: 'C'
    }
  }
];

export const INITIAL_DEVICE_TELEMETRY: DeviceTelemetry = {
  deviceId: 'esp32-lab-01',
  status: 'online',
  online: true,
  lastSeen: new Date(Date.now() - 1000 * 25).toISOString(),
  ipAddress: '192.168.1.150',
  uptimeSeconds: 86420,
  freeHeap: 185430,
  rssi: -58,
  firmwareVersion: '1.2.0'
};
