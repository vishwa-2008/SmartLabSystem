'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge, StatusBadge } from '@/components/ui/Badge';
import { useAuth } from '@/context/AuthContext';
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
  Building,
  RotateCcw,
  Clock
} from 'lucide-react';

export default function ReportsPage() {
  const { currentUser, isHOD } = useAuth();
  const { equipment, transactions, students, labs, stats } = useData();

  const [selectedLabId, setSelectedLabId] = useState<string>('all');

  // Filter equipment by selected lab
  const filteredEquipment = useMemo(() => {
    if (selectedLabId === 'all') return equipment;
    return equipment.filter(e => e.lab_id === selectedLabId);
  }, [equipment, selectedLabId]);

  // Filter transactions by selected lab
  const filteredTransactions = useMemo(() => {
    if (selectedLabId === 'all') return transactions;
    return transactions.filter(t => t.lab_id === selectedLabId);
  }, [transactions, selectedLabId]);

  // Category breakdown
  const categoryStats = useMemo(() => {
    const map: Record<string, { total: number; issued: number; available: number }> = {};
    filteredEquipment.forEach(e => {
      if (!map[e.category]) {
        map[e.category] = { total: 0, issued: 0, available: 0 };
      }
      map[e.category].total++;
      if (e.status === 'issued') map[e.category].issued++;
      if (e.status === 'available') map[e.category].available++;
    });
    return map;
  }, [filteredEquipment]);

  // Overdue transactions
  const overdueLoans = useMemo(() => {
    const now = new Date();
    return filteredTransactions.filter(t => t.status === 'active' && new Date(t.due_at) < now);
  }, [filteredTransactions]);

  const activeLoans = useMemo(() => {
    return filteredTransactions.filter(t => t.status === 'active');
  }, [filteredTransactions]);

  // Damaged or maintenance items
  const damagedItems = useMemo(() => {
    return filteredEquipment.filter(
      e => e.status === 'damaged' || e.status === 'maintenance' || e.condition === 'damaged' || e.condition === 'needs_repair'
    );
  }, [filteredEquipment]);

  const exportCSV = () => {
    const headers = ['Category', 'Total Assets', 'Currently Issued', 'Available', 'Utilization Rate'];
    const rows = Object.entries(categoryStats).map(([cat, counts]) => [
      cat,
      counts.total,
      counts.issued,
      counts.available,
      `${counts.total > 0 ? Math.round((counts.issued / counts.total) * 100) : 0}%`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.map(x => `"${x}"`).join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `lab_report_${selectedLabId}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <AppLayout title="Laboratory Reports & Audit">
      <div className="space-y-6 max-w-7xl mx-auto">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <FileBarChart className="w-7 h-7 text-[#1B4998]" />
              {isHOD ? 'Institutional Equipment Reports' : 'Laboratory Circulation Analytics'}
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              {isHOD
                ? 'Department-wide asset utilization, lab inventory health, and loan compliance audits.'
                : 'Asset circulation status, maintenance flags, and active borrower tracking for your laboratory.'}
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            {/* Lab Selector for HOD */}
            {isHOD && labs.length > 1 && (
              <div className="flex items-center gap-2">
                <Building className="w-4 h-4 text-slate-400" />
                <select
                  value={selectedLabId}
                  onChange={e => setSelectedLabId(e.target.value)}
                  className="px-3 py-1.5 text-xs border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#1B4998]"
                >
                  <option value="all">All Laboratories (Institution View)</option>
                  {labs.map(lab => (
                    <option key={lab.id} value={lab.id}>
                      {lab.name} ({lab.lab_code})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <Button
              size="sm"
              variant="outline"
              onClick={exportCSV}
              className="flex items-center gap-2"
            >
              <Download className="w-3.5 h-3.5" />
              Export CSV
            </Button>

            <Button
              size="sm"
              onClick={() => window.print()}
              className="bg-[#1B4998] hover:bg-[#143775] text-white flex items-center gap-2"
            >
              <Printer className="w-3.5 h-3.5" />
              Print Report
            </Button>
          </div>
        </div>

        {/* Summary KPI Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <Card className="border-slate-200 shadow-xs">
            <CardContent className="p-5 space-y-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Active Utilization Rate
              </span>
              <div className="text-3xl font-bold text-[#1B4998]">
                {filteredEquipment.length > 0
                  ? `${Math.round((activeLoans.length / filteredEquipment.length) * 100)}%`
                  : '0%'}
              </div>
              <p className="text-xs text-slate-500">{activeLoans.length} of {filteredEquipment.length} items on loan</p>
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow-xs">
            <CardContent className="p-5 space-y-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Fleet Health Score
              </span>
              <div className="text-3xl font-bold text-emerald-700">
                {filteredEquipment.length > 0
                  ? `${Math.round(
                      ((filteredEquipment.length - damagedItems.length) / filteredEquipment.length) * 100
                    )}%`
                  : '100%'}
              </div>
              <p className="text-xs text-slate-500">{damagedItems.length} items tagged for maintenance</p>
            </CardContent>
          </Card>

          <Card className={`border-slate-200 shadow-xs ${overdueLoans.length > 0 ? 'bg-rose-50/40 border-rose-200' : ''}`}>
            <CardContent className="p-5 space-y-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-rose-600">
                Overdue Loans
              </span>
              <div className="text-3xl font-bold text-rose-700">
                {overdueLoans.length}
              </div>
              <p className="text-xs text-rose-600/80">Requires staff return follow-up</p>
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow-xs">
            <CardContent className="p-5 space-y-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Total Cataloged Assets
              </span>
              <div className="text-3xl font-bold text-slate-900">
                {filteredEquipment.length}
              </div>
              <p className="text-xs text-slate-500">In {selectedLabId === 'all' ? `${labs.length} laboratories` : 'selected laboratory'}</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Category Utilization Breakdown */}
          <Card className="border-slate-200 shadow-xs">
            <CardHeader className="py-3.5 px-6 border-b border-slate-200 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                <Cpu className="w-4 h-4 text-[#1B4998]" />
                Equipment Category Utilization
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="space-y-4">
                {Object.entries(categoryStats).map(([cat, counts]) => {
                  const utilPercent =
                    counts.total > 0 ? Math.round((counts.issued / counts.total) * 100) : 0;

                  return (
                    <div key={cat} className="space-y-1.5 text-xs">
                      <div className="flex justify-between text-slate-700 font-medium">
                        <span className="font-semibold">{cat}</span>
                        <span>
                          {counts.issued} / {counts.total} on loan ({utilPercent}%)
                        </span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                        <div
                          className="bg-[#1B4998] h-2.5 rounded-full transition-all duration-500"
                          style={{ width: `${utilPercent}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
                {Object.keys(categoryStats).length === 0 && (
                  <p className="text-xs text-slate-400 text-center py-6">No equipment categories found.</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Damaged and Maintenance Equipment */}
          <Card className="border-slate-200 shadow-xs">
            <CardHeader className="py-3.5 px-6 border-b border-slate-200 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                <Wrench className="w-4 h-4 text-rose-600" />
                Damaged & Maintenance Quarantine ({damagedItems.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              {damagedItems.length === 0 ? (
                <div className="text-center py-8">
                  <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                  <p className="text-xs text-slate-600 font-medium">
                    All laboratory assets are in verified working condition.
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5 max-h-72 overflow-y-auto">
                  {damagedItems.map(item => (
                    <div
                      key={item.id}
                      className="p-3 rounded-lg border border-rose-200 bg-rose-50/40 text-xs space-y-1"
                    >
                      <div className="flex justify-between font-semibold text-rose-950">
                        <span>{item.name}</span>
                        <span className="font-mono text-[#1B4998]">{item.asset_id}</span>
                      </div>
                      <div className="text-slate-600">Location: {item.location} • Status: <strong className="capitalize">{item.status}</strong></div>
                      {item.description && (
                        <div className="text-[11px] text-slate-500 italic">
                          Notes: {item.description}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Overdue Loans Audit */}
        <Card className="border-slate-200 shadow-xs overflow-hidden">
          <CardHeader className="py-3.5 px-6 border-b border-slate-200 flex flex-row items-center justify-between bg-slate-50/70">
            <CardTitle className="text-sm font-semibold text-slate-800 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              Overdue Equipment Return Audit ({overdueLoans.length})
            </CardTitle>
            <Link href="/outstanding" className="text-xs font-semibold text-[#1B4998] hover:underline">
              Open Outstanding Desk →
            </Link>
          </CardHeader>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-600 uppercase text-[10px] font-semibold tracking-wider">
                <tr>
                  <th className="px-5 py-3">Student Borrower</th>
                  <th className="px-5 py-3">Equipment Item</th>
                  <th className="px-5 py-3">Scheduled Due</th>
                  <th className="px-5 py-3">Overdue Duration</th>
                  <th className="px-5 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {overdueLoans.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-5 py-8 text-center text-slate-400">
                      No overdue equipment items in the selected scope.
                    </td>
                  </tr>
                ) : (
                  overdueLoans.map(loan => {
                    const hoursDiff = Math.abs((Date.now() - new Date(loan.due_at).getTime()) / 3600000);

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
                          {hoursDiff >= 24 ? `${Math.floor(hoursDiff / 24)} days overdue` : `${Math.floor(hoursDiff)} hours overdue`}
                        </td>
                        <td className="px-5 py-3 text-right">
                          <Link href={`/return?transactionId=${loan.id}`}>
                            <Button size="sm" variant="outline" className="text-xs h-7 px-2">
                              <RotateCcw className="w-3 h-3 mr-1" />
                              Process Return
                            </Button>
                          </Link>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </AppLayout>
  );
}
