'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Fingerprint,
  CheckCircle2,
  AlertCircle,
  Clock,
  ArrowRight,
  ShieldCheck,
  User,
  Activity,
  PackagePlus,
  RefreshCw,
  AlertTriangle,
  History,
  Sparkles
} from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge, StatusBadge } from '@/components/ui/Badge';
import { useAuth } from '@/context/AuthContext';
import { useData } from '@/context/DataContext';
import { ScanEvent, Student } from '@/types';
import { formatDate } from '@/lib/utils';

export default function ScanStudentPage() {
  const router = useRouter();
  const { currentUser, isHOD } = useAuth();
  const { scans, students, transactions, deviceTelemetry, simulateHardwareScan, refreshAll } = useData();

  const [latestScan, setLatestScan] = useState<ScanEvent | null>(null);
  const [matchedStudent, setMatchedStudent] = useState<Student | null>(null);
  const [isSimulating, setIsSimulating] = useState(false);
  const [simTemplateId, setSimTemplateId] = useState(1);
  const [pollingActive, setPollingActive] = useState(true);

  // Sync with recent scans from context
  useEffect(() => {
    if (scans && scans.length > 0) {
      const topScan = scans[0];
      setLatestScan(topScan);

      if (topScan.student_id) {
        const found = students.find(s => s.id === topScan.student_id);
        setMatchedStudent(found || (topScan.student as Student) || null);
      } else if (topScan.status === 'matched') {
        const found = students.find(s => s.template_id === topScan.template_id);
        setMatchedStudent(found || null);
      } else {
        setMatchedStudent(null);
      }
    }
  }, [scans, students]);

  // Check if student has outstanding equipment
  const activeStudentLoans = matchedStudent
    ? transactions.filter(t => t.student_id === matchedStudent.id && t.status === 'active')
    : [];

  const hasOverdueLoans = activeStudentLoans.some(t => new Date(t.due_at) < new Date());

  const handleTestScan = async (tid: number) => {
    setIsSimulating(true);
    await simulateHardwareScan(tid, true);
    await refreshAll();
    setIsSimulating(false);
  };

  return (
    <AppLayout title="Student Biometric Verification">
      <div className="space-y-6 max-w-5xl mx-auto">
        {/* Header with Live Status Indicator */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-xl bg-[#1B4998]/10 text-[#1B4998]">
                <Fingerprint className="w-6 h-6" />
              </span>
              <div>
                <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                  Scan Student Fingerprint
                </h1>
                <p className="text-sm text-slate-500">
                  Primary terminal for verifying student identity prior to equipment issue.
                </p>
              </div>
            </div>
          </div>

          {/* Device Telemetry Pill */}
          <div className="flex items-center gap-3">
            <div
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold border ${
                deviceTelemetry.online
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  : 'bg-amber-50 text-amber-800 border-amber-200'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  deviceTelemetry.online ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
                }`}
              />
              <span>
                {deviceTelemetry.online
                  ? `Sensor Ready (${deviceTelemetry.deviceId})`
                  : 'Hardware Awaiting Connection'}
              </span>
            </div>
          </div>
        </div>

        {/* Central Scan Detection Stage */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Visual Scanner Stage */}
          <div className="lg:col-span-5 flex flex-col gap-4">
            <Card className="border-slate-200 shadow-sm relative overflow-hidden bg-gradient-to-b from-white to-slate-50/50">
              <CardContent className="p-8 text-center flex flex-col items-center justify-center min-h-[340px]">
                {/* Fingerprint Scanning Pulse Graphic */}
                <div className="relative mb-6">
                  <div
                    className={`w-32 h-32 rounded-full flex items-center justify-center transition-all duration-500 ${
                      matchedStudent
                        ? 'bg-emerald-50 border-4 border-emerald-400 text-emerald-600 shadow-lg shadow-emerald-500/10'
                        : latestScan?.status === 'not_found'
                        ? 'bg-rose-50 border-4 border-rose-400 text-rose-600 shadow-lg shadow-rose-500/10'
                        : 'bg-[#1B4998]/5 border-4 border-[#1B4998]/20 text-[#1B4998]'
                    }`}
                  >
                    <Fingerprint
                      className={`w-16 h-16 transition-transform duration-500 ${
                        matchedStudent
                          ? 'scale-110'
                          : latestScan?.status === 'not_found'
                          ? 'animate-bounce'
                          : 'animate-pulse'
                      }`}
                    />
                  </div>

                  {/* Pulsing ring animation */}
                  <span
                    className={`absolute inset-0 rounded-full border-2 animate-ping opacity-25 pointer-events-none ${
                      matchedStudent
                        ? 'border-emerald-500'
                        : latestScan?.status === 'not_found'
                        ? 'border-rose-500'
                        : 'border-[#1B4998]'
                    }`}
                  />
                </div>

                {matchedStudent ? (
                  <div className="space-y-1">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      Fingerprint Verified
                    </span>
                    <p className="text-xs text-slate-500 mt-2">
                      Template #{latestScan?.template_id} • Device {latestScan?.device_id || 'esp32-lab-01'}
                    </p>
                  </div>
                ) : latestScan?.status === 'not_found' ? (
                  <div className="space-y-1">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800">
                      <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
                      No Matching Student
                    </span>
                    <p className="text-xs text-slate-500 mt-2">
                      Sensor slot #{latestScan.template_id} not mapped to any registered student.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <h3 className="text-base font-bold text-slate-800">Awaiting Fingerprint...</h3>
                    <p className="text-xs text-slate-500 max-w-xs">
                      Ask the student to place their registered finger firmly onto the optical sensor prism.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Test Simulation Panel for HOD / Staff Demo */}
            <Card className="border-slate-200 shadow-xs bg-slate-50/60">
              <CardHeader className="py-3 px-4 border-b border-slate-200">
                <CardTitle className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center justify-between">
                  <span>Hardware Simulator</span>
                  <span className="text-[10px] font-normal text-slate-400">For lab testing</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-3">
                <p className="text-xs text-slate-500">
                  Select a template slot to trigger an authenticated simulated scan event:
                </p>
                <div className="flex items-center gap-2">
                  <select
                    value={simTemplateId}
                    onChange={e => setSimTemplateId(Number(e.target.value))}
                    className="flex-1 px-3 py-1.5 text-xs border border-slate-300 rounded-lg bg-white"
                  >
                    <option value={1}>Slot #1 - Seed Student 1</option>
                    <option value={2}>Slot #2 - Seed Student 2</option>
                    <option value={3}>Slot #3 - Seed Student 3</option>
                    <option value={4}>Slot #4 - Seed Student 4</option>
                    <option value={99}>Slot #99 - Unregistered Finger</option>
                  </select>
                  <Button
                    size="sm"
                    onClick={() => handleTestScan(simTemplateId)}
                    disabled={isSimulating}
                    className="bg-[#1B4998] text-white text-xs whitespace-nowrap"
                  >
                    {isSimulating ? <RefreshCw className="w-3 h-3 animate-spin mr-1" /> : <Sparkles className="w-3 h-3 mr-1" />}
                    Simulate
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column: Verified Student Card & Issue Flow */}
          <div className="lg:col-span-7">
            {matchedStudent ? (
              <Card className="border-emerald-200 shadow-md bg-white">
                <CardHeader className="bg-emerald-50/60 border-b border-emerald-100 py-4 px-6 flex flex-row items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-emerald-600" />
                    <CardTitle className="text-base font-bold text-emerald-950">
                      Verified Student Identity
                    </CardTitle>
                  </div>
                  <span className="text-xs font-mono bg-white px-2.5 py-1 rounded-md border border-emerald-200 text-emerald-800 font-semibold">
                    Template #{latestScan?.template_id}
                  </span>
                </CardHeader>

                <CardContent className="p-6 space-y-6">
                  {/* Identity Row */}
                  <div className="flex items-start gap-4">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-[#1B4998] to-blue-500 text-white flex items-center justify-center font-bold text-xl shadow-md shrink-0">
                      {matchedStudent.full_name.charAt(0)}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <h2 className="text-xl font-bold text-slate-900">
                          {matchedStudent.full_name}
                        </h2>
                        <Badge variant={matchedStudent.active ? 'success' : 'danger'}>
                          {matchedStudent.active ? 'Active Enrolled' : 'Suspended'}
                        </Badge>
                      </div>
                      <p className="font-mono text-sm font-semibold text-[#1B4998] mt-0.5">
                        {matchedStudent.reg_number}
                      </p>
                      <p className="text-xs text-slate-500 mt-1">
                        Department of {matchedStudent.department} • Section {matchedStudent.section} • Year {matchedStudent.year}
                      </p>
                    </div>
                  </div>

                  {/* Loan & Borrowing Status */}
                  <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-600 uppercase tracking-wider">
                        Current Equipment Holdings:
                      </span>
                      <span className="font-bold text-slate-800">
                        {activeStudentLoans.length} item(s) on loan
                      </span>
                    </div>

                    {hasOverdueLoans && (
                      <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800 flex items-center gap-2 mt-2">
                        <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                        <span>
                          <strong>Attention:</strong> This student currently holds overdue equipment. Please ensure previous equipment is returned before issuing additional items.
                        </span>
                      </div>
                    )}

                    {activeStudentLoans.length > 0 && (
                      <div className="divide-y divide-slate-200 mt-2">
                        {activeStudentLoans.map(loan => (
                          <div key={loan.id} className="py-2 flex items-center justify-between text-xs">
                            <span className="font-medium text-slate-800">
                              {loan.equipment?.name} ({loan.equipment?.asset_id})
                            </span>
                            <span className={new Date(loan.due_at) < new Date() ? 'text-rose-600 font-bold' : 'text-slate-500'}>
                              Due: {formatDate(loan.due_at)}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Primary CTA: Proceed to Issue */}
                  <div className="pt-2 flex flex-col sm:flex-row items-center gap-3">
                    <Button
                      onClick={() => router.push(`/issue?studentId=${matchedStudent.id}`)}
                      className="w-full sm:flex-1 bg-[#1B4998] hover:bg-[#143775] text-white py-2.5 font-bold shadow-md flex items-center justify-center gap-2"
                    >
                      <PackagePlus className="w-4 h-4" />
                      Proceed to Issue Equipment
                      <ArrowRight className="w-4 h-4" />
                    </Button>

                    <Button
                      variant="outline"
                      onClick={() => {
                        setMatchedStudent(null);
                        setLatestScan(null);
                      }}
                      className="w-full sm:w-auto text-xs"
                    >
                      Scan Next Student
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              /* Awaiting Scan Placeholder State */
              <Card className="border-dashed border-2 border-slate-300 shadow-none bg-slate-50/50">
                <CardContent className="p-12 text-center flex flex-col items-center justify-center min-h-[380px]">
                  <div className="w-16 h-16 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mb-4">
                    <User className="w-8 h-8" />
                  </div>
                  <h3 className="text-base font-bold text-slate-800">
                    No Verified Student Present
                  </h3>
                  <p className="text-sm text-slate-500 max-w-md mt-1 mb-6">
                    When a student presses their finger on the lab scanner, their verified profile, academic credentials, and loan history will appear here instantly for staff verification.
                  </p>
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <Activity className="w-3.5 h-3.5 animate-pulse text-[#1B4998]" />
                    <span>Listening for realtime sensor events on WebSocket...</span>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {/* Recent Scan History Bar */}
        <Card className="border-slate-200 shadow-xs">
          <CardHeader className="py-3 px-6 border-b border-slate-200 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <History className="w-4 h-4 text-slate-500" />
              Recent Scan Stream
            </CardTitle>
            <Link
              href="/scans"
              className="text-xs font-semibold text-[#1B4998] hover:underline"
            >
              View Full Audit Log →
            </Link>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-slate-100">
              {scans.slice(0, 5).map(scan => (
                <div key={scan.id} className="p-3.5 px-6 flex items-center justify-between hover:bg-slate-50/60 transition-colors">
                  <div className="flex items-center gap-3">
                    <span className={`w-2 h-2 rounded-full ${scan.status === 'matched' ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                    <div>
                      <div className="text-sm font-semibold text-slate-800">
                        {scan.student?.full_name || (scan.status === 'matched' ? `Template #${scan.template_id}` : 'Unrecognized Fingerprint')}
                      </div>
                      <div className="text-xs text-slate-500 font-mono">
                        {scan.student?.reg_number || `Slot #${scan.template_id}`} • Device: {scan.device_id}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <StatusBadge status={scan.status} />
                    <div className="text-[11px] text-slate-400 mt-1">
                      {new Date(scan.created_at).toLocaleTimeString()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
