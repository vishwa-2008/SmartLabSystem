'use client';

import React, { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Alert } from '@/components/ui/Alert';
import { useAuth } from '@/context/AuthContext';
import { Settings, ShieldCheck, CheckCircle2, User, Building } from 'lucide-react';

export default function SettingsPage() {
  const { currentUser } = useAuth();

  const [labName, setLabName] = useState<string>('IoT & Embedded Systems Laboratory');
  const [department, setDepartment] = useState<string>('Electronics and Communication Engineering');
  const [defaultLoanDays, setDefaultLoanDays] = useState<number>(7);
  const [autoOverdueAlerts, setAutoOverdueAlerts] = useState<boolean>(true);
  const [savedSuccess, setSavedSuccess] = useState<boolean>(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  return (
    <AppLayout>
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">
            Laboratory Portal Settings
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Institutional laboratory configuration, circulation parameters, and profile details.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (2 Cols): Lab Config */}
        <div className="lg:col-span-2 space-y-6">
          {savedSuccess && (
            <Alert variant="success" title="Settings Updated">
              Laboratory circulation policies and preferences have been successfully updated.
            </Alert>
          )}

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Building className="w-4 h-4 text-[#1B4998]" />
                <CardTitle>Laboratory Profile & Operating Parameters</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSave} className="space-y-4">
                <Input
                  label="Institution"
                  value="Kalasalingam Academy of Research and Education (KARE)"
                  disabled
                />

                <Input
                  label="Laboratory Facility Name"
                  value={labName}
                  onChange={e => setLabName(e.target.value)}
                  required
                />

                <Input
                  label="Academic Department"
                  value={department}
                  onChange={e => setDepartment(e.target.value)}
                  required
                />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Input
                    label="Default Loan Period (Days)"
                    type="number"
                    min={1}
                    max={60}
                    value={defaultLoanDays}
                    onChange={e => setDefaultLoanDays(Number(e.target.value))}
                    required
                  />

                  <Select
                    label="Overdue Alert Frequency"
                    value={autoOverdueAlerts ? 'enabled' : 'disabled'}
                    onChange={e => setAutoOverdueAlerts(e.target.value === 'enabled')}
                  >
                    <option value="enabled">Active (Daily Summary Alerts)</option>
                    <option value="disabled">Muted</option>
                  </Select>
                </div>

                <div className="pt-3 border-t border-slate-100 flex justify-end">
                  <Button type="submit">Save Laboratory Configuration</Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: User Profile Details */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-[#1B4998]" />
                <CardTitle>Staff Profile</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 text-xs">
              <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
                <div className="w-12 h-12 rounded-full bg-[#1B4998]/10 text-[#1B4998] flex items-center justify-center font-bold text-base shrink-0">
                  {currentUser?.full_name?.charAt(0) || 'U'}
                </div>
                <div>
                  <div className="font-bold text-sm text-slate-900">{currentUser?.full_name}</div>
                  <div className="text-slate-500 font-mono text-[11px]">{currentUser?.email}</div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between py-1">
                  <span className="text-slate-500">System Role</span>
                  <span className="font-semibold text-slate-900">
                    {currentUser?.role === 'HOD' ? 'Head of Department' : 'Lab In-Charge'}
                  </span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-slate-500">Access Status</span>
                  <span className="text-emerald-700 font-bold">Active & Verified</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-slate-500">Security Clearance</span>
                  <span className="text-slate-700">Level 2 (Circulation & Biometrics)</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
