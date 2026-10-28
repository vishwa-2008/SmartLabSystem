'use client';

import React, { useMemo } from 'react';
import Link from 'next/link';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge, StatusBadge } from '@/components/ui/Badge';
import { useAuth } from '@/context/AuthContext';
import { useData } from '@/context/DataContext';
import { formatDate, formatRelativeTime } from '@/lib/utils';
import {
  Users,
  Cpu,
  PackagePlus,
  PackageCheck,
  AlertTriangle,
  Fingerprint,
  Radio,
  ArrowRight,
  RefreshCw,
  Building,
  ShieldCheck,
  Clock,
  UserCheck,
  Activity,
  History,
  Sparkles,
  CheckCircle2,
  FileBarChart
} from 'lucide-react';

export default function DashboardPage() {
  const { currentUser, isHOD } = useAuth();
  const {
    stats,
    scans,
    equipment,
    transactions,
    labs,
    staff,
    auditLogs,
    deviceTelemetry,
    isRefreshing,
    refreshAll
  } = useData();

  // Active / overdue loans calculation
  const overdueLoans = useMemo(() => {
    const now = new Date();
    return transactions.filter(t => t.status === 'active' && new Date(t.due_at) < now);
  }, [transactions]);

  const activeLoans = useMemo(() => {
    return transactions.filter(t => t.status === 'active');
  }, [transactions]);

  // Lab in-charge specific equipment
  const availableEquipment = useMemo(() => {
    return equipment.filter(e => e.status === 'available');
  }, [equipment]);

  return (
    <AppLayout title={isHOD ? 'HOD Executive Dashboard' : 'Lab In-charge Terminal'}>
      <div className="space-y-6 max-w-7xl mx-auto">
        {/* Top Header / Greeting */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-1">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                {isHOD ? 'Department Overview & Administration' : 'Lab Circulation Desk'}
              </h1>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider ${
                isHOD ? 'bg-indigo-100 text-indigo-800' : 'bg-blue-100 text-[#1B4998]'
              }`}>
                {isHOD ? 'Head of Department' : 'Lab In-charge'}
              </span>
            </div>
            <p className="text-sm text-slate-500 mt-0.5">
              Welcome back, <strong>{currentUser?.full_name || 'Staff Member'}</strong>. Real-time laboratory operational status.
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={() => refreshAll()}
              disabled={isRefreshing}
              className="flex items-center gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>

            {!isHOD && (
              <Link href="/scan">
                <Button
                  size="sm"
                  className="bg-[#1B4998] hover:bg-[#143775] text-white flex items-center gap-1.5 shadow-sm font-semibold"
                >
                  <Fingerprint className="w-4 h-4" />
                  Scan Student
                </Button>
              </Link>
            )}

            <Link href="/outstanding">
              <Button
                variant={overdueLoans.length > 0 ? 'danger' : 'outline'}
                size="sm"
                className="flex items-center gap-1.5"
              >
                <Clock className="w-3.5 h-3.5" />
                Not Returned ({activeLoans.length})
              </Button>
            </Link>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* ROLE VIEW: HOD (Department Oversight, Labs, Staff, Institution Overdues) */}
        {/* ========================================================================= */}
        {isHOD ? (
          <div className="space-y-6">
            {/* HOD KPI Metrics Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
              <Card className="hover:border-slate-300 transition-colors">
                <CardContent className="p-4 space-y-1">
                  <div className="flex items-center justify-between text-slate-500">
                    <span className="text-[11px] font-semibold uppercase tracking-wider">Laboratories</span>
                    <Building className="w-4 h-4 text-[#1B4998]" />
                  </div>
                  <div className="text-2xl font-bold text-slate-900">{labs.length}</div>
                  <div className="text-[10px] text-slate-500">Active lab facilities</div>
                </CardContent>
              </Card>

              <Card className="hover:border-slate-300 transition-colors">
                <CardContent className="p-4 space-y-1">
                  <div className="flex items-center justify-between text-slate-500">
                    <span className="text-[11px] font-semibold uppercase tracking-wider">Staff In-charges</span>
                    <UserCheck className="w-4 h-4 text-indigo-600" />
                  </div>
                  <div className="text-2xl font-bold text-slate-900">{stats.active_staff || staff.length}</div>
                  <div className="text-[10px] text-slate-500">Authorized personnel</div>
                </CardContent>
              </Card>

              <Card className="hover:border-slate-300 transition-colors">
                <CardContent className="p-4 space-y-1">
                  <div className="flex items-center justify-between text-slate-500">
                    <span className="text-[11px] font-semibold uppercase tracking-wider">Total Equipment</span>
                    <Cpu className="w-4 h-4 text-slate-600" />
                  </div>
                  <div className="text-2xl font-bold text-slate-900">{stats.total_equipment}</div>
                  <div className="text-[10px] text-slate-500">Cataloged assets</div>
                </CardContent>
              </Card>

              <Card className="hover:border-slate-300 transition-colors">
                <CardContent className="p-4 space-y-1">
                  <div className="flex items-center justify-between text-slate-500">
                    <span className="text-[11px] font-semibold uppercase tracking-wider">Active Loans</span>
                    <PackagePlus className="w-4 h-4 text-amber-600" />
                  </div>
                  <div className="text-2xl font-bold text-slate-900">{activeLoans.length}</div>
                  <div className="text-[10px] text-slate-500">With students now</div>
                </CardContent>
              </Card>

              <Card className={`hover:border-rose-300 transition-colors ${overdueLoans.length > 0 ? 'bg-rose-50/40 border-rose-200' : ''}`}>
                <CardContent className="p-4 space-y-1">
                  <div className="flex items-center justify-between text-rose-600">
                    <span className="text-[11px] font-semibold uppercase tracking-wider">Overdue Items</span>
                    <AlertTriangle className="w-4 h-4 text-rose-600" />
                  </div>
                  <div className="text-2xl font-bold text-rose-700">{overdueLoans.length}</div>
                  <div className="text-[10px] text-rose-600">Past return deadline</div>
                </CardContent>
              </Card>

              <Card className="hover:border-slate-300 transition-colors">
                <CardContent className="p-4 space-y-1">
                  <div className="flex items-center justify-between text-slate-500">
                    <span className="text-[11px] font-semibold uppercase tracking-wider">Registered Students</span>
                    <Users className="w-4 h-4 text-emerald-600" />
                  </div>
                  <div className="text-2xl font-bold text-slate-900">{stats.total_students}</div>
                  <div className="text-[10px] text-slate-500">Enrolled borrowers</div>
                </CardContent>
              </Card>
            </div>

            {/* Overdue Items Alert Box if any exist */}
            {overdueLoans.length > 0 && (
              <Card className="border-rose-300 bg-rose-50/30 shadow-xs">
                <CardHeader className="py-3 px-6 border-b border-rose-200 flex flex-row items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-rose-600" />
                    <CardTitle className="text-sm font-bold text-rose-900">
                      Attention: {overdueLoans.length} Institution Equipment Item(s) Overdue
                    </CardTitle>
                  </div>
                  <Link href="/outstanding" className="text-xs font-bold text-rose-700 hover:underline">
                    View Complete Outstanding Register →
                  </Link>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="divide-y divide-rose-100 text-xs">
                    {overdueLoans.slice(0, 4).map(tx => (
                      <div key={tx.id} className="p-3.5 px-6 flex items-center justify-between">
                        <div>
                          <span className="font-semibold text-slate-900">{tx.student?.full_name}</span>{' '}
                          <span className="font-mono text-slate-600">({tx.student?.reg_number})</span>
                          <span className="text-slate-400 mx-2">•</span>
                          <span className="font-medium text-slate-800">{tx.equipment?.name}</span>
                        </div>
                        <div className="text-rose-700 font-semibold">
                          Overdue since {formatDate(tx.due_at)}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Two Column Section: Laboratories Grid & Audit Trail */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left (8 Cols): Laboratories Breakdown */}
              <div className="lg:col-span-8 space-y-4">
                <Card className="border-slate-200 shadow-xs">
                  <CardHeader className="py-3.5 px-6 border-b border-slate-200 flex flex-row items-center justify-between">
                    <CardTitle className="text-base font-semibold text-slate-800 flex items-center gap-2">
                      <Building className="w-4 h-4 text-[#1B4998]" />
                      Laboratory Facilities & Asset Distribution
                    </CardTitle>
                    <Link href="/equipment" className="text-xs font-semibold text-[#1B4998] hover:underline">
                      Manage Equipment →
                    </Link>
                  </CardHeader>
                  <CardContent className="p-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {labs.map(lab => {
                        const labEquipment = equipment.filter(e => e.lab_id === lab.id);
                        const labLoans = activeLoans.filter(t => t.lab_id === lab.id);

                        return (
                          <div
                            key={lab.id}
                            className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-slate-50 transition-colors"
                          >
                            <div className="flex items-start justify-between">
                              <div>
                                <h4 className="font-bold text-slate-900 text-sm">{lab.name}</h4>
                                <p className="text-xs text-slate-500 font-mono mt-0.5">{lab.lab_code} • {lab.location}</p>
                              </div>
                              <Badge variant="info">{labEquipment.length} items</Badge>
                            </div>
                            <div className="mt-3 pt-3 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600">
                              <span>Currently issued: <strong>{labLoans.length}</strong></span>
                              <span>Available: <strong>{labEquipment.filter(e => e.status === 'available').length}</strong></span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Right (4 Cols): Audit Activity & System Status */}
              <div className="lg:col-span-4 space-y-4">
                <Card className="border-slate-200 shadow-xs">
                  <CardHeader className="py-3.5 px-6 border-b border-slate-200 flex flex-row items-center justify-between">
                    <CardTitle className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-emerald-600" />
                      Recent Staff Audit Log
                    </CardTitle>
                    <Link href="/reports?type=audit" className="text-xs font-semibold text-[#1B4998] hover:underline">
                      Full Audit →
                    </Link>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="divide-y divide-slate-100 text-xs">
                      {auditLogs.slice(0, 5).map(log => (
                        <div key={log.id} className="p-3 px-6 hover:bg-slate-50">
                          <div className="font-semibold text-slate-800">{log.action.replace('_', ' ')}</div>
                          <div className="text-[11px] text-slate-500 mt-0.5 flex justify-between">
                            <span>{log.actor?.full_name || 'Staff'}</span>
                            <span className="font-mono">{formatDate(log.created_at)}</span>
                          </div>
                        </div>
                      ))}
                      {auditLogs.length === 0 && (
                        <div className="p-6 text-center text-slate-400">No audit events recorded yet</div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        ) : (
          /* ========================================================================= */
          /* ROLE VIEW: LAB IN-CHARGE (Scan-first, Outstanding returns, Quick actions) */
          /* ========================================================================= */
          <div className="space-y-6">
            {/* Primary Action Hero Card: Scan Student */}
            <Card className="border-[#1B4998]/30 shadow-sm bg-gradient-to-r from-blue-50/70 via-indigo-50/40 to-white overflow-hidden relative">
              <CardContent className="p-6 sm:p-8 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                <div className="space-y-2 max-w-xl">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#1B4998] text-white">
                    <Sparkles className="w-3 h-3" />
                    Primary Workflow
                  </span>
                  <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">
                    Issue Equipment to Student
                  </h2>
                  <p className="text-sm text-slate-600 leading-relaxed">
                    Authenticate the student with their enrolled fingerprint on the optical sensor. The system will verify their identity and active loans before opening the equipment issue slip.
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
                  <Link href="/scan">
                    <Button
                      size="lg"
                      className="bg-[#1B4998] hover:bg-[#143775] text-white font-bold shadow-md flex items-center justify-center gap-2 px-6"
                    >
                      <Fingerprint className="w-5 h-5" />
                      Scan Fingerprint Now
                      <ArrowRight className="w-4 h-4 ml-1" />
                    </Button>
                  </Link>
                  <Link href="/issue">
                    <Button
                      variant="outline"
                      size="lg"
                      className="text-xs font-semibold"
                    >
                      Search by Reg No
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>

            {/* Operational KPI Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <Card className="border-slate-200 shadow-xs">
                <CardContent className="p-5 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Available</span>
                    <div className="text-3xl font-extrabold text-slate-900 mt-1">{availableEquipment.length}</div>
                    <div className="text-xs text-slate-500 mt-0.5">Ready to be issued</div>
                  </div>
                  <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                </CardContent>
              </Card>

              <Card className="border-slate-200 shadow-xs">
                <CardContent className="p-5 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">On Loan</span>
                    <div className="text-3xl font-extrabold text-[#1B4998] mt-1">{activeLoans.length}</div>
                    <div className="text-xs text-slate-500 mt-0.5">Currently out with students</div>
                  </div>
                  <div className="w-12 h-12 rounded-xl bg-blue-50 text-[#1B4998] flex items-center justify-center">
                    <PackagePlus className="w-6 h-6" />
                  </div>
                </CardContent>
              </Card>

              <Card className={`border-slate-200 shadow-xs ${overdueLoans.length > 0 ? 'bg-rose-50/40 border-rose-200' : ''}`}>
                <CardContent className="p-5 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-semibold uppercase tracking-wider text-rose-600">Overdue</span>
                    <div className="text-3xl font-extrabold text-rose-700 mt-1">{overdueLoans.length}</div>
                    <div className="text-xs text-rose-600 mt-0.5">Past return deadline</div>
                  </div>
                  <div className="w-12 h-12 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center">
                    <AlertTriangle className="w-6 h-6" />
                  </div>
                </CardContent>
              </Card>

              <Card className="border-slate-200 shadow-xs">
                <CardContent className="p-5 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Sensor Status</span>
                    <div className="text-lg font-bold text-slate-900 mt-1">
                      {deviceTelemetry.online ? 'Online' : 'Offline'}
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5 font-mono">{deviceTelemetry.deviceId}</div>
                  </div>
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                    deviceTelemetry.online ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
                  }`}>
                    <Activity className="w-6 h-6" />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Main Operational Split: Not Returned Focus & Live Activity Stream */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left (7 Cols): Items Awaiting Return */}
              <div className="lg:col-span-7 space-y-4">
                <Card className="border-slate-200 shadow-xs">
                  <CardHeader className="py-3.5 px-6 border-b border-slate-200 flex flex-row items-center justify-between">
                    <CardTitle className="text-base font-semibold text-slate-800 flex items-center gap-2">
                      <Clock className="w-4 h-4 text-[#1B4998]" />
                      Items Awaiting Return ({activeLoans.length})
                    </CardTitle>
                    <Link href="/outstanding" className="text-xs font-semibold text-[#1B4998] hover:underline">
                      View All Outstanding →
                    </Link>
                  </CardHeader>
                  <CardContent className="p-0">
                    {activeLoans.length === 0 ? (
                      <div className="p-8 text-center text-slate-400">
                        <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                        <p className="text-sm font-medium text-slate-700">All equipment has been safely returned!</p>
                      </div>
                    ) : (
                      <div className="divide-y divide-slate-100 text-sm">
                        {activeLoans.slice(0, 5).map(loan => {
                          const isOverdue = new Date(loan.due_at) < new Date();
                          return (
                            <div
                              key={loan.id}
                              className={`p-3.5 px-6 flex items-center justify-between hover:bg-slate-50 transition-colors ${
                                isOverdue ? 'bg-rose-50/20' : ''
                              }`}
                            >
                              <div>
                                <div className="font-semibold text-slate-900">
                                  {loan.equipment?.name} <span className="font-mono text-xs text-slate-500">({loan.equipment?.asset_id})</span>
                                </div>
                                <div className="text-xs text-slate-500 mt-0.5">
                                  Borrower: <strong className="text-slate-700">{loan.student?.full_name}</strong> ({loan.student?.reg_number})
                                </div>
                              </div>
                              <div className="text-right">
                                {isOverdue ? (
                                  <Badge variant="danger">Overdue</Badge>
                                ) : (
                                  <span className="text-xs text-slate-500">Due: {formatDate(loan.due_at)}</span>
                                )}
                                <div className="mt-1">
                                  <Link href={`/return?transactionId=${loan.id}`}>
                                    <button className="text-xs font-semibold text-[#1B4998] hover:underline">
                                      Return →
                                    </button>
                                  </Link>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Right (5 Cols): Live Scan Feed */}
              <div className="lg:col-span-5 space-y-4">
                <Card className="border-slate-200 shadow-xs">
                  <CardHeader className="py-3.5 px-6 border-b border-slate-200 flex flex-row items-center justify-between">
                    <CardTitle className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                      <Fingerprint className="w-4 h-4 text-[#1B4998]" />
                      Live Sensor Activity
                    </CardTitle>
                    <Link href="/scan" className="text-xs font-semibold text-[#1B4998] hover:underline">
                      Live Terminal →
                    </Link>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="divide-y divide-slate-100 text-xs">
                      {scans.slice(0, 5).map(scan => (
                        <div key={scan.id} className="p-3 px-6 hover:bg-slate-50 flex items-center justify-between">
                          <div>
                            <div className="font-semibold text-slate-800">
                              {scan.student?.full_name || (scan.status === 'matched' ? `Template #${scan.template_id}` : 'Unrecognized Finger')}
                            </div>
                            <div className="text-[11px] text-slate-400 font-mono">
                              {scan.student?.reg_number || `Slot #${scan.template_id}`}
                            </div>
                          </div>
                          <div className="text-right">
                            <StatusBadge status={scan.status} />
                            <div className="text-[10px] text-slate-400 mt-0.5">
                              {new Date(scan.created_at).toLocaleTimeString()}
                            </div>
                          </div>
                        </div>
                      ))}
                      {scans.length === 0 && (
                        <div className="p-6 text-center text-slate-400">No sensor scans captured yet today</div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
