import { z } from 'zod';

const uuidPattern = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
const idPattern = /^[0-9a-zA-Z]{8}-[0-9a-zA-Z]{4}-[0-9a-zA-Z]{4}-[0-9a-zA-Z]{4}-[0-9a-zA-Z]{12}$/;

export const studentSchema = z.object({
  reg_number: z
    .string()
    .min(5, 'Registration number must be at least 5 characters')
    .max(20, 'Registration number must not exceed 20 characters')
    .regex(/^[A-Z0-9]+$/i, 'Registration number must be alphanumeric'),
  full_name: z
    .string()
    .min(2, 'Full name must be at least 2 characters')
    .max(100, 'Full name must not exceed 100 characters'),
  department: z
    .string()
    .min(2, 'Department is required'),
  section: z
    .string()
    .min(1, 'Section is required')
    .max(5, 'Section is too long'),
  year: z
    .number()
    .int()
    .min(1, 'Year must be between 1 and 5')
    .max(5, 'Year must be between 1 and 5'),
  phone: z
    .string()
    .regex(/^(\+91[\s-]?)?[6-9][\d\s-]{8,12}\d$/, 'Please enter a valid Indian mobile number')
    .optional()
    .or(z.literal('')),
  active: z.boolean().default(true)
});

export const equipmentSchema = z.object({
  asset_id: z
    .string()
    .min(3, 'Asset ID must be at least 3 characters')
    .max(30, 'Asset ID must not exceed 30 characters')
    .regex(/^[A-Z0-9-]+$/i, 'Asset ID can contain uppercase letters, numbers, and hyphens'),
  name: z
    .string()
    .min(3, 'Equipment name must be at least 3 characters')
    .max(150, 'Equipment name must not exceed 150 characters'),
  category: z
    .string()
    .min(2, 'Category is required'),
  location: z
    .string()
    .min(2, 'Location is required'),
  condition: z
    .enum(['good', 'fair', 'damaged', 'needs_repair']),
  status: z
    .enum(['available', 'issued', 'overdue', 'damaged', 'maintenance'])
    .default('available'),
  description: z
    .string()
    .max(500, 'Description cannot exceed 500 characters')
    .optional()
    .or(z.literal(''))
});

export const issueEquipmentSchema = z.object({
  student_id: z.string().regex(uuidPattern, 'Please select a verified student with valid UUID'),
  equipment_id: z.string().regex(uuidPattern, 'Please select an available equipment asset with valid UUID'),
  due_at: z.string().min(1, 'Due date is required'),
  issue_remarks: z.string().max(300, 'Remarks cannot exceed 300 characters').optional()
});

export const returnEquipmentSchema = z.object({
  transaction_id: z.string().regex(idPattern, 'Valid Transaction ID required'),
  return_condition: z.enum(['good', 'fair', 'damaged', 'needs_repair']),
  return_remarks: z.string().max(300, 'Remarks cannot exceed 300 characters').optional()
});

export const staffInviteSchema = z.object({
  email: z.string().email('Please enter a valid university email address'),
  full_name: z.string().min(2, 'Full name must be at least 2 characters'),
  role: z.enum(['HOD', 'lab_incharge']),
  password: z.string().min(8, 'Temporary password must be at least 8 characters')
});

export const loginSchema = z.object({
  email: z.string().email('Please enter your university email'),
  password: z.string().min(6, 'Password must be at least 6 characters')
});

export type StudentFormData = z.infer<typeof studentSchema>;
export type EquipmentFormData = z.infer<typeof equipmentSchema>;
export type IssueEquipmentFormData = z.infer<typeof issueEquipmentSchema>;
export type ReturnEquipmentFormData = z.infer<typeof returnEquipmentSchema>;
export type StaffInviteFormData = z.infer<typeof staffInviteSchema>;
export type LoginFormData = z.infer<typeof loginSchema>;
