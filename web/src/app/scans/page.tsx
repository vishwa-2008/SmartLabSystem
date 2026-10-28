'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { StatusBadge } from '@/components/ui/Badge';
import { useData } from '@/context/DataContext';
import { useAuth } from '@/context/AuthContext';
import { formatDate, formatTime } from '@/lib/utils';
import {
  Fingerprint,
  Search,
  Filter,
  CheckCircle2,
  AlertCircle,
  Clock,
  Play,
  RotateCw,
  ExternalLink,
  ShieldCheck,
  PackagePlus
} from 'lucide-react';

export default function ScansAuditPage() {
  const router = useRouter();
  const { isHOD } = useAuth();
  const {
    scans,
    deviceTelemetry,
    simulateHardwareScan,
    refreshAll,
    isLoading
  } = useData();

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [isSimulating, setIsSimulating] = useState<boolean>(false);
  const [simTemplateId, setSimTemplateId] = useState<number>(1);

  // Filtered scans
  const filteredScans = scans.filter(scan => {
    const matchesStatus = statusFilter === 'all' || scan.status === statusFilter;
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      !searchQuery ||
      scan.template_id.toString().includes(q) ||
      scan.student?.full_name?.toLowerCase().includes(q) ||
      scan.student?.reg_number?.toLowerCase().includes(q);
    return matchesStatus && matchesSearch;
  });

  const handleSimulateScan = async () => {
    setIsSimulating(true);
    await simulateHardwareScan(simTemplateId, true);
    await refreshAll();
    setIsSimulating(false);
  };

  return (
    <AppLayout title="Biometric Scans Log">
      <div className="space-y-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <Fingerprint className="w-7 h-7 text-[#1B4998]" />
              Biometric Scan Logs
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Real-time audit log of all optical sensor transactions and student identification attempts.
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <Link href="/scan">
              <Button
                size="sm"
                className="bg-[#1B4998] hover:bg-[#143775] text-white flex items-center gap-2 shadow-xs"
              >
                <Fingerprint className="w-4 h-4" />
                Open Live Scan Terminal
                <ExternalLink className="w-3.5 h-3.5 ml-1" />
              </Button>
            </Link>

            {isHOD && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleSimulateScan}
                disabled={isSimulating}
                className="flex items-center gap-1.5"
              >
                <Play className="w-3.5 h-3.5 text-slate-600" />
                {isSimulating ? 'Testing...' : 'Test Scan (Slot #1)'}
              </Button>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={() => refreshAll()}
              className="flex items-center gap-1.5"
            >
              <RotateCw className="w-3.5 h-3.5" />
              Refresh
            </Button>
          </div>
        </div>

        {/* Telemetry Status Banner */}
        <Card className="border-slate-200 shadow-xs">
          <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span
                className={`w-3 h-3 rounded-full ${
                  deviceTelemetry.online ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'
                }`}
              />
              <div>
                <span className="text-xs font-bold text-slate-800">
                  Sensor Controller ({deviceTelemetry.deviceId}) —{' '}
                  <span className={deviceTelemetry.online ? 'text-emerald-700' : 'text-rose-700'}>
                    {deviceTelemetry.online ? 'Online & Listening' : 'Offline / Reconnecting'}
                  </span>
                </span>
                <p className="text-xs text-slate-500">
                  {deviceTelemetry.online
                    ? `Last heartbeat: ${deviceTelemetry.lastSeen ? new Date(deviceTelemetry.lastSeen).toLocaleTimeString() : 'Just now'} • Firmware ${deviceTelemetry.firmwareVersion || '1.2.0'}`
                    : 'The ESP32 controller has not checked in during the last 60 seconds.'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs text-slate-600">
              <span className="font-semibold text-slate-800">{scans.length}</span> total logs captured
            </div>
          </CardContent>
        </Card>

        {/* Filters */}
        <Card className="border-slate-200 shadow-xs">
          <CardContent className="p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="w-full sm:w-80 relative">
              <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
              <input
                type="text"
                placeholder="Search by student name, reg number, or slot #..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1B4998]"
              />
            </div>

            <div className="w-full sm:w-auto flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-500 whitespace-nowrap">Filter Status:</span>
              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                className="px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1B4998]"
              >
                <option value="all">All Statuses</option>
                <option value="matched">Matched Students</option>
                <option value="not_found">Unregistered Fingerprint</option>
                <option value="error">Sensor Errors</option>
              </select>
            </div>
          </CardContent>
        </Card>

        {/* Scans Table */}
        <Card className="border-slate-200 shadow-xs overflow-hidden">
          <CardHeader className="bg-slate-50/70 border-b border-slate-200 py-3.5 px-6">
            <CardTitle className="text-base font-semibold text-slate-800">
              Scan Events History ({filteredScans.length})
            </CardTitle>
          </CardHeader>

          {filteredScans.length === 0 ? (
            <div className="p-12 text-center">
              <Fingerprint className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <h3 className="text-base font-bold text-slate-900">No Scan Events Found</h3>
              <p className="text-sm text-slate-500 mt-1 max-w-sm mx-auto">
                No biometric events matched your current search and filter settings.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 text-xs font-semibold uppercase tracking-wider">
                    <th className="py-3 px-4">Timestamp</th>
                    <th className="py-3 px-4">Sensor Slot</th>
                    <th className="py-3 px-4">Identified Student</th>
                    <th className="py-3 px-4">Department & Section</th>
                    <th className="py-3 px-4">Device ID</th>
                    <th className="py-3 px-4">Match Status</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredScans.map(scan => {
                    const student = scan.student;
                    return (
                      <tr key={scan.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3.5 px-4 whitespace-nowrap text-xs text-slate-600 font-mono">
                          {new Date(scan.created_at).toLocaleString()}
                        </td>

                        <td className="py-3.5 px-4 font-mono font-semibold text-xs text-slate-800">
                          #{scan.template_id}
                        </td>

                        <td className="py-3.5 px-4">
                          {student ? (
                            <div>
                              <div className="font-semibold text-slate-900">{student.full_name}</div>
                              <div className="text-xs font-mono text-[#1B4998]">{student.reg_number}</div>
                            </div>
                          ) : scan.status === 'matched' ? (
                            <div className="text-xs text-slate-600 font-medium">Mapped Student #{scan.template_id}</div>
                          ) : (
                            <div className="text-xs text-rose-600 font-medium italic">Unrecognized Print</div>
                          )}
                        </td>

                        <td className="py-3.5 px-4 text-xs text-slate-600">
                          {student ? `${student.department} • Sec ${student.section}` : '—'}
                        </td>

                        <td className="py-3.5 px-4 text-xs font-mono text-slate-500">
                          {scan.device_id || 'esp32-lab-01'}
                          {scan.is_test && <span className="ml-1 text-[10px] text-amber-600 bg-amber-50 px-1 py-0.5 rounded">TEST</span>}
                        </td>

                        <td className="py-3.5 px-4">
                          <StatusBadge status={scan.status} />
                        </td>

                        <td className="py-3.5 px-4 text-right">
                          {student ? (
                            <Link href={`/issue?studentId=${student.id}`}>
                              <Button size="sm" variant="outline" className="text-xs py-1 px-2.5">
                                <PackagePlus className="w-3.5 h-3.5 mr-1 text-[#1B4998]" />
                                Issue Item
                              </Button>
                            </Link>
                          ) : (
                            <span className="text-xs text-slate-400">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </AppLayout>
  );
}
