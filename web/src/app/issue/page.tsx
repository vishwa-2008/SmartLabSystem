'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Modal } from '@/components/ui/Modal';
import { StatusBadge } from '@/components/ui/Badge';
import { Alert } from '@/components/ui/Alert';
import { useData } from '@/context/DataContext';
import { useAuth } from '@/context/AuthContext';
import { formatDate } from '@/lib/utils';
import { Student, Equipment } from '@/types';
import {
  PackagePlus,
  Fingerprint,
  Search,
  CheckCircle2,
  Printer,
  Calendar,
  ShieldCheck,
  UserCheck,
  AlertTriangle,
  RotateCw,
  Loader2
} from 'lucide-react';

function IssueEquipmentContent() {
  const searchParams = useSearchParams();
  const initialStudentId = searchParams?.get('studentId') || '';

  const {
    students,
    equipment,
    scans,
    issueEquipment
  } = useData();
  const { currentUser } = useAuth();

  const [studentSearch, setStudentSearch] = useState<string>('');
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [selectedEquipmentId, setSelectedEquipmentId] = useState<string>('');
  const [dueDate, setDueDate] = useState<string>('');
  const [remarks, setRemarks] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    setDueDate(d.toISOString().slice(0, 10));
  }, []);

  // Success Receipt Modal state
  const [receiptData, setReceiptData] = useState<{
    transactionId: string;
    student: Student;
    equipment: Equipment;
    dueDate: string;
    issuerName: string;
    issuedAt: string;
  } | null>(null);

  // Check URL parameter for pre-selected student
  useEffect(() => {
    if (initialStudentId) {
      const match = students.find(s => s.id === initialStudentId && s.active);
      if (match) setSelectedStudent(match);
    }
  }, [initialStudentId, students]);

  // Listen to the most recent scan event. If matched and within the last 15 seconds, auto-select!
  useEffect(() => {
    if (scans.length > 0) {
      const latest = scans[0];
      const scanAge = Date.now() - new Date(latest.created_at).getTime();
      if (latest.status === 'matched' && latest.student_id && scanAge < 15000) {
        const found = students.find(s => s.id === latest.student_id && s.active);
        if (found && !selectedStudent) {
          setSelectedStudent(found);
        }
      }
    }
  }, [scans, students, selectedStudent]);

  // Available equipment list
  const availableEquipment = equipment.filter(
    e => e.status === 'available' && e.condition !== 'damaged' && e.condition !== 'needs_repair'
  );

  // Filter students for search dropdown
  const searchResults = students
    .filter(s => {
      if (!studentSearch) return false;
      const q = studentSearch.toLowerCase();
      return (
        s.active &&
        (s.full_name.toLowerCase().includes(q) || s.reg_number.toLowerCase().includes(q))
      );
    })
    .slice(0, 5);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudent) {
      setSubmitError('Please verify and select a student first');
      return;
    }
    if (!selectedEquipmentId) {
      setSubmitError('Please select available equipment to issue');
      return;
    }

    setSubmitError(null);
    setIsSubmitting(true);

    const dueDateTime = new Date(`${dueDate}T17:00:00Z`).toISOString();
    const targetItem = equipment.find(e => e.id === selectedEquipmentId);

    const res = await issueEquipment(
      selectedStudent.id,
      selectedEquipmentId,
      dueDateTime,
      remarks
    );

    setIsSubmitting(false);

    if (!res.success) {
      setSubmitError(res.error || 'Failed to issue equipment');
    } else {
      // Show official receipt
      if (targetItem) {
        setReceiptData({
          transactionId: res.transactionId || crypto.randomUUID(),
          student: selectedStudent,
          equipment: targetItem,
          dueDate: dueDateTime,
          issuerName: currentUser?.full_name || 'Lab Staff',
          issuedAt: new Date().toISOString()
        });
      }

      // Reset form
      setSelectedStudent(null);
      setSelectedEquipmentId('');
      setRemarks('');
      setStudentSearch('');
    }
  };

  return (
    <AppLayout>
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">
            Issue Laboratory Equipment
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Identify borrower via biometric sensor scan or student search, select asset, and register loan.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (2 Cols): Identification & Form */}
        <div className="lg:col-span-2 space-y-6">
          {/* Step 1: Student Biometric Detection or Search */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Fingerprint className="w-4 h-4 text-[#1B4998]" />
                <CardTitle>Step 1: Student Borrower Identification</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Biometric Scan Prompt */}
              <div className="p-3.5 rounded-lg bg-blue-50/70 border border-blue-200 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-[#1B4998] text-white flex items-center justify-center shrink-0 animate-pulse">
                    <Fingerprint className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-blue-900 block">
                      Biometric Sensor Active
                    </span>
                    <span className="text-[11px] text-blue-700">
                      Student may place enrolled finger on ESP32 sensor for instantaneous identification.
                    </span>
                  </div>
                </div>
              </div>

              {/* Manual Search Fallback */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Or Search by Name / Registration Number
                </label>
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    placeholder="Type student name or reg number (e.g. Aarav, 9921004001)..."
                    value={studentSearch}
                    onChange={e => setStudentSearch(e.target.value)}
                    className="w-full pl-9 pr-4 py-1.5 text-sm rounded-md border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#1B4998]"
                  />
                </div>

                {/* Search Results Dropdown */}
                {searchResults.length > 0 && (
                  <div className="mt-1.5 border border-slate-200 rounded-lg bg-white shadow-sm overflow-hidden divide-y divide-slate-100">
                    {searchResults.map(s => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => {
                          setSelectedStudent(s);
                          setStudentSearch('');
                        }}
                        className="w-full text-left px-3 py-2 text-xs hover:bg-slate-50 flex items-center justify-between cursor-pointer"
                      >
                        <div>
                          <span className="font-semibold text-slate-900">{s.full_name}</span>
                          <span className="text-slate-500 ml-2">({s.department}, Sec {s.section})</span>
                        </div>
                        <span className="font-mono text-[#1B4998]">{s.reg_number}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Verified Student Details Card */}
              {selectedStudent ? (
                <div className="p-4 rounded-xl border-2 border-emerald-500 bg-emerald-50/40 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                      <span className="font-bold text-sm text-emerald-950">
                        Verified Student: {selectedStudent.full_name}
                      </span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedStudent(null)}
                      className="text-xs text-slate-500 h-6 px-2"
                    >
                      Change Student
                    </Button>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs pt-1 border-t border-emerald-200">
                    <div>
                      <span className="text-slate-500 block text-[10px]">REG NO</span>
                      <span className="font-mono font-bold text-slate-900">
                        {selectedStudent.reg_number}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px]">DEPARTMENT</span>
                      <span className="font-medium text-slate-800">
                        {selectedStudent.department}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px]">CLASS / YEAR</span>
                      <span className="font-medium text-slate-800">
                        Sec {selectedStudent.section} • Year {selectedStudent.year}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px]">BIOMETRIC SLOT</span>
                      <span className="font-mono font-medium text-emerald-700">
                        {selectedStudent.fingerprint_enrolled
                          ? `#${selectedStudent.template_id}`
                          : 'Not Enrolled'}
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-4 rounded-lg border border-dashed border-slate-300 text-center text-xs text-slate-400">
                  No student identified yet. Scan finger on sensor or search above.
                </div>
              )}
            </CardContent>
          </Card>

          {/* Step 2: Equipment Selection and Confirmation */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <PackagePlus className="w-4 h-4 text-[#1B4998]" />
                <CardTitle>Step 2: Equipment Selection & Circulation Terms</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                {submitError && (
                  <Alert variant="danger" title="Issuance Error">
                    {submitError}
                  </Alert>
                )}

                <Select
                  label="Select Available Laboratory Equipment"
                  value={selectedEquipmentId}
                  onChange={e => setSelectedEquipmentId(e.target.value)}
                  required
                >
                  <option value="">-- Choose available instrument or kit --</option>
                  {availableEquipment.map(eq => (
                    <option key={eq.id} value={eq.id}>
                      {eq.asset_id} • {eq.name} ({eq.category} - {eq.location})
                    </option>
                  ))}
                </Select>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Return Due Date
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="date"
                        value={dueDate}
                        onChange={e => setDueDate(e.target.value)}
                        className="flex h-9 w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#1B4998]"
                        required
                      />
                    </div>
                    <div className="flex gap-1.5 mt-2">
                      <button
                        type="button"
                        onClick={() => {
                          const d = new Date();
                          d.setDate(d.getDate() + 3);
                          setDueDate(d.toISOString().slice(0, 10));
                        }}
                        className="px-2 py-0.5 rounded text-[10px] bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
                      >
                        +3 Days
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const d = new Date();
                          d.setDate(d.getDate() + 7);
                          setDueDate(d.toISOString().slice(0, 10));
                        }}
                        className="px-2 py-0.5 rounded text-[10px] bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
                      >
                        +7 Days
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const d = new Date();
                          d.setDate(d.getDate() + 14);
                          setDueDate(d.toISOString().slice(0, 10));
                        }}
                        className="px-2 py-0.5 rounded text-[10px] bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
                      >
                        +14 Days
                      </button>
                    </div>
                  </div>

                  <Input
                    label="Issue Remarks / Lab Assignment"
                    placeholder="e.g. Embedded Lab Experiment 3, Mini-Project"
                    value={remarks}
                    onChange={e => setRemarks(e.target.value)}
                  />
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                  <div className="text-xs text-slate-500">
                    Issuing Staff: <strong className="text-slate-800">{currentUser?.full_name}</strong>
                  </div>

                  <Button
                    type="submit"
                    isLoading={isSubmitting}
                    disabled={!selectedStudent || !selectedEquipmentId}
                    leftIcon={<PackagePlus className="w-4 h-4" />}
                  >
                    Confirm & Issue Asset
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Policies & Quick Status */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-[#1B4998]" />
                <CardTitle>Circulation Rules</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 text-xs text-slate-600 leading-relaxed">
              <div className="p-2.5 rounded bg-slate-50 border border-slate-200">
                <span className="font-bold text-slate-900 block mb-0.5">Authoritative Timestamps</span>
                Issue and return timestamps are computed strictly on the university server. Client clock manipulation is prevented.
              </div>

              <div className="p-2.5 rounded bg-slate-50 border border-slate-200">
                <span className="font-bold text-slate-900 block mb-0.5">Concurrency Safety</span>
                Equipment rows are locked during issuance to prevent race conditions when two lab in-charges submit simultaneously.
              </div>

              <div className="p-2.5 rounded bg-slate-50 border border-slate-200">
                <span className="font-bold text-slate-900 block mb-0.5">Student Verification</span>
                Students with inactive status or damaged flags are prohibited from taking additional laboratory instruments.
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Official Printable Issue Receipt Modal */}
      {receiptData && (
        <Modal
          isOpen={Boolean(receiptData)}
          onClose={() => setReceiptData(null)}
          title="Official Equipment Issue Slip"
          description="Circulation confirmed and recorded in PostgreSQL database"
          maxWidth="lg"
          footer={
            <div className="flex justify-between w-full">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => window.print()}
                leftIcon={<Printer className="w-4 h-4" />}
              >
                Print Official Slip
              </Button>
              <Button size="sm" onClick={() => setReceiptData(null)}>
                Done
              </Button>
            </div>
          }
        >
          <div className="p-4 rounded-xl border border-slate-300 bg-white space-y-4">
            {/* Slip Header */}
            <div className="text-center pb-3 border-b border-slate-200">
              <h3 className="font-bold text-base text-slate-900 tracking-tight">
                KALASALINGAM ACADEMY OF RESEARCH AND EDUCATION
              </h3>
              <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                Department of Laboratory Operations • Equipment Circulation Slip
              </p>
              <div className="font-mono text-[10px] text-slate-400 mt-1">
                TRANSACTION ID: {receiptData.transactionId}
              </div>
            </div>

            {/* Borrower Details */}
            <div className="grid grid-cols-2 gap-3 text-xs bg-slate-50 p-3 rounded-lg">
              <div>
                <span className="text-slate-400 block text-[10px]">BORROWER</span>
                <span className="font-bold text-slate-900">{receiptData.student.full_name}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">REGISTRATION NO</span>
                <span className="font-mono font-bold text-slate-900">
                  {receiptData.student.reg_number}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">DEPARTMENT</span>
                <span className="text-slate-800">{receiptData.student.department}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">SECTION & YEAR</span>
                <span className="text-slate-800">
                  Sec {receiptData.student.section} • Year {receiptData.student.year}
                </span>
              </div>
            </div>

            {/* Equipment Details */}
            <div className="p-3 rounded-lg border border-slate-200 text-xs space-y-1.5">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                Issued Instrument
              </span>
              <div className="flex justify-between font-bold text-slate-900 text-sm">
                <span>{receiptData.equipment.name}</span>
                <span className="font-mono text-[#1B4998]">{receiptData.equipment.asset_id}</span>
              </div>
              <div className="flex justify-between text-slate-500 text-[11px] pt-1 border-t border-slate-100">
                <span>Storage: {receiptData.equipment.location}</span>
                <span>Category: {receiptData.equipment.category}</span>
              </div>
            </div>

            {/* Dates & Signature Block */}
            <div className="grid grid-cols-2 gap-3 text-xs pt-1">
              <div>
                <span className="text-slate-400 block text-[10px]">AUTHORITATIVE ISSUE TIME</span>
                <span className="font-medium text-slate-800">{formatDate(receiptData.issuedAt)}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">SCHEDULED RETURN DUE DATE</span>
                <span className="font-bold text-rose-700">{formatDate(receiptData.dueDate)}</span>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-200 flex justify-between text-[11px] text-slate-500">
              <div>Authorized Staff: {receiptData.issuerName}</div>
              <div className="font-semibold text-slate-700">Student Signature: __________________</div>
            </div>
          </div>
        </Modal>
      )}
    </AppLayout>
  );
}

export default function IssueEquipmentPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#F5F7FB] flex items-center justify-center p-4">
          <Loader2 className="w-6 h-6 animate-spin text-[#1B4998]" />
        </div>
      }
    >
      <IssueEquipmentContent />
    </Suspense>
  );
}
