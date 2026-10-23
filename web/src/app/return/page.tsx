'use client';

import React, { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { Input } from '@/components/ui/Input';
import { StatusBadge } from '@/components/ui/Badge';
import { Alert } from '@/components/ui/Alert';
import { useData } from '@/context/DataContext';
import { formatDate } from '@/lib/utils';
import { EquipmentCondition } from '@/types';
import {
  RotateCcw,
  Search,
  CheckCircle2,
  AlertTriangle,
  Cpu,
  UserCheck
} from 'lucide-react';

export default function ReturnEquipmentPage() {
  const {
    students,
    transactions,
    returnEquipment
  } = useData();

  const [studentSearch, setStudentSearch] = useState<string>('');
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  const [selectedTransactionId, setSelectedTransactionId] = useState<string>('');
  const [returnCondition, setReturnCondition] = useState<EquipmentCondition>('good');
  const [remarks, setRemarks] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Active or overdue transactions
  const activeTransactions = transactions.filter(
    t => t.status === 'active' || t.status === 'overdue'
  );

  // Students who currently have active loans
  const studentsWithLoans = students.filter(s =>
    activeTransactions.some(t => t.student_id === s.id)
  );

  // Filter students for search dropdown
  const filteredStudentsWithLoans = studentsWithLoans.filter(s => {
    if (!studentSearch) return true;
    const q = studentSearch.toLowerCase();
    return (
      s.full_name.toLowerCase().includes(q) || s.reg_number.toLowerCase().includes(q)
    );
  });

  // Active loans for the selected student
  const studentLoans = activeTransactions.filter(
    t => t.student_id === selectedStudentId
  );

  const handleReturnSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTransactionId) {
      setErrorMessage('Please select the equipment loan item being returned');
      return;
    }

    setErrorMessage(null);
    setSuccessMessage(null);
    setIsSubmitting(true);

    const res = await returnEquipment(selectedTransactionId, returnCondition, remarks);
    setIsSubmitting(false);

    if (!res.success) {
      setErrorMessage(res.error || 'Failed to process return');
    } else {
      setSuccessMessage(
        returnCondition === 'damaged' || returnCondition === 'needs_repair'
          ? 'Return processed. Instrument tagged as DAMAGED and quarantined for technician repair.'
          : 'Equipment successfully returned to available laboratory inventory.'
      );
      setSelectedTransactionId('');
      setRemarks('');
      setReturnCondition('good');
    }
  };

  return (
    <AppLayout>
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">
            Return Equipment & Technical Inspection
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Check-in borrowed laboratory assets, inspect hardware condition, and close loan records.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (2 Cols): Selection & Return Form */}
        <div className="lg:col-span-2 space-y-6">
          {successMessage && (
            <Alert variant="success" title="Return Confirmed">
              {successMessage}
            </Alert>
          )}

          {errorMessage && (
            <Alert variant="danger" title="Return Error">
              {errorMessage}
            </Alert>
          )}

          {/* Step 1: Select Student with Active Loans */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-[#1B4998]" />
                <CardTitle>Step 1: Select Student Borrower</CardTitle>
              </div>
              <span className="text-xs font-semibold text-slate-500">
                {studentsWithLoans.length} student(s) currently hold equipment
              </span>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Filter student by name or registration number..."
                  value={studentSearch}
                  onChange={e => setStudentSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-1.5 text-sm rounded-md border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#1B4998]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                {filteredStudentsWithLoans.length === 0 ? (
                  <div className="col-span-2 p-6 text-center text-xs text-slate-400 border border-dashed rounded-lg">
                    No active borrower matches the search query.
                  </div>
                ) : (
                  filteredStudentsWithLoans.map(student => {
                    const isSelected = selectedStudentId === student.id;
                    const loansCount = activeTransactions.filter(
                      t => t.student_id === student.id
                    ).length;

                    return (
                      <button
                        key={student.id}
                        type="button"
                        onClick={() => {
                          setSelectedStudentId(student.id);
                          setSelectedTransactionId('');
                          setSuccessMessage(null);
                        }}
                        className={`p-3 rounded-lg border text-left transition-all cursor-pointer flex flex-col justify-between ${
                          isSelected
                            ? 'border-[#1B4998] bg-blue-50/50 shadow-xs'
                            : 'border-slate-200 hover:border-slate-300 bg-white'
                        }`}
                      >
                        <div className="flex justify-between items-start">
                          <span className="font-semibold text-xs text-slate-900">
                            {student.full_name}
                          </span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-[#1B4998] font-bold">
                            {loansCount} item(s)
                          </span>
                        </div>
                        <div className="text-[11px] font-mono text-slate-500 mt-1">
                          {student.reg_number} • {student.department}
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </CardContent>
          </Card>

          {/* Step 2: Select Equipment Loan to Close */}
          {selectedStudentId && (
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-[#1B4998]" />
                  <CardTitle>Step 2: Select Item Being Returned</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleReturnSubmit} className="space-y-4">
                  <div className="space-y-2">
                    {studentLoans.map(loan => {
                      const isSelected = selectedTransactionId === loan.id;
                      const isOverdue = loan.status === 'overdue';

                      return (
                        <div
                          key={loan.id}
                          onClick={() => setSelectedTransactionId(loan.id)}
                          className={`p-3.5 rounded-lg border cursor-pointer transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                            isSelected
                              ? 'border-[#1B4998] bg-blue-50/40 ring-1 ring-[#1B4998]'
                              : 'border-slate-200 hover:border-slate-300 bg-white'
                          }`}
                        >
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold text-xs text-[#1B4998]">
                                {loan.equipment?.asset_id}
                              </span>
                              <span className="font-semibold text-sm text-slate-900">
                                {loan.equipment?.name}
                              </span>
                            </div>
                            <div className="text-xs text-slate-500 mt-1">
                              Issued: {formatDate(loan.issued_at)} • Scheduled Due:{' '}
                              <span className={isOverdue ? 'text-rose-600 font-bold' : ''}>
                                {formatDate(loan.due_at)}
                              </span>
                            </div>
                            {loan.issue_remarks && (
                              <div className="text-[11px] text-slate-400 italic mt-0.5">
                                Remarks: "{loan.issue_remarks}"
                              </div>
                            )}
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            {isOverdue && <StatusBadge status="overdue" />}
                            <input
                              type="radio"
                              name="loanSelection"
                              checked={isSelected}
                              onChange={() => setSelectedTransactionId(loan.id)}
                              className="w-4 h-4 text-[#1B4998]"
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Return Inspection */}
                  {selectedTransactionId && (
                    <div className="pt-4 border-t border-slate-100 space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <Select
                          label="Return Physical Condition Inspection"
                          value={returnCondition}
                          onChange={e =>
                            setReturnCondition(e.target.value as EquipmentCondition)
                          }
                          required
                        >
                          <option value="good">Good (Clean, Working Order)</option>
                          <option value="fair">Fair (Normal Wear, Intact)</option>
                          <option value="damaged">Damaged (Faulty / Needs Repair)</option>
                          <option value="needs_repair">Needs Calibration / Service</option>
                        </Select>

                        <Input
                          label="Return Remarks / Inspection Notes"
                          placeholder="e.g. Cables returned, probe tip intact"
                          value={remarks}
                          onChange={e => setRemarks(e.target.value)}
                        />
                      </div>

                      {returnCondition === 'damaged' && (
                        <Alert variant="warning" title="Damage Quarantine Warning">
                          Flagging this equipment as Damaged will immediately update its availability
                          status to <strong>Damaged</strong> and prevent future student issuance until
                          technician repair is signed off.
                        </Alert>
                      )}

                      <div className="flex justify-end pt-2">
                        <Button
                          type="submit"
                          isLoading={isSubmitting}
                          leftIcon={<RotateCcw className="w-4 h-4" />}
                        >
                          Confirm Equipment Return
                        </Button>
                      </div>
                    </div>
                  )}
                </form>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right Column: Policies & Quick Status */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <CardTitle>Return Inspection Guide</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 text-xs text-slate-600 leading-relaxed">
              <div className="p-2.5 rounded bg-slate-50 border border-slate-200">
                <span className="font-bold text-slate-900 block mb-0.5">Physical Verification</span>
                Inspect accessories (oscilloscope probes, power adapters, USB cables) before confirming return.
              </div>
              <div className="p-2.5 rounded bg-slate-50 border border-slate-200">
                <span className="font-bold text-slate-900 block mb-0.5">Audit Integrity</span>
                Return operations write an authoritative timestamp into <code>equipment_transactions</code>. Historical records are preserved forever.
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
