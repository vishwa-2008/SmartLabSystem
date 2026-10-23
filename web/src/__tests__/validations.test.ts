import { describe, it, expect } from 'vitest';
import {
  studentSchema,
  equipmentSchema,
  issueEquipmentSchema,
  returnEquipmentSchema,
  staffInviteSchema,
  loginSchema
} from '../lib/validations';

describe('Validation Schemas Unit Tests', () => {
  describe('Student Schema Validation', () => {
    it('accepts valid KARE student data', () => {
      const validStudent = {
        reg_number: '9921004001',
        full_name: 'Aarav Sharma',
        department: 'Computer Science and Engineering',
        section: 'A',
        year: 3,
        phone: '+91 98765 43210',
        active: true
      };
      const result = studentSchema.safeParse(validStudent);
      expect(result.success).toBe(true);
    });

    it('rejects short registration number', () => {
      const invalid = {
        reg_number: '12',
        full_name: 'Test Student',
        department: 'CSE',
        section: 'A',
        year: 2
      };
      const result = studentSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it('rejects invalid academic year greater than 5', () => {
      const invalid = {
        reg_number: '9921004002',
        full_name: 'Priya R',
        department: 'ECE',
        section: 'B',
        year: 6
      };
      const result = studentSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it('rejects malformed phone numbers', () => {
      const invalid = {
        reg_number: '9921004003',
        full_name: 'Karthik V',
        department: 'EEE',
        section: 'A',
        year: 4,
        phone: '12345'
      };
      const result = studentSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });
  });

  describe('Equipment Schema Validation', () => {
    it('accepts valid laboratory equipment', () => {
      const valid = {
        asset_id: 'EQ-DSO-101',
        name: 'Tektronix TBS1052B Oscilloscope',
        category: 'Testing & Measurement',
        location: 'Bench A-01',
        condition: 'good',
        status: 'available',
        description: '50MHz 2-channel oscilloscope'
      };
      const result = equipmentSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });

    it('rejects equipment with invalid condition enum', () => {
      const invalid = {
        asset_id: 'EQ-DSO-102',
        name: 'Tektronix TBS1052B Oscilloscope',
        category: 'Testing & Measurement',
        location: 'Bench A-01',
        condition: 'broken_beyond_repair', // invalid enum
        status: 'available'
      };
      const result = equipmentSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });
  });

  describe('Equipment Issue Schema Validation', () => {
    it('accepts valid UUIDs for student and equipment', () => {
      const valid = {
        student_id: 'a0000001-0000-0000-0000-000000000001',
        equipment_id: 'b0000001-0000-0000-0000-000000000001',
        due_at: '2026-10-30T17:00:00Z',
        issue_remarks: 'Experiment 4'
      };
      const result = issueEquipmentSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });

    it('rejects invalid non-UUID string for student_id', () => {
      const invalid = {
        student_id: 'not-a-uuid-1234',
        equipment_id: 'b0000001-0000-0000-0000-000000000001',
        due_at: '2026-10-30T17:00:00Z'
      };
      const result = issueEquipmentSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });
  });

  describe('Equipment Return Schema Validation', () => {
    it('accepts valid return transaction payload', () => {
      const valid = {
        transaction_id: 't0000001-0000-0000-0000-000000000001',
        return_condition: 'good',
        return_remarks: 'Probes returned in good order'
      };
      const result = returnEquipmentSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });
  });

  describe('Staff Invitation Schema Validation', () => {
    it('accepts valid staff email, name, role and 8+ char password', () => {
      const valid = {
        email: 'vijayakumar.lab@klu.ac.in',
        full_name: 'Er. K. Vijayakumar',
        role: 'lab_incharge',
        password: 'securePassword123'
      };
      const result = staffInviteSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });

    it('rejects password shorter than 8 characters', () => {
      const invalid = {
        email: 'vijayakumar.lab@klu.ac.in',
        full_name: 'Er. K. Vijayakumar',
        role: 'lab_incharge',
        password: 'short'
      };
      const result = staffInviteSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });
  });

  describe('Login Schema Validation', () => {
    it('accepts valid email and password', () => {
      const valid = {
        email: 'hod.ece@klu.ac.in',
        password: 'password123'
      };
      const result = loginSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });
  });
});
