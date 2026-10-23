'use client';

import React, { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Modal } from '@/components/ui/Modal';
import { StatusBadge } from '@/components/ui/Badge';
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
  CheckCircle2,
  XCircle,
  KeyRound
} from 'lucide-react';
import Link from 'next/link';

export default function StaffManagementPage() {
  const { currentUser, isHOD } = useAuth();
  const { staff, addStaff, toggleStaffStatus } = useData();

  const [isInviteModalOpen, setIsInviteModalOpen] = useState<boolean>(false);
  const [formData, setFormData] = useState({
    email: '',
    full_name: '',
    role: 'lab_incharge' as StaffRole,
    password: ''
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

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
                Staff account provisioning and permission deactivation are strictly reserved for the
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
        password: ''
      });
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

  return (
    <AppLayout>
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">
            Staff Authorization & Access Control
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            HOD module to invite, assign roles, and manage laboratory staff privileges.
          </p>
        </div>

        <Button
          size="sm"
          onClick={() => {
            setFormData({
              email: '',
              full_name: '',
              role: 'lab_incharge',
              password: ''
            });
            setFormError(null);
            setIsInviteModalOpen(true);
          }}
          leftIcon={<PlusCircle className="w-4 h-4" />}
        >
          Authorize New Staff Member
        </Button>
      </div>

      {/* Staff Roster Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <UserCheck className="w-4 h-4 text-[#1B4998]" />
            <CardTitle>Authorized Laboratory Staff Roster ({staff.length})</CardTitle>
          </div>
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-100 text-slate-500 uppercase text-[10px] font-semibold tracking-wider">
              <tr>
                <th className="px-5 py-3">Staff Member</th>
                <th className="px-5 py-3">University Email</th>
                <th className="px-5 py-3">System Role</th>
                <th className="px-5 py-3">Authorization Status</th>
                <th className="px-5 py-3">Added Date</th>
                <th className="px-5 py-3 text-right">Access Controls</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {staff.map(member => (
                <tr key={member.id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="px-5 py-3 font-semibold text-slate-900">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-full bg-[#1B4998]/10 text-[#1B4998] flex items-center justify-center font-bold text-xs shrink-0">
                        {member.full_name.charAt(0)}
                      </div>
                      <div>
                        <span>{member.full_name}</span>
                        {member.id === currentUser?.id && (
                          <span className="ml-1.5 text-[9px] px-1.5 py-0.2 rounded bg-blue-100 text-[#1B4998] font-bold">
                            YOU
                          </span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3 font-mono text-slate-600">{member.email}</td>
                  <td className="px-5 py-3">
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${
                        member.role === 'HOD'
                          ? 'bg-indigo-50 text-indigo-800 border-indigo-200'
                          : 'bg-blue-50 text-[#1B4998] border-blue-200'
                      }`}
                    >
                      <ShieldCheck className="w-3.5 h-3.5" />
                      <span>{member.role === 'HOD' ? 'Head of Department' : 'Lab In-Charge'}</span>
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <StatusBadge status={member.active ? 'active' : 'inactive'} />
                  </td>
                  <td className="px-5 py-3 text-slate-500 whitespace-nowrap">
                    {formatDate(member.created_at)}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <Button
                      size="sm"
                      variant={member.active ? 'outline' : 'secondary'}
                      className="h-7 text-xs"
                      onClick={() => handleToggle(member)}
                    >
                      {member.active ? 'Deactivate' : 'Reactivate'}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Security Policies */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-[#1B4998]" />
            <CardTitle>Role-Based Security Policies</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 text-xs text-slate-600 leading-relaxed">
          <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
            <strong className="text-slate-900 block mb-0.5">Sole Active HOD Guard</strong>
            The system strictly prohibits deactivating the last active Head of Department account. An administrative account must always exist to prevent lockout.
          </div>
          <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
            <strong className="text-slate-900 block mb-0.5">Server-Side Enforcement</strong>
            Supabase Row Level Security (RLS) policies enforce that non-HOD users cannot execute updates or inserts on the <code>profiles</code> table, regardless of client-side requests.
          </div>
        </CardContent>
      </Card>

      {/* Authorize Staff Modal */}
      <Modal
        isOpen={isInviteModalOpen}
        onClose={() => setIsInviteModalOpen(false)}
        title="Authorize New Laboratory Staff Member"
        description="Provision staff account with role-based laboratory permissions"
      >
        <form onSubmit={handleInviteSubmit} className="space-y-4">
          {formError && (
            <Alert variant="danger" title="Authorization Error">
              {formError}
            </Alert>
          )}

          <Input
            label="Staff Full Name"
            placeholder="e.g. Dr. K. Meenakshi"
            value={formData.full_name}
            onChange={e => setFormData({ ...formData, full_name: e.target.value })}
            required
          />

          <Input
            label="University Email Address"
            type="email"
            placeholder="name@klu.ac.in"
            value={formData.email}
            onChange={e => setFormData({ ...formData, email: e.target.value })}
            required
          />

          <Select
            label="Assigned System Role"
            value={formData.role}
            onChange={e => setFormData({ ...formData, role: e.target.value as StaffRole })}
          >
            <option value="lab_incharge">Lab In-Charge (Circulation & Scans)</option>
            <option value="HOD">Head of Department (Full Administrative Access)</option>
          </Select>

          <Input
            label="Initial Temporary Password"
            type="password"
            placeholder="Minimum 8 characters"
            value={formData.password}
            onChange={e => setFormData({ ...formData, password: e.target.value })}
            required
          />

          <div className="pt-2 flex justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsInviteModalOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" isLoading={isSubmitting}>
              Authorize & Create Account
            </Button>
          </div>
        </form>
      </Modal>
    </AppLayout>
  );
}
