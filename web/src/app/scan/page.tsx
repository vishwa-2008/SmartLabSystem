'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  Sparkles,
  Volume2
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
  const [autoNavCountdown, setAutoNavCountdown] = useState<number | null>(null);
  const [scanNotification, setScanNotification] = useState<string | null>(null);
  const lastProcessedScanRef = useRef<string | null>(null);
  const autoNavTimerRef = useRef<NodeJS.Timeout | null>(null);
  const countdownTimerRef = useRef<NodeJS.Timeout | null>(null);

  // ─── CORE: Student matching logic ──────────────────────────────────
  const findStudentForScan = useCallback((scan: ScanEvent): Student | null => {
    if (!scan) return null;

    // Strategy 1: Use student_id from scan event (server already matched)
    if (scan.student_id) {
      const found = students.find(s => s.id === scan.student_id);
      if (found) return found;
    }

    // Strategy 2: Use embedded student object from scan event
    if (scan.student && scan.student.id) {
      const found = students.find(s => s.id === scan.student.id);
      if (found) return found;
    }

    // Strategy 3: Match by template_id in local students list
    // This is the KEY fix — even if server returns "not_found" because
    // fingerprint_templates row is missing, we can still match locally
    // if the student has template_id set via manual slot mapping
    if (scan.template_id && scan.template_id > 0) {
      const found = students.find(
        s => s.template_id === scan.template_id && s.active
      );
      if (found) return found;
    }

    return null;
  }, [students]);

  // ─── SYNC: Process new scans from context ─────────────────────────
  useEffect(() => {
    if (!scans || scans.length === 0) return;

    const topScan = scans[0];
    // Only process if this is a genuinely new scan we haven't seen
    if (topScan.id === lastProcessedScanRef.current) return;

    lastProcessedScanRef.current = topScan.id;
    setLatestScan(topScan);

    const student = findStudentForScan(topScan);
    setMatchedStudent(student);

    // Clear any existing auto-nav
    if (autoNavTimerRef.current) clearTimeout(autoNavTimerRef.current);
    if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    setAutoNavCountdown(null);

    if (student) {
      // Show notification
      setScanNotification(`✅ Student verified: ${student.full_name} (${student.reg_number})`);

      // Auto-navigate to issue page after 5 seconds
      let countdown = 5;
      setAutoNavCountdown(countdown);
      countdownTimerRef.current = setInterval(() => {
        countdown--;
        setAutoNavCountdown(countdown);
        if (countdown <= 0) {
          if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
        }
      }, 1000);

      autoNavTimerRef.current = setTimeout(() => {
        router.push(`/issue?studentId=${student.id}`);
      }, 5000);
    } else if (topScan.template_id && topScan.template_id > 0) {
      setScanNotification(`⚠️ Fingerprint Slot #${topScan.template_id} detected but not linked to any student. Please map the slot in Students page.`);
    } else {
      setScanNotification(null);
    }
  }, [scans, findStudentForScan, router]);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (autoNavTimerRef.current) clearTimeout(autoNavTimerRef.current);
      if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    };
  }, []);

  // Check if student has outstanding equipment
  const activeStudentLoans = matchedStudent
    ? transactions.filter(t => t.student_id === matchedStudent.id && t.status === 'active')
    : [];

  const hasOverdueLoans = activeStudentLoans.some(t => new Date(t.due_at) < new Date());

  const cancelAutoNav = () => {
    if (autoNavTimerRef.current) clearTimeout(autoNavTimerRef.current);
    if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    setAutoNavCountdown(null);
  };

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

        {/* Scan Notification Banner */}
        {scanNotification && (
          <div className={`p-3 rounded-lg border text-sm font-medium flex items-center gap-3 animate-in fade-in slide-in-from-top-2 duration-300 ${
            matchedStudent
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-amber-50 border-amber-200 text-amber-900'
          }`}>
            <Volume2 className="w-4 h-4 shrink-0" />
            <span className="flex-1">{scanNotification}</span>
            {autoNavCountdown !== null && autoNavCountdown > 0 && (
              <span className="text-xs font-mono bg-white px-2 py-0.5 rounded border border-emerald-200 text-emerald-700">
                Auto-redirect in {autoNavCountdown}s
              </span>
            )}
            <button
              onClick={() => { setScanNotification(null); cancelAutoNav(); }}
              className="text-xs hover:underline opacity-70"
            >
              Dismiss
            </button>
          </div>
        )}

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
                    <p className="text-sm font-bold text-emerald-800 mt-1">
                      {matchedStudent.full_name}
                    </p>
                  </div>
                ) : latestScan && !matchedStudent && latestScan.template_id && latestScan.template_id > 0 ? (
                  <div className="space-y-1">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800">
                      <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
                      Fingerprint Not Linked
                    </span>
                    <p className="text-xs text-slate-500 mt-2">
                      Sensor slot #{latestScan.template_id} detected but not mapped to any student.
                    </p>
                    <Link
                      href="/students"
                      className="text-xs text-[#1B4998] hover:underline font-semibold mt-1 inline-block"
                    >
                      Go to Students → Map Fingerprint Slot
                    </Link>
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

                  {/* Auto-Navigate Countdown Banner */}
                  {autoNavCountdown !== null && autoNavCountdown > 0 && (
                    <div className="p-3 rounded-lg bg-blue-50 border border-blue-200 text-xs text-blue-900 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <ArrowRight className="w-4 h-4 text-blue-600 animate-pulse" />
                        <span>
                          Redirecting to <strong>Issue Equipment</strong> page in <strong>{autoNavCountdown}</strong> seconds...
                        </span>
                      </div>
                      <button
                        onClick={cancelAutoNav}
                        className="text-blue-700 hover:underline font-semibold"
                      >
                        Stay Here
                      </button>
                    </div>
                  )}

                  {/* Primary CTA: Proceed to Issue */}
                  <div className="pt-2 flex flex-col sm:flex-row items-center gap-3">
                    <Button
                      onClick={() => {
                        cancelAutoNav();
                        router.push(`/issue?studentId=${matchedStudent.id}`);
                      }}
                      className="w-full sm:flex-1 bg-[#1B4998] hover:bg-[#143775] text-white py-2.5 font-bold shadow-md flex items-center justify-center gap-2"
                    >
                      <PackagePlus className="w-4 h-4" />
                      Proceed to Issue Equipment
                      {autoNavCountdown !== null && autoNavCountdown > 0 && (
                        <span className="ml-1 text-xs opacity-80">({autoNavCountdown}s)</span>
                      )}
                      <ArrowRight className="w-4 h-4" />
                    </Button>

                    <Button
                      variant="outline"
                      onClick={() => {
                        cancelAutoNav();
                        setMatchedStudent(null);
                        setLatestScan(null);
                        setScanNotification(null);
                        lastProcessedScanRef.current = null;
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
                    {latestScan && !matchedStudent && latestScan.template_id && latestScan.template_id > 0
                      ? 'Fingerprint Slot Not Mapped'
                      : 'No Verified Student Present'}
                  </h3>
                  <p className="text-sm text-slate-500 max-w-md mt-1 mb-4">
                    {latestScan && !matchedStudent && latestScan.template_id && latestScan.template_id > 0
                      ? `Sensor detected Slot #${latestScan.template_id} but this slot is not linked to any registered student in the database. Use the Students page to map fingerprint slots.`
                      : 'When a student presses their finger on the lab scanner, their verified profile, academic credentials, and loan history will appear here instantly for staff verification.'}
                  </p>
                  {latestScan && !matchedStudent && latestScan.template_id && latestScan.template_id > 0 ? (
                    <Link
                      href="/students"
                      className="inline-flex items-center gap-2 px-4 py-2 bg-[#1B4998] text-white text-xs font-semibold rounded-lg hover:bg-[#143775] transition-colors mb-4"
                    >
                      <Fingerprint className="w-3.5 h-3.5" />
                      Go to Students → Map Slot #{latestScan.template_id}
                    </Link>
                  ) : null}
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
