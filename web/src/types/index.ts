/**
 * KARE Smart Lab Equipment Management System
 * Core TypeScript Definitions & Domain Models
 */

export type StaffRole = 'HOD' | 'lab_incharge';

export interface Laboratory {
  id: string;
  name: string;
  lab_code: string;
  department: string;
  location: string;
  description?: string;
  is_active: boolean;
  created_by?: string;
  created_at: string;
  updated_at?: string;
}

export interface LabAssignment {
  id: string;
  lab_id: string;
  user_id: string;
  assigned_by?: string;
  assigned_at: string;
  is_active: boolean;
  laboratories?: Laboratory;
}

export interface StaffProfile {
  id: string;
  email: string;
  full_name: string;
  role: StaffRole;
  active: boolean;
  created_at: string;
  updated_at?: string;
  lab_assignments?: LabAssignment[];
}

export interface Student {
  id: string;
  reg_number: string;
  full_name: string;
  department: string;
  section: string;
  year: number;
  phone?: string;
  active: boolean;
  photo_url?: string;
  fingerprint_enrolled?: boolean;
  template_id?: number;
  created_by?: string;
  created_at: string;
  updated_at?: string;
  fingerprint_templates?: { template_id: number; active: boolean; enrolled_at: string }[];
}

export type EquipmentStatus = 'available' | 'issued' | 'overdue' | 'damaged' | 'maintenance' | 'missing';
export type EquipmentCondition = 'good' | 'fair' | 'damaged' | 'needs_repair';

export interface Equipment {
  id: string;
  asset_id: string;
  name: string;
  category: string;
  location: string;
  status: EquipmentStatus;
  condition: EquipmentCondition;
  description?: string;
  lab_id?: string;
  lab?: { id: string; name: string; lab_code: string };
  created_by?: string;
  created_at: string;
  updated_at?: string;
  current_borrower?: {
    student_id: string;
    student_name: string;
    reg_number: string;
    issued_at: string;
    due_at: string;
  };
}

export type TransactionStatus = 'active' | 'returned' | 'overdue' | 'damaged';

export interface EquipmentTransaction {
  id: string;
  student_id: string;
  equipment_id: string;
  issued_by: string;
  issued_at: string;
  due_at: string;
  returned_by?: string;
  returned_at?: string;
  status: TransactionStatus;
  issue_condition?: EquipmentCondition;
  return_condition?: EquipmentCondition;
  issue_remarks?: string;
  return_remarks?: string;
  lab_id?: string;
  created_at: string;
  is_overdue?: boolean;
  hours_outstanding?: number;
  laboratory?: {
    id: string;
    name: string;
    lab_code: string;
  };
  student?: {
    id: string;
    reg_number: string;
    full_name: string;
    department: string;
    section: string;
    year?: number;
  };
  equipment?: {
    id: string;
    asset_id: string;
    name: string;
    category: string;
  };
  issuer?: { full_name: string; role: string };
  returner?: { full_name: string; role: string };
  issued_by_staff?: { full_name: string; role: string };
}

export type ScanStatus = 'matched' | 'not_found' | 'error' | 'pending';

export interface ScanEvent {
  id: string;
  template_id: number;
  student_id?: string | null;
  status: ScanStatus;
  device_id: string;
  is_test: boolean;
  created_at: string;
  student?: {
    id: string;
    reg_number: string;
    full_name: string;
    department: string;
    section: string;
  } | null;
}

export interface DeviceTelemetry {
  deviceId: string;
  status: 'online' | 'offline';
  online: boolean;
  lastSeen: string | null;
  ipAddress?: string;
  uptimeSeconds?: number;
  freeHeap?: number;
  rssi?: number;
  firmwareVersion?: string;
}

export interface DashboardStats {
  total_students: number;
  total_equipment: number;
  currently_issued: number;
  available_equipment: number;
  overdue_equipment: number;
  damaged_equipment: number;
  returned_equipment: number;
  today_scans: number;
  online_devices: number;
  total_labs: number;
  active_staff: number;
  computed_at?: string;
}

export interface EnrollmentSession {
  sessionId: string;
  studentId: string;
  studentName?: string;
  studentReg?: string;
  targetTemplateId: number;
  status: 'waiting_device' | 'ready_for_finger' | 'enrolled' | 'failed' | 'cancelled';
  errorMessage?: string;
  createdAt: string;
  completedAt?: string;
}

export interface AuditLog {
  id: string;
  actor_id?: string;
  action: string;
  entity_type: string;
  entity_id?: string;
  details?: Record<string, unknown>;
  ip_address?: string;
  created_at: string;
  actor?: { full_name: string; role: string; email: string };
}
