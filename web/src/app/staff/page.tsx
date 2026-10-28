'use client';

import React, { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Modal } from '@/components/ui/Modal';
import { Badge, StatusBadge } from '@/components/ui/Badge';
import { Alert } from '@/components/ui/Alert';
import { useAuth } from '@/context/AuthContext';
import { useData } from '@/context/DataContext';
import { formatDate } from '@/lib/utils';
import { StaffProfile, StaffRole } from '@/types';
import {
  UserCheck,
  ShieldCheck,
  ShieldAlert,
  PlusCircle,
  Lock,
  Building,
  KeyRound,
  Edit,
  CheckCircle2
} from 'lucide-react';
import Link from 'next/link';

export default function StaffManagementPage() {
  const { currentUser, isHOD } = useAuth();
  const { staff, labs, addStaff, toggleStaffStatus, refreshAll } = useData();

  const [isInviteModalOpen, setIsInviteModalOpen] = useState<boolean>(false);
  const [formData, setFormData] = useState({
    email: '',
    full_name: '',
    role: 'lab_incharge' as StaffRole,
    password: '',
    selectedLabIds: [] as string[]
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Edit Assignment Modal
  const [editStaff, setEditStaff] = useState<StaffProfile | null>(null);
  const [editLabIds, setEditLabIds] = useState<string[]>([]);
  const [isSavingAssignments, setIsSavingAssignments] = useState(false);

  // Guard: If not HOD, block access completely!
  if (!isHOD) {
    return (
      <AppLayout>
        <div className="max-w-2xl mx-auto py-12">
          <Card className="border-rose-200">
            <CardContent className="p-8 text-center space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-rose-100 text-rose-700 flex items-center justify-center mx-auto shadow-xs">
                <ShieldAlert className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">
                Access Denied: Head of Department Authorization Required
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed max-w-md mx-auto">
                Staff account provisioning and lab permission assignments are strictly reserved for the
                Head of Department (HOD). Your current signed-in role is{' '}
                <strong className="text-slate-800">Lab In-Charge</strong>.
              </p>
              <div className="pt-2">
                <Link href="/dashboard">
                  <Button variant="secondary" size="sm">
                    Return to Operational Dashboard
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  const handleInviteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setIsSubmitting(true);

    const res = await addStaff({
      email: formData.email,
      full_name: formData.full_name,
      role: formData.role,
      password: formData.password,
      lab_ids: formData.selectedLabIds,
      active: true
    });

    setIsSubmitting(false);

    if (!res.success) {
      setFormError(res.error || 'Failed to authorize staff account');
    } else {
      setIsInviteModalOpen(false);
      setFormData({
        email: '',
        full_name: '',
        role: 'lab_incharge',
        password: '',
        selectedLabIds: []
      });
      await refreshAll();
    }
  };

  const handleToggle = async (target: StaffProfile) => {
    const action = target.active ? 'deactivate' : 'reactivate';
    if (confirm(`Are you sure you want to ${action} staff account for ${target.full_name}?`)) {
      const res = await toggleStaffStatus(target.id);
      if (!res.success) {
        alert(res.error);
      }
    }
  };

  const handleOpenEditAssignments = (member: StaffProfile) => {
    const currentActiveLabs = (member.lab_assignments || [])
      .filter(a => a.is_active)
      .map(a => a.lab_id);
    setEditStaff(member);
    setEditLabIds(currentActiveLabs);
  };

  const handleSaveAssignments = async () => {
    if (!editStaff) return;
    setIsSavingAssignments(true);
    try {
      const token = (await import('@/lib/supabaseClient')).supabase;
      const { data: { session } } = await token.auth.getSession();
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3000'}/api/lab-incharges/${editStaff.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token || ''}`
        },
        body: JSON.stringify({ lab_ids: editLabIds })
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error || 'Failed to update lab assignments');
      }
      setEditStaff(null);
      await refreshAll();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Error updating lab assignments');
    } finally {
      setIsSavingAssignments(false);
    }
  };

  return (
    <AppLayout title="Staff & Lab Permissions">
      <div className="space-y-6 max-w-7xl mx-auto">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <UserCheck className="w-7 h-7 text-[#1B4998]" />
              Staff Authorization & Lab Assignments
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              HOD module to provision staff accounts, assign specific laboratory scopes, and manage access privileges.
            </p>
          </div>

          <Button
            size="sm"
            onClick={() => {
              setFormData({
                email: '',
                full_name: '',
                role: 'lab_incharge',
                password: '',
                selectedLabIds: labs.length > 0 ? [labs[0].id] : []
              });
              setFormError(null);
              setIsInviteModalOpen(true);
            }}
            className="bg-[#1B4998] hover:bg-[#143775] text-white flex items-center gap-2"
          >
            <PlusCircle className="w-4 h-4" />
            Authorize New Staff Member
          </Button>
        </div>

        {/* Staff Roster Table */}
        <Card className="border-slate-200 shadow-xs overflow-hidden">
          <CardHeader className="py-3.5 px-6 border-b border-slate-200 flex flex-row items-center justify-between">
            <CardTitle className="text-base font-semibold text-slate-800 flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-[#1B4998]" />
              Authorized Laboratory Staff Roster ({staff.length})
            </CardTitle>
          </CardHeader>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-600 uppercase text-[10px] font-semibold tracking-wider">
                <tr>
                  <th className="px-5 py-3">Staff Member</th>
                  <th className="px-5 py-3">University Email</th>
                  <th className="px-5 py-3">System Role</th>
                  <th className="px-5 py-3">Assigned Laboratories</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Added Date</th>
                  <th className="px-5 py-3 text-right">Access Controls</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {staff.map(member => {
                  const assignedLabs = (member.lab_assignments || [])
                    .filter(a => a.is_active && a.laboratories)
                    .map(a => a.laboratories?.name || 'Lab');

                  return (
                    <tr key={member.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-5 py-3.5 font-semibold text-slate-900">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-[#1B4998]/10 text-[#1B4998] flex items-center justify-center font-bold text-xs shrink-0">
                            {member.full_name.charAt(0)}
                          </div>
                          <div>
                            <span className="text-sm font-semibold">{member.full_name}</span>
                            {member.id === currentUser?.id && (
                              <span className="ml-1.5 text-[9px] px-1.5 py-0.5 rounded bg-blue-100 text-[#1B4998] font-bold">
                                YOU
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      <td className="px-5 py-3.5 font-mono text-slate-600">{member.email}</td>

                      <td className="px-5 py-3.5">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${
                            member.role === 'HOD'
                              ? 'bg-indigo-50 text-indigo-800 border-indigo-200'
                              : 'bg-blue-50 text-[#1B4998] border-blue-200'
                          }`}
                        >
                          <ShieldCheck className="w-3.5 h-3.5" />
                          <span>{member.role === 'HOD' ? 'HOD (Institution)' : 'Lab In-Charge'}</span>
                        </span>
                      </td>

                      {/* Assigned Laboratories Column */}
                      <td className="px-5 py-3.5">
                        {member.role === 'HOD' ? (
                          <span className="text-xs font-semibold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded">
                            All Laboratories (Full Dept Scope)
                          </span>
                        ) : assignedLabs.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {assignedLabs.map((lName, idx) => (
                              <span key={idx} className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-[11px] font-medium border border-slate-200">
                                {lName}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-xs text-amber-600 font-medium italic">
                            Unassigned
                          </span>
                        )}
                      </td>

                      <td className="px-5 py-3.5">
                        <StatusBadge status={member.active ? 'active' : 'inactive'} />
                      </td>

                      <td className="px-5 py-3.5 text-slate-500 whitespace-nowrap">
                        {formatDate(member.created_at)}
                      </td>

                      <td className="px-5 py-3.5 text-right whitespace-nowrap space-x-1.5">
                        {member.role !== 'HOD' && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs px-2"
                            onClick={() => handleOpenEditAssignments(member)}
                          >
                            <Building className="w-3 h-3 mr-1" />
                            Labs
                          </Button>
                        )}

                        {member.id !== currentUser?.id && (
                          <Button
                            size="sm"
                            variant={member.active ? 'outline' : 'secondary'}
                            className="h-7 text-xs px-2"
                            onClick={() => handleToggle(member)}
                          >
                            {member.active ? 'Deactivate' : 'Reactivate'}
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Modal: Authorize New Staff Member */}
        <Modal
          isOpen={isInviteModalOpen}
          onClose={() => setIsInviteModalOpen(false)}
          title="Authorize New Staff Member"
        >
          <form onSubmit={handleInviteSubmit} className="space-y-4">
            {formError && (
              <Alert variant="danger" title="Authorization Error">
                {formError}
              </Alert>
            )}

            <Input
              label="Staff Full Name *"
              placeholder="e.g. Er. K. Vijayakumar"
              value={formData.full_name}
              onChange={e => setFormData({ ...formData, full_name: e.target.value })}
              required
            />

            <Input
              label="University Email Address *"
              type="email"
              placeholder="e.g. staff.ece@klu.ac.in"
              value={formData.email}
              onChange={e => setFormData({ ...formData, email: e.target.value })}
              required
            />

            <Select
              label="System Role *"
              value={formData.role}
              onChange={e => setFormData({ ...formData, role: e.target.value as StaffRole })}
            >
              <option value="lab_incharge">Lab In-Charge (Scoped to assigned labs)</option>
              <option value="HOD">Head of Department (Full department permissions)</option>
            </Select>

            {/* Lab Checkboxes (if Lab In-Charge) */}
            {formData.role === 'lab_incharge' && (
              <div className="space-y-2 pt-1">
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
                  Assign Authorized Laboratories *
                </label>
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-2 max-h-36 overflow-y-auto">
                  {labs.map(lab => {
                    const isChecked = formData.selectedLabIds.includes(lab.id);
                    return (
                      <label key={lab.id} className="flex items-center gap-2.5 text-xs text-slate-800 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={e => {
                            if (e.target.checked) {
                              setFormData({ ...formData, selectedLabIds: [...formData.selectedLabIds, lab.id] });
                            } else {
                              setFormData({ ...formData, selectedLabIds: formData.selectedLabIds.filter(id => id !== lab.id) });
                            }
                          }}
                          className="rounded text-[#1B4998] focus:ring-[#1B4998]"
                        />
                        <span><strong>{lab.name}</strong> ({lab.lab_code})</span>
                      </label>
                    );
                  })}
                  {labs.length === 0 && (
                    <p className="text-xs text-slate-500">No laboratories created yet.</p>
                  )}
                </div>
              </div>
            )}

            <Input
              label="Initial Password (min 8 chars) *"
              type="password"
              placeholder="••••••••"
              value={formData.password}
              onChange={e => setFormData({ ...formData, password: e.target.value })}
              required
            />

            <div className="flex justify-end gap-2 pt-3">
              <Button
                variant="outline"
                type="button"
                onClick={() => setIsInviteModalOpen(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="bg-[#1B4998] hover:bg-[#143775] text-white"
              >
                {isSubmitting ? 'Authorizing...' : 'Create Account'}
              </Button>
            </div>
          </form>
        </Modal>

        {/* Modal: Edit Lab Assignments for Existing Staff */}
        <Modal
          isOpen={Boolean(editStaff)}
          onClose={() => setEditStaff(null)}
          title={`Edit Lab Assignments: ${editStaff?.full_name || ''}`}
        >
          {editStaff && (
            <div className="space-y-4">
              <p className="text-xs text-slate-500">
                Select which laboratories this staff member is authorized to manage equipment and issue returns for:
              </p>
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-2.5 max-h-48 overflow-y-auto">
                {labs.map(lab => {
                  const isChecked = editLabIds.includes(lab.id);
                  return (
                    <label key={lab.id} className="flex items-center gap-2.5 text-xs text-slate-800 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={e => {
                          if (e.target.checked) {
                            setEditLabIds([...editLabIds, lab.id]);
                          } else {
                            setEditLabIds(editLabIds.filter(id => id !== lab.id));
                          }
                        }}
                        className="rounded text-[#1B4998] focus:ring-[#1B4998]"
                      />
                      <span><strong>{lab.name}</strong> ({lab.lab_code})</span>
                    </label>
                  );
                })}
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  variant="outline"
                  onClick={() => setEditStaff(null)}
                  disabled={isSavingAssignments}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSaveAssignments}
                  disabled={isSavingAssignments}
                  className="bg-[#1B4998] text-white"
                >
                  {isSavingAssignments ? 'Saving...' : 'Save Assignments'}
                </Button>
              </div>
            </div>
          )}
        </Modal>
      </div>
    </AppLayout>
  );
}
