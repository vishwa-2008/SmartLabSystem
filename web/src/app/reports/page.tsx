'use client';

import React from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { StatusBadge } from '@/components/ui/Badge';
import { useData } from '@/context/DataContext';
import { formatDate } from '@/lib/utils';
import {
  FileBarChart,
  Printer,
  Download,
  AlertTriangle,
  Cpu,
  Wrench,
  CheckCircle2,
  TrendingUp
} from 'lucide-react';

export default function ReportsPage() {
  const { equipment, transactions, students, stats } = useData();

  // Category breakdown
  const categoryStats: Record<string, { total: number; issued: number; available: number }> = {};
  equipment.forEach(e => {
    if (!categoryStats[e.category]) {
      categoryStats[e.category] = { total: 0, issued: 0, available: 0 };
    }
    categoryStats[e.category].total++;
    if (e.status === 'issued') categoryStats[e.category].issued++;
    if (e.status === 'available') categoryStats[e.category].available++;
  });

  // Overdue transactions
  const [overdueLoans, setOverdueLoans] = React.useState<typeof transactions>([]);
  React.useEffect(() => {
    const now = new Date();
    setOverdueLoans(
      transactions.filter(t => t.status === 'active' && new Date(t.due_at) < now)
    );
  }, [transactions]);

  // Damaged or maintenance items
  const damagedItems = equipment.filter(
    e => e.status === 'damaged' || e.status === 'maintenance' || e.condition === 'damaged'
  );

  return (
    <AppLayout>
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">
            Laboratory Analytics & Summary Reports
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Operational equipment utilization, asset maintenance health, and overdue risk assessment.
          </p>
        </div>

        <Button
          size="sm"
          onClick={() => window.print()}
          leftIcon={<Printer className="w-3.5 h-3.5" />}
        >
          Print Executive Report
        </Button>
      </div>

      {/* Summary KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 space-y-1">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              Active Utilization Rate
            </span>
            <div className="text-2xl font-bold text-blue-700">
              {stats.total_equipment > 0
                ? `${Math.round((stats.currently_issued / stats.total_equipment) * 100)}%`
                : '0%'}
            </div>
            <p className="text-[10px] text-slate-500">Assets currently deployed in student labs</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 space-y-1">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              Fleet Health Score
            </span>
            <div className="text-2xl font-bold text-emerald-700">
              {stats.total_equipment > 0
                ? `${Math.round(
                    ((stats.total_equipment - stats.damaged_equipment) / stats.total_equipment) * 100
                  )}%`
                : '100%'}
            </div>
            <p className="text-[10px] text-slate-500">Instruments in good working condition</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 space-y-1">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              Overdue Risk Index
            </span>
            <div className="text-2xl font-bold text-amber-700">
              {stats.currently_issued > 0
                ? `${Math.round((overdueLoans.length / stats.currently_issued) * 100)}%`
                : '0%'}
            </div>
            <p className="text-[10px] text-slate-500">Active loans exceeding due dates</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 space-y-1">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              Biometric Adoption
            </span>
            <div className="text-2xl font-bold text-[#1B4998]">
              {students.length > 0
                ? `${Math.round(
                    (students.filter(s => s.fingerprint_enrolled).length / students.length) * 100
                  )}%`
                : '0%'}
            </div>
            <p className="text-[10px] text-slate-500">Students with enrolled fingerprints</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Category Utilization Breakdown */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Cpu className="w-4 h-4 text-[#1B4998]" />
              <CardTitle>Inventory Category Utilization</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Object.entries(categoryStats).map(([cat, counts]) => {
                const utilPercent =
                  counts.total > 0 ? Math.round((counts.issued / counts.total) * 100) : 0;

                return (
                  <div key={cat} className="space-y-1 text-xs">
                    <div className="flex justify-between text-slate-700 font-medium">
                      <span>{cat}</span>
                      <span>
                        {counts.issued} / {counts.total} on loan ({utilPercent}%)
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-[#1B4998] h-2 rounded-full transition-all"
                        style={{ width: `${utilPercent}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Damaged and Maintenance Equipment */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Wrench className="w-4 h-4 text-rose-600" />
              <CardTitle>Damaged & Maintenance Quarantine ({damagedItems.length})</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {damagedItems.length === 0 ? (
              <p className="text-xs text-slate-400 py-6 text-center">
                All laboratory assets are in sound working condition.
              </p>
            ) : (
              <div className="space-y-2.5">
                {damagedItems.map(item => (
                  <div
                    key={item.id}
                    className="p-3 rounded-lg border border-rose-200 bg-rose-50/50 text-xs space-y-1"
                  >
                    <div className="flex justify-between font-semibold text-rose-950">
                      <span>{item.name}</span>
                      <span className="font-mono text-[#1B4998]">{item.asset_id}</span>
                    </div>
                    <div className="text-slate-600">Location: {item.location}</div>
                    <div className="text-[11px] text-slate-500 italic">
                      Issue: {item.description || 'Marked as damaged on return inspection.'}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Overdue Loans Audit */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            <CardTitle>Overdue Equipment Return Audit</CardTitle>
          </div>
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-100 text-slate-500 uppercase text-[10px] font-semibold tracking-wider">
              <tr>
                <th className="px-5 py-3">Student Borrower</th>
                <th className="px-5 py-3">Equipment Item</th>
                <th className="px-5 py-3">Scheduled Due</th>
                <th className="px-5 py-3">Days Overdue</th>
                <th className="px-5 py-3 text-right">Student Contact</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {overdueLoans.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center text-slate-400">
                    No overdue equipment items.
                  </td>
                </tr>
              ) : (
                overdueLoans.map(loan => {
                  const daysOverdue = Math.ceil(
                    (Date.now() - new Date(loan.due_at).getTime()) / (1000 * 60 * 60 * 24)
                  );

                  return (
                    <tr key={loan.id} className="hover:bg-amber-50/50 transition-colors">
                      <td className="px-5 py-3 font-medium text-slate-900">
                        <div>{loan.student?.full_name}</div>
                        <div className="font-mono text-[10px] text-slate-500">
                          {loan.student?.reg_number}
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <div className="font-medium text-slate-900">{loan.equipment?.name}</div>
                        <div className="font-mono text-[10px] text-[#1B4998]">
                          {loan.equipment?.asset_id}
                        </div>
                      </td>
                      <td className="px-5 py-3 text-slate-600">{formatDate(loan.due_at)}</td>
                      <td className="px-5 py-3 font-bold text-rose-600">
                        {daysOverdue} days past due
                      </td>
                      <td className="px-5 py-3 text-right font-mono text-slate-600">
                        +91 98765 43212
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </AppLayout>
  );
}
