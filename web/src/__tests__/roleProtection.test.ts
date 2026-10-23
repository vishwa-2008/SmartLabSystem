import { describe, it, expect } from 'vitest';
import { StaffProfile } from '../types';

describe('Role-Based Access Control (RBAC) & Safety Logic', () => {
  const staffRoster: StaffProfile[] = [
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
    }
  ];

  function canAccessStaffManagement(user: StaffProfile | null): boolean {
    if (!user || !user.active) return false;
    return user.role === 'HOD';
  }

  function canDeactivateStaff(actor: StaffProfile, targetId: string, currentRoster: StaffProfile[]): { allowed: boolean; reason?: string } {
    if (!actor.active || actor.role !== 'HOD') {
      return { allowed: false, reason: 'Only active HOD may deactivate staff accounts' };
    }

    const target = currentRoster.find(s => s.id === targetId);
    if (!target) return { allowed: false, reason: 'Staff member not found' };

    // Safety rule: Cannot deactivate the last active HOD
    if (target.role === 'HOD' && target.active) {
      const activeHods = currentRoster.filter(s => s.role === 'HOD' && s.active);
      if (activeHods.length <= 1) {
        return { allowed: false, reason: 'Protection rule: Cannot deactivate the sole active HOD account' };
      }
    }

    return { allowed: true };
  }

  it('allows active HOD to access staff management', () => {
    const hod = staffRoster[0];
    expect(canAccessStaffManagement(hod)).toBe(true);
  });

  it('denies Lab In-Charge from accessing staff management', () => {
    const labIncharge = staffRoster[1];
    expect(canAccessStaffManagement(labIncharge)).toBe(false);
  });

  it('denies deactivated HOD from accessing staff management', () => {
    const deactivatedHod: StaffProfile = {
      ...staffRoster[0],
      active: false
    };
    expect(canAccessStaffManagement(deactivatedHod)).toBe(false);
  });

  it('prevents deactivating the sole active HOD', () => {
    const hod = staffRoster[0];
    const result = canDeactivateStaff(hod, hod.id, staffRoster);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('Cannot deactivate the sole active HOD');
  });

  it('allows deactivating a Lab In-Charge by an active HOD', () => {
    const hod = staffRoster[0];
    const labIncharge = staffRoster[1];
    const result = canDeactivateStaff(hod, labIncharge.id, staffRoster);
    expect(result.allowed).toBe(true);
  });
});
