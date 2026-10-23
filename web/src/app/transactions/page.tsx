'use client';

import React, { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { StatusBadge } from '@/components/ui/Badge';
import { useData } from '@/context/DataContext';
import { formatDate, exportToCsv } from '@/lib/utils';
import {
  History,
  Search,
  Filter,
  Download,
  Printer,
  Calendar,
  FileSpreadsheet
} from 'lucide-react';

export default function TransactionsPage() {
  const { transactions } = useData();

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  // Filtered transactions
  const filteredTransactions = transactions.filter(t => {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      !searchQuery ||
      t.student?.full_name.toLowerCase().includes(q) ||
      t.student?.reg_number.toLowerCase().includes(q) ||
      t.equipment?.name.toLowerCase().includes(q) ||
      t.equipment?.asset_id.toLowerCase().includes(q);

    const matchesStatus = statusFilter === 'all' || t.status === statusFilter;

    let matchesDate = true;
    if (startDate) {
      matchesDate = matchesDate && new Date(t.issued_at) >= new Date(startDate);
    }
    if (endDate) {
      matchesDate = matchesDate && new Date(t.issued_at) <= new Date(`${endDate}T23:59:59Z`);
    }

    return matchesSearch && matchesStatus && matchesDate;
  });

  const handleExportCsv = () => {
    const rows = filteredTransactions.map(t => ({
      Transaction_ID: t.id,
      Student_Name: t.student?.full_name || '',
      Registration_No: t.student?.reg_number || '',
      Department: t.student?.department || '',
      Asset_ID: t.equipment?.asset_id || '',
      Equipment_Name: t.equipment?.name || '',
      Issued_At: t.issued_at,
      Due_At: t.due_at,
      Returned_At: t.returned_at || 'Not Returned',
      Status: t.status,
      Return_Condition: t.return_condition || '',
      Issued_By: t.issuer?.full_name || '',
      Returned_By: t.returner?.full_name || '',
      Issue_Remarks: t.issue_remarks || '',
      Return_Remarks: t.return_remarks || ''
    }));

    exportToCsv('KARE_SmartLab_Circulation_Audit', rows);
  };

  return (
    <AppLayout>
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">
            Circulation Transaction History
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Immutable audit log of all laboratory equipment borrowings, returns, and conditions.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => window.print()}
            leftIcon={<Printer className="w-3.5 h-3.5" />}
          >
            Print Audit Log
          </Button>

          <Button
            size="sm"
            onClick={handleExportCsv}
            disabled={filteredTransactions.length === 0}
            leftIcon={<Download className="w-3.5 h-3.5" />}
          >
            Export Filtered CSV
          </Button>
        </div>
      </div>

      {/* Filter and Date Bar */}
      <Card>
        <CardContent className="p-4 flex flex-col md:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search by student, reg number, or asset ID..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-1.5 text-sm rounded-md border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#1B4998]"
            />
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto flex-wrap">
            <Filter className="w-4 h-4 text-slate-400 shrink-0" />

            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="h-9 px-3 text-xs rounded-md border border-slate-300 bg-white text-slate-700"
            >
              <option value="all">All Transaction Statuses</option>
              <option value="active">Active Loans</option>
              <option value="returned">Returned in Good Order</option>
              <option value="overdue">Overdue Items</option>
              <option value="damaged">Damaged on Return</option>
            </select>

            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
              <input
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="h-9 px-2 text-xs rounded-md border border-slate-300 bg-white"
                title="Start Date"
              />
              <span>to</span>
              <input
                type="date"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                className="h-9 px-2 text-xs rounded-md border border-slate-300 bg-white"
                title="End Date"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Transactions Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-[#1B4998]" />
            <CardTitle>Circulation Audit Log ({filteredTransactions.length})</CardTitle>
          </div>
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-100 text-slate-500 uppercase text-[10px] font-semibold tracking-wider">
              <tr>
                <th className="px-5 py-3">Student Borrower</th>
                <th className="px-5 py-3">Equipment Asset</th>
                <th className="px-5 py-3">Issue Date</th>
                <th className="px-5 py-3">Due Date</th>
                <th className="px-5 py-3">Return Date</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Staff Issuer</th>
                <th className="px-5 py-3 text-right">Remarks</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {filteredTransactions.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-5 py-12 text-center text-slate-400">
                    No transactions match the selected criteria.
                  </td>
                </tr>
              ) : (
                filteredTransactions.map(t => (
                  <tr key={t.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-5 py-3 font-medium text-slate-900">
                      <div>{t.student?.full_name}</div>
                      <div className="font-mono text-[10px] text-[#1B4998]">
                        {t.student?.reg_number}
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <div className="font-semibold text-slate-900">{t.equipment?.name}</div>
                      <div className="font-mono text-[10px] text-slate-500">
                        {t.equipment?.asset_id}
                      </div>
                    </td>
                    <td className="px-5 py-3 whitespace-nowrap text-slate-600">
                      {formatDate(t.issued_at)}
                    </td>
                    <td className="px-5 py-3 whitespace-nowrap text-slate-600">
                      {formatDate(t.due_at)}
                    </td>
                    <td className="px-5 py-3 whitespace-nowrap text-slate-600">
                      {t.returned_at ? formatDate(t.returned_at) : (
                        <span className="text-amber-600 italic">Not Returned</span>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <StatusBadge status={t.status} />
                    </td>
                    <td className="px-5 py-3 text-slate-600">
                      <div>{t.issuer?.full_name || 'Staff'}</div>
                      {t.returner && (
                        <div className="text-[10px] text-slate-400">
                          Ret: {t.returner.full_name}
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-3 text-right text-slate-500 max-w-[160px] truncate">
                      {t.issue_remarks || t.return_remarks || '-'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </AppLayout>
  );
}
