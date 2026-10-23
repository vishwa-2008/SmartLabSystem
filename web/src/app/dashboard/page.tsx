'use client';

import React from 'react';
import Link from 'next/link';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { StatusBadge } from '@/components/ui/Badge';
import { useData } from '@/context/DataContext';
import { formatDate, formatTime } from '@/lib/utils';
import {
  Users,
  Cpu,
  PackagePlus,
  PackageCheck,
  AlertTriangle,
  Wrench,
  Fingerprint,
  Radio,
  ArrowRight,
  RefreshCw,
  PlusCircle,
  RotateCcw
} from 'lucide-react';

export default function DashboardPage() {
  const {
    stats,
    scans,
    equipment,
    transactions,
    deviceTelemetry,
    isRefreshing,
    refreshAll
  } = useData();

  // Get currently issued items
  const issuedEquipment = equipment.filter(e => e.status === 'issued');

  // Get overdue transactions computed in effect
  const [overdueTransactions, setOverdueTransactions] = React.useState<typeof transactions>([]);
  React.useEffect(() => {
    const now = new Date();
    setOverdueTransactions(
      transactions.filter(t => t.status === 'active' && new Date(t.due_at) < now)
    );
  }, [transactions]);

  // Take top 5 recent scans
  const recentScans = scans.slice(0, 6);

  // Take top 5 recent transactions
  const recentTransactions = transactions.slice(0, 5);

  return (
    <AppLayout>
      {/* Top Banner & Quick Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">
            Laboratory Circulation Operations
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time biometric monitoring and laboratory equipment inventory status.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refreshAll()}
            isLoading={isRefreshing}
            leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
          >
            Refresh
          </Button>

          <Link href="/issue">
            <Button size="sm" leftIcon={<PackagePlus className="w-4 h-4" />}>
              Issue Equipment
            </Button>
          </Link>

          <Link href="/return">
            <Button
              variant="secondary"
              size="sm"
              leftIcon={<RotateCcw className="w-4 h-4 text-slate-600" />}
            >
              Return Equipment
            </Button>
          </Link>
        </div>
      </div>

      {/* 7 KPI Operational Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-3 sm:gap-4">
        {/* 1. Total Registered Students */}
        <Card className="hover:border-slate-300 transition-colors">
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-[11px] font-semibold uppercase tracking-wider">Students</span>
              <Users className="w-4 h-4 text-[#1B4998]" />
            </div>
            <div className="text-2xl font-bold text-slate-900">{stats.total_students}</div>
            <div className="text-[10px] text-slate-500">Active laboratory users</div>
          </CardContent>
        </Card>

        {/* 2. Total Equipment Items */}
        <Card className="hover:border-slate-300 transition-colors">
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-[11px] font-semibold uppercase tracking-wider">Total Assets</span>
              <Cpu className="w-4 h-4 text-slate-600" />
            </div>
            <div className="text-2xl font-bold text-slate-900">{stats.total_equipment}</div>
            <div className="text-[10px] text-slate-500">Cataloged instruments</div>
          </CardContent>
        </Card>

        {/* 3. Currently Issued Equipment */}
        <Card className="hover:border-slate-300 transition-colors">
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-[11px] font-semibold uppercase tracking-wider">On Loan</span>
              <PackageCheck className="w-4 h-4 text-blue-600" />
            </div>
            <div className="text-2xl font-bold text-blue-700">{stats.currently_issued}</div>
            <div className="text-[10px] text-slate-500">Currently issued out</div>
          </CardContent>
        </Card>

        {/* 4. Available Equipment */}
        <Card className="hover:border-slate-300 transition-colors">
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-[11px] font-semibold uppercase tracking-wider">Available</span>
              <PackagePlus className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="text-2xl font-bold text-emerald-700">{stats.available_equipment}</div>
            <div className="text-[10px] text-emerald-600 font-medium">Ready for immediate issue</div>
          </CardContent>
        </Card>

        {/* 5. Overdue Equipment */}
        <Card className="hover:border-slate-300 transition-colors">
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-[11px] font-semibold uppercase tracking-wider">Overdue</span>
              <AlertTriangle className="w-4 h-4 text-amber-600" />
            </div>
            <div className="text-2xl font-bold text-amber-700">{stats.overdue_equipment}</div>
            <div className="text-[10px] text-amber-700 font-medium">Past return deadline</div>
          </CardContent>
        </Card>

        {/* 6. Damaged / Maintenance Items */}
        <Card className="hover:border-slate-300 transition-colors">
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-[11px] font-semibold uppercase tracking-wider">Damaged/Repair</span>
              <Wrench className="w-4 h-4 text-rose-600" />
            </div>
            <div className="text-2xl font-bold text-rose-700">{stats.damaged_equipment}</div>
            <div className="text-[10px] text-slate-500">Under repair/inspection</div>
          </CardContent>
        </Card>

        {/* 7. Today's Fingerprint Scans */}
        <Card className="hover:border-slate-300 transition-colors">
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-[11px] font-semibold uppercase tracking-wider">Today's Scans</span>
              <Fingerprint className="w-4 h-4 text-[#1B4998]" />
            </div>
            <div className="text-2xl font-bold text-[#1B4998]">{stats.today_scans}</div>
            <div className="text-[10px] text-slate-500">Biometric sensor hits</div>
          </CardContent>
        </Card>
      </div>

      {/* Main Grid: Realtime Scans & Active Loans */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (2 Cols): Scans & Issued Items */}
        <div className="lg:col-span-2 space-y-6">
          {/* Live Recent Fingerprint Scans Table */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Fingerprint className="w-4 h-4 text-[#1B4998]" />
                <CardTitle>Live Fingerprint Scan Events</CardTitle>
              </div>
              <Link
                href="/scans"
                className="text-xs font-semibold text-[#1B4998] hover:underline flex items-center gap-1"
              >
                <span>View All Scans</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </CardHeader>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-100 text-slate-500 uppercase text-[10px] font-semibold tracking-wider">
                  <tr>
                    <th className="px-5 py-3">Timestamp</th>
                    <th className="px-5 py-3">Template ID</th>
                    <th className="px-5 py-3">Student Name</th>
                    <th className="px-5 py-3">Reg Number</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {recentScans.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-5 py-8 text-center text-slate-400">
                        No scan events recorded today. Place finger on sensor or run simulator.
                      </td>
                    </tr>
                  ) : (
                    recentScans.map(scan => (
                      <tr key={scan.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="px-5 py-3 text-slate-500 whitespace-nowrap">
                          {formatTime(scan.created_at)}
                        </td>
                        <td className="px-5 py-3 font-mono font-medium text-slate-900">
                          #{scan.template_id}
                          {scan.is_test && (
                            <span className="ml-1 text-[9px] px-1 py-0.2 rounded bg-amber-100 text-amber-800">
                              TEST
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-3 font-medium text-slate-900">
                          {scan.student?.full_name || (
                            <span className="text-slate-400 italic">Unmapped / Guest</span>
                          )}
                        </td>
                        <td className="px-5 py-3 font-mono text-slate-600">
                          {scan.student?.reg_number || '-'}
                        </td>
                        <td className="px-5 py-3">
                          <StatusBadge status={scan.status} />
                        </td>
                        <td className="px-5 py-3 text-right">
                          {scan.student ? (
                            <Link
                              href={`/issue?studentId=${scan.student.id}`}
                              className="text-xs font-semibold text-[#1B4998] hover:underline"
                            >
                              Issue to Student
                            </Link>
                          ) : (
                            <Link
                              href="/scans"
                              className="text-xs text-slate-400 hover:text-slate-600"
                            >
                              Details
                            </Link>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Currently Issued Equipment Table */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Cpu className="w-4 h-4 text-slate-700" />
                <CardTitle>Equipment Currently On Loan</CardTitle>
              </div>
              <Link
                href="/equipment?filter=issued"
                className="text-xs font-semibold text-[#1B4998] hover:underline flex items-center gap-1"
              >
                <span>View All Inventory</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </CardHeader>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-100 text-slate-500 uppercase text-[10px] font-semibold tracking-wider">
                  <tr>
                    <th className="px-5 py-3">Asset ID</th>
                    <th className="px-5 py-3">Equipment Name</th>
                    <th className="px-5 py-3">Issued To</th>
                    <th className="px-5 py-3">Due Date</th>
                    <th className="px-5 py-3 text-right">Return Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {issuedEquipment.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-5 py-8 text-center text-slate-400">
                        No equipment is currently issued out. All items available in storage.
                      </td>
                    </tr>
                  ) : (
                    issuedEquipment.map(item => (
                      <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="px-5 py-3 font-mono font-semibold text-[#1B4998]">
                          {item.asset_id}
                        </td>
                        <td className="px-5 py-3 font-medium text-slate-900 max-w-[200px] truncate">
                          {item.name}
                        </td>
                        <td className="px-5 py-3">
                          <div className="font-medium text-slate-800">
                            {item.current_borrower?.student_name || 'Student'}
                          </div>
                          <div className="font-mono text-[10px] text-slate-400">
                            {item.current_borrower?.reg_number}
                          </div>
                        </td>
                        <td className="px-5 py-3 text-slate-600 whitespace-nowrap">
                          {formatDate(item.current_borrower?.due_at)}
                        </td>
                        <td className="px-5 py-3 text-right">
                          <Link href="/return">
                            <Button size="sm" variant="secondary" className="h-7 text-xs">
                              Return
                            </Button>
                          </Link>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>

        {/* Right Column: Hardware Telemetry & Overdue Alerts */}
        <div className="space-y-6">
          {/* Hardware & API Status Card */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Radio className="w-4 h-4 text-[#1B4998]" />
                <CardTitle>ESP32 Hardware Telemetry</CardTitle>
              </div>
              <Link href="/device" className="text-xs text-[#1B4998] hover:underline">
                Diagnostic
              </Link>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div
                    className={`w-3 h-3 rounded-full ${
                      deviceTelemetry.online ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'
                    }`}
                  />
                  <span className="font-semibold text-xs text-slate-800">Controller State</span>
                </div>
                <span
                  className={`text-xs font-bold ${
                    deviceTelemetry.online ? 'text-emerald-700' : 'text-rose-700'
                  }`}
                >
                  {deviceTelemetry.online ? 'Online & Transmitting' : 'Disconnected / Offline'}
                </span>
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex justify-between py-1">
                  <span className="text-slate-500">Device ID</span>
                  <span className="font-mono font-medium text-slate-800">
                    {deviceTelemetry.deviceId}
                  </span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-slate-500">IP Address</span>
                  <span className="font-mono text-slate-800">
                    {deviceTelemetry.ipAddress || '192.168.1.150'}
                  </span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-slate-500">Firmware</span>
                  <span className="font-mono text-slate-800">
                    v{deviceTelemetry.firmwareVersion || '1.2.0'}
                  </span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-slate-500">Last Heartbeat</span>
                  <span className="text-slate-800 font-medium">
                    {deviceTelemetry.lastSeen ? formatTime(deviceTelemetry.lastSeen) : 'Never'}
                  </span>
                </div>
              </div>

              <div className="pt-2">
                <Link href="/scans">
                  <Button variant="outline" size="sm" className="w-full text-xs">
                    Biometric Enrollment & Scan Test
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>

          {/* Overdue Loans Alert Panel */}
          <Card className="border-amber-200">
            <CardHeader className="bg-amber-50/50 border-amber-100">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                <CardTitle className="text-amber-900">Overdue Equipment Loans</CardTitle>
              </div>
              <span className="text-xs font-bold text-amber-700">
                {overdueTransactions.length} items
              </span>
            </CardHeader>
            <CardContent className="p-4">
              {overdueTransactions.length === 0 ? (
                <div className="text-xs text-slate-500 py-3 text-center">
                  ✅ No equipment is currently overdue. All loans are within scheduled return
                  windows.
                </div>
              ) : (
                <div className="space-y-3">
                  {overdueTransactions.map(trans => (
                    <div
                      key={trans.id}
                      className="p-3 rounded-lg bg-amber-50/80 border border-amber-200 text-xs space-y-1.5"
                    >
                      <div className="flex justify-between font-semibold text-amber-950">
                        <span>{trans.equipment?.asset_id}</span>
                        <span className="text-rose-600">Past Due</span>
                      </div>
                      <div className="text-slate-700 font-medium">{trans.equipment?.name}</div>
                      <div className="flex justify-between text-[11px] text-slate-600 pt-1 border-t border-amber-200/50">
                        <span>Borrower: {trans.student?.full_name}</span>
                        <span className="font-mono">{trans.student?.reg_number}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
