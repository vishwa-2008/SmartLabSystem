'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Clock,
  AlertTriangle,
  Search,
  Filter,
  CheckCircle2,
  RefreshCw,
  ExternalLink,
  Building,
  User,
  Cpu,
  Calendar,
  ArrowUpDown,
  Download,
  AlertCircle
} from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Badge, StatusBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { useAuth } from '@/context/AuthContext';
import { useData } from '@/context/DataContext';
import { EquipmentTransaction, EquipmentCondition } from '@/types';
import { formatDate, formatRelativeTime } from '@/lib/utils';

export default function OutstandingPage() {
  const router = useRouter();
  const { currentUser, isHOD } = useAuth();
  const { fetchOutstanding, returnEquipment, labs, refreshStats } = useData();

  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<EquipmentTransaction[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [search, setSearch] = useState('');
  const [selectedLab, setSelectedLab] = useState<string>('all');
  const [filterType, setFilterType] = useState<'all' | 'overdue' | 'today'>('all');
  const [page, setPage] = useState(1);
  const limit = 20;

  // Quick Return Modal State
  const [returnModalOpen, setReturnModalOpen] = useState(false);
  const [selectedTx, setSelectedTx] = useState<EquipmentTransaction | null>(null);
  const [returnCondition, setReturnCondition] = useState<EquipmentCondition>('good');
  const [returnRemarks, setReturnRemarks] = useState('');
  const [isSubmittingReturn, setIsSubmittingReturn] = useState(false);
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const labParam = selectedLab !== 'all' ? selectedLab : undefined;
      const res = await fetchOutstanding({
        search: search.trim() || undefined,
        labId: labParam,
        page,
        limit
      });
      setItems(res.data);
      setTotalCount(res.count);
    } catch (err) {
      console.error('Error loading outstanding loans:', err);
    } finally {
      setLoading(false);
    }
  }, [fetchOutstanding, search, selectedLab, page]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Client-side quick filter for overdue vs due today
  const filteredItems = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(todayStart.getTime() + 86400000);

    return items.filter(tx => {
      const dueDate = new Date(tx.due_at);
      const isOverdue = dueDate < now;
      if (filterType === 'overdue') return isOverdue;
      if (filterType === 'today') return dueDate >= todayStart && dueDate < todayEnd;
      return true;
    });
  }, [items, filterType]);

  // Compute metrics
  const stats = useMemo(() => {
    const now = new Date();
    let overdueCount = 0;
    let dueTodayCount = 0;
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(todayStart.getTime() + 86400000);

    items.forEach(tx => {
      const dueDate = new Date(tx.due_at);
      if (dueDate < now) overdueCount++;
      else if (dueDate >= todayStart && dueDate < todayEnd) dueTodayCount++;
    });

    return {
      total: totalCount || items.length,
      overdue: overdueCount,
      dueToday: dueTodayCount
    };
  }, [items, totalCount]);

  const handleOpenReturnModal = (tx: EquipmentTransaction) => {
    setSelectedTx(tx);
    setReturnCondition('good');
    setReturnRemarks('');
    setReturnModalOpen(true);
  };

  const handleProcessReturn = async () => {
    if (!selectedTx) return;
    setIsSubmittingReturn(true);
    setActionMessage(null);

    const result = await returnEquipment(selectedTx.id, returnCondition, returnRemarks);
    setIsSubmittingReturn(false);

    if (result.success) {
      setActionMessage({ type: 'success', text: `Returned ${selectedTx.equipment?.name || 'item'} successfully!` });
      setReturnModalOpen(false);
      setSelectedTx(null);
      await loadData();
      await refreshStats();
      setTimeout(() => setActionMessage(null), 5000);
    } else {
      setActionMessage({ type: 'error', text: result.error || 'Failed to process return.' });
    }
  };

  const exportCSV = () => {
    const headers = ['Student Name', 'Reg Number', 'Department', 'Equipment', 'Asset ID', 'Lab', 'Issued At', 'Due At', 'Status', 'Condition'];
    const rows = filteredItems.map(t => [
      t.student?.full_name || 'N/A',
      t.student?.reg_number || 'N/A',
      t.student?.department || 'N/A',
      t.equipment?.name || 'N/A',
      t.equipment?.asset_id || 'N/A',
      t.laboratory?.name || 'N/A',
      new Date(t.issued_at).toLocaleString(),
      new Date(t.due_at).toLocaleString(),
      new Date(t.due_at) < new Date() ? 'OVERDUE' : 'ACTIVE',
      t.issue_condition || 'good'
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.map(x => `"${x}"`).join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `outstanding_equipment_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <AppLayout title="Equipment Not Returned">
      <div className="space-y-6 max-w-7xl mx-auto">
        {/* Banner Alert if action message */}
        {actionMessage && (
          <div
            className={`p-4 rounded-xl flex items-center justify-between shadow-xs transition-all ${
              actionMessage.type === 'success'
                ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
                : 'bg-rose-50 border border-rose-200 text-rose-800'
            }`}
          >
            <div className="flex items-center gap-3">
              {actionMessage.type === 'success' ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              ) : (
                <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
              )}
              <span className="font-medium text-sm">{actionMessage.text}</span>
            </div>
            <button
              onClick={() => setActionMessage(null)}
              className="text-xs font-semibold px-2 py-1 rounded-md hover:bg-black/5"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Header with Title and Quick Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <Clock className="w-7 h-7 text-[#1B4998]" />
              Equipment Not Returned
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Live operational monitor of all currently active and overdue student loans across laboratories.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={exportCSV}
              disabled={filteredItems.length === 0}
              className="flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              Export CSV
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={loadData}
              disabled={loading}
              className="flex items-center gap-2"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>

        {/* Summary Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="border-slate-200 shadow-xs">
            <CardContent className="p-5 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Currently Outstanding</p>
                <p className="text-3xl font-extrabold text-slate-900 mt-1">{stats.total}</p>
                <p className="text-xs text-slate-500 mt-1">Items in student possession</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-blue-50 text-[#1B4998] flex items-center justify-center">
                <Cpu className="w-6 h-6" />
              </div>
            </CardContent>
          </Card>

          <Card className={`border-slate-200 shadow-xs ${stats.overdue > 0 ? 'bg-rose-50/40 border-rose-200' : ''}`}>
            <CardContent className="p-5 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-rose-600">Past Return Deadline</p>
                <p className="text-3xl font-extrabold text-rose-700 mt-1">{stats.overdue}</p>
                <p className="text-xs text-rose-600/80 mt-1">Requires immediate follow-up</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center">
                <AlertTriangle className="w-6 h-6" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow-xs">
            <CardContent className="p-5 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-amber-600">Due Today</p>
                <p className="text-3xl font-extrabold text-amber-700 mt-1">{stats.dueToday}</p>
                <p className="text-xs text-slate-500 mt-1">Expected return before lab closes</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center">
                <Calendar className="w-6 h-6" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filter & Search Toolbar */}
        <Card className="border-slate-200 shadow-xs">
          <CardContent className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
              {/* Search */}
              <div className="md:col-span-5 relative">
                <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search student, reg no, equipment, or asset ID..."
                  value={search}
                  onChange={e => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                  className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1B4998] focus:border-transparent"
                />
              </div>

              {/* Lab Filter */}
              <div className="md:col-span-3">
                <select
                  value={selectedLab}
                  onChange={e => {
                    setSelectedLab(e.target.value);
                    setPage(1);
                  }}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1B4998]"
                >
                  <option value="all">All Laboratories</option>
                  {labs.map(lab => (
                    <option key={lab.id} value={lab.id}>
                      {lab.name} ({lab.lab_code})
                    </option>
                  ))}
                </select>
              </div>

              {/* Status Segment Filter */}
              <div className="md:col-span-4 flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
                <button
                  type="button"
                  onClick={() => setFilterType('all')}
                  className={`flex-1 py-1.5 px-3 rounded-md text-xs font-semibold transition-colors ${
                    filterType === 'all'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  All ({items.length})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterType('overdue')}
                  className={`flex-1 py-1.5 px-3 rounded-md text-xs font-semibold transition-colors ${
                    filterType === 'overdue'
                      ? 'bg-rose-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Overdue
                </button>
                <button
                  type="button"
                  onClick={() => setFilterType('today')}
                  className={`flex-1 py-1.5 px-3 rounded-md text-xs font-semibold transition-colors ${
                    filterType === 'today'
                      ? 'bg-amber-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Due Today
                </button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Outstanding Equipment Table */}
        <Card className="border-slate-200 shadow-xs overflow-hidden">
          <CardHeader className="bg-slate-50/70 border-b border-slate-200 py-3.5 px-6 flex flex-row items-center justify-between">
            <CardTitle className="text-base font-semibold text-slate-800">
              Active Loans ({filteredItems.length})
            </CardTitle>
            <span className="text-xs text-slate-500">
              {filteredItems.filter(x => new Date(x.due_at) < new Date()).length} items currently overdue
            </span>
          </CardHeader>

          {loading ? (
            <div className="p-12 text-center">
              <RefreshCw className="w-8 h-8 text-[#1B4998] animate-spin mx-auto mb-3" />
              <p className="text-sm font-medium text-slate-600">Loading outstanding equipment records...</p>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="p-12 text-center">
              <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
              <h3 className="text-base font-bold text-slate-900">No Outstanding Equipment Found</h3>
              <p className="text-sm text-slate-500 mt-1 max-w-md mx-auto">
                {search || selectedLab !== 'all' || filterType !== 'all'
                  ? 'No equipment loans matched your current filter criteria.'
                  : 'All issued lab equipment has been safely returned to inventory!'}
              </p>
              {(search || selectedLab !== 'all' || filterType !== 'all') && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSearch('');
                    setSelectedLab('all');
                    setFilterType('all');
                  }}
                  className="mt-4"
                >
                  Clear Filters
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 text-xs font-semibold uppercase tracking-wider">
                    <th className="py-3 px-4">Borrower Student</th>
                    <th className="py-3 px-4">Equipment Details</th>
                    <th className="py-3 px-4">Laboratory</th>
                    <th className="py-3 px-4">Issued At</th>
                    <th className="py-3 px-4">Due Status</th>
                    <th className="py-3 px-4">Condition</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredItems.map(tx => {
                    const now = new Date();
                    const dueDate = new Date(tx.due_at);
                    const isOverdue = dueDate < now;
                    const hoursDiff = Math.abs((now.getTime() - dueDate.getTime()) / 3600000);

                    return (
                      <tr
                        key={tx.id}
                        className={`hover:bg-slate-50/80 transition-colors ${
                          isOverdue ? 'bg-rose-50/20' : ''
                        }`}
                      >
                        {/* Student */}
                        <td className="py-3.5 px-4">
                          <div className="font-semibold text-slate-900">
                            {tx.student?.full_name || 'Unknown Student'}
                          </div>
                          <div className="text-xs text-slate-500 flex items-center gap-1.5 mt-0.5">
                            <span className="font-mono font-medium text-slate-700">
                              {tx.student?.reg_number}
                            </span>
                            <span>•</span>
                            <span>{tx.student?.department} {tx.student?.section}</span>
                          </div>
                        </td>

                        {/* Equipment */}
                        <td className="py-3.5 px-4">
                          <div className="font-semibold text-slate-900">
                            {tx.equipment?.name || 'Equipment'}
                          </div>
                          <div className="text-xs text-slate-500 flex items-center gap-1.5 mt-0.5">
                            <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded text-slate-700">
                              {tx.equipment?.asset_id}
                            </span>
                            <span>{tx.equipment?.category}</span>
                          </div>
                        </td>

                        {/* Lab */}
                        <td className="py-3.5 px-4 text-xs text-slate-600">
                          <div className="font-medium text-slate-800">
                            {tx.laboratory?.name || 'General Lab'}
                          </div>
                          <div className="text-slate-400">{tx.laboratory?.lab_code}</div>
                        </td>

                        {/* Issued At */}
                        <td className="py-3.5 px-4 text-xs text-slate-600 whitespace-nowrap">
                          <div>{formatDate(tx.issued_at)}</div>
                          <div className="text-[11px] text-slate-400">
                            by {tx.issued_by_staff?.full_name || 'Staff'}
                          </div>
                        </td>

                        {/* Due Status */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          {isOverdue ? (
                            <div>
                              <Badge variant="danger" className="font-semibold">
                                <AlertTriangle className="w-3 h-3 mr-1" />
                                Overdue by {hoursDiff >= 24 ? `${Math.floor(hoursDiff / 24)}d ${Math.floor(hoursDiff % 24)}h` : `${Math.floor(hoursDiff)}h ${Math.floor((hoursDiff % 1) * 60)}m`}
                              </Badge>
                              <div className="text-[11px] text-rose-600 font-medium mt-1">
                                Due: {formatDate(tx.due_at)}
                              </div>
                            </div>
                          ) : (
                            <div>
                              <Badge variant="info">
                                <Clock className="w-3 h-3 mr-1" />
                                In {hoursDiff >= 24 ? `${Math.floor(hoursDiff / 24)}d` : `${Math.floor(hoursDiff)}h ${Math.floor((hoursDiff % 1) * 60)}m`}
                              </Badge>
                              <div className="text-[11px] text-slate-500 mt-1">
                                Due: {formatDate(tx.due_at)}
                              </div>
                            </div>
                          )}
                        </td>

                        {/* Issue Condition */}
                        <td className="py-3.5 px-4">
                          <StatusBadge status={tx.issue_condition || 'good'} />
                          {tx.issue_remarks && (
                            <div className="text-[11px] text-slate-500 truncate max-w-[140px] mt-0.5" title={tx.issue_remarks}>
                              &quot;{tx.issue_remarks}&quot;
                            </div>
                          )}
                        </td>

                        {/* Action: Quick Return */}
                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          <Button
                            size="sm"
                            onClick={() => handleOpenReturnModal(tx)}
                            className="bg-[#1B4998] hover:bg-[#143775] text-white shadow-xs text-xs font-semibold"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                            Record Return
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {/* Quick Return Dialog Modal */}
        <Modal
          isOpen={returnModalOpen}
          onClose={() => setReturnModalOpen(false)}
          title="Confirm Equipment Return"
        >
          {selectedTx && (
            <div className="space-y-4">
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="font-bold text-slate-900 text-sm">{selectedTx.equipment?.name}</h4>
                    <p className="text-xs text-slate-500 font-mono mt-0.5">Asset ID: {selectedTx.equipment?.asset_id}</p>
                  </div>
                  <Badge variant={selectedTx.is_overdue ? 'danger' : 'info'}>
                    {selectedTx.is_overdue ? 'Overdue' : 'Active Loan'}
                  </Badge>
                </div>
                <div className="mt-3 pt-3 border-t border-slate-200 text-xs text-slate-600 flex justify-between">
                  <span>Borrower: <strong>{selectedTx.student?.full_name}</strong> ({selectedTx.student?.reg_number})</span>
                  <span>Issued condition: <strong className="capitalize">{selectedTx.issue_condition || 'good'}</strong></span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Inspected Return Condition *
                </label>
                <select
                  value={returnCondition}
                  onChange={e => setReturnCondition(e.target.value as EquipmentCondition)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1B4998]"
                >
                  <option value="good">Good (Working fine, normal wear)</option>
                  <option value="fair">Fair (Usable, minor cosmetic marks)</option>
                  <option value="damaged">Damaged (Broken, needs lab technician fix)</option>
                  <option value="needs_repair">Needs Repair (Electrical / mechanical fault)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Inspection Remarks / Fault Description
                </label>
                <textarea
                  value={returnRemarks}
                  onChange={e => setReturnRemarks(e.target.value)}
                  placeholder="Optional remarks (required if marked damaged or needs repair)..."
                  rows={3}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1B4998]"
                />
              </div>

              {returnCondition === 'damaged' && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>Marking as damaged will automatically update the inventory status to <strong>damaged</strong> and alert the lab in-charge.</span>
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-2">
                <Button
                  variant="outline"
                  onClick={() => setReturnModalOpen(false)}
                  disabled={isSubmittingReturn}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleProcessReturn}
                  disabled={isSubmittingReturn}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  {isSubmittingReturn ? 'Processing...' : 'Confirm Return & Restock'}
                </Button>
              </div>
            </div>
          )}
        </Modal>
      </div>
    </AppLayout>
  );
}
