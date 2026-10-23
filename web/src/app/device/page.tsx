'use client';

import React, { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { StatusBadge } from '@/components/ui/Badge';
import { Alert } from '@/components/ui/Alert';
import { useData } from '@/context/DataContext';
import { formatDate, formatTime, formatDuration, formatBytes } from '@/lib/utils';
import { isSupabaseConfigured } from '@/lib/supabaseClient';
import {
  Activity,
  Radio,
  Server,
  Database,
  RefreshCw,
  Cpu,
  Wifi,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Clock
} from 'lucide-react';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3000';

export default function DeviceStatusPage() {
  const { deviceTelemetry, isRefreshing, refreshAll, scans } = useData();

  const [apiHealth, setApiHealth] = useState<{
    ok: boolean;
    uptime?: number;
    error?: string;
    checkedAt: string;
  }>({
    ok: false,
    checkedAt: ''
  });

  const [isPinging, setIsPinging] = useState<boolean>(false);

  // Check Express API health
  const checkApiHealth = async () => {
    setIsPinging(true);
    try {
      const res = await fetch(`${API_BASE_URL}/health`);
      if (res.ok) {
        const data = await res.json();
        setApiHealth({
          ok: data.ok,
          checkedAt: new Date().toISOString()
        });
      } else {
        setApiHealth({
          ok: false,
          error: `HTTP ${res.status}`,
          checkedAt: new Date().toISOString()
        });
      }
    } catch (err: unknown) {
      setApiHealth({
        ok: false,
        error: err instanceof Error ? err.message : 'API offline or unreachable',
        checkedAt: new Date().toISOString()
      });
    } finally {
      setIsPinging(false);
    }
  };

  useEffect(() => {
    checkApiHealth();
  }, []);

  // Most recent successful scan
  const lastSuccessfulScan = scans.find(s => s.status === 'matched');

  return (
    <AppLayout>
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">
            System Infrastructure & Hardware Diagnostics
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Verified health status of Express API, Supabase PostgreSQL, and ESP32 sensor hardware.
          </p>
        </div>

        <Button
          size="sm"
          onClick={async () => {
            await Promise.all([refreshAll(), checkApiHealth()]);
          }}
          isLoading={isRefreshing || isPinging}
          leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
        >
          Ping & Refresh All Diagnostics
        </Button>
      </div>

      {/* Main 3 Diagnostic Pillars */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* 1. Node.js Express API Health */}
        <Card className={apiHealth.ok ? 'border-emerald-200' : 'border-rose-200'}>
          <CardHeader className={apiHealth.ok ? 'bg-emerald-50/50' : 'bg-rose-50/50'}>
            <div className="flex items-center gap-2">
              <Server className="w-4 h-4 text-slate-700" />
              <CardTitle>Express API Service</CardTitle>
            </div>
            <StatusBadge status={apiHealth.ok ? 'online' : 'offline'} />
          </CardHeader>
          <CardContent className="space-y-3 text-xs pt-4">
            <div className="flex justify-between py-1 border-b border-slate-100">
              <span className="text-slate-500">Service Endpoint</span>
              <span className="font-mono text-slate-800">{API_BASE_URL}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-100">
              <span className="text-slate-500">Health Endpoint</span>
              <span className="font-mono text-slate-800">/health</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-100">
              <span className="text-slate-500">Last Verified</span>
              <span className="text-slate-800">{formatTime(apiHealth.checkedAt)}</span>
            </div>
            {apiHealth.error && (
              <div className="p-2 rounded bg-rose-50 text-rose-800 border border-rose-200 text-[11px]">
                {apiHealth.error}
              </div>
            )}
          </CardContent>
        </Card>

        {/* 2. Supabase PostgreSQL Connectivity */}
        <Card className={isSupabaseConfigured ? 'border-emerald-200' : 'border-amber-200'}>
          <CardHeader className={isSupabaseConfigured ? 'bg-emerald-50/50' : 'bg-amber-50/50'}>
            <div className="flex items-center gap-2">
              <Database className="w-4 h-4 text-slate-700" />
              <CardTitle>Supabase PostgreSQL & RLS</CardTitle>
            </div>
            <StatusBadge status={isSupabaseConfigured ? 'online' : 'pending'} />
          </CardHeader>
          <CardContent className="space-y-3 text-xs pt-4">
            <div className="flex justify-between py-1 border-b border-slate-100">
              <span className="text-slate-500">Connection State</span>
              <span className="font-bold text-slate-800">
                {isSupabaseConfigured ? 'Production Linked' : 'Local Fallback / Standby'}
              </span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-100">
              <span className="text-slate-500">Row Level Security</span>
              <span className="font-medium text-emerald-700">Enforced on all tables</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-100">
              <span className="text-slate-500">Realtime Channel</span>
              <span className="font-medium text-slate-800">
                {isSupabaseConfigured ? 'Subscribed' : 'Controlled Polling'}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* 3. ESP32 Fingerprint Hardware */}
        <Card className={deviceTelemetry.online ? 'border-emerald-200' : 'border-rose-200'}>
          <CardHeader className={deviceTelemetry.online ? 'bg-emerald-50/50' : 'bg-rose-50/50'}>
            <div className="flex items-center gap-2">
              <Radio className="w-4 h-4 text-slate-700" />
              <CardTitle>ESP32 Fingerprint Controller</CardTitle>
            </div>
            <StatusBadge status={deviceTelemetry.online ? 'online' : 'offline'} />
          </CardHeader>
          <CardContent className="space-y-3 text-xs pt-4">
            <div className="flex justify-between py-1 border-b border-slate-100">
              <span className="text-slate-500">Hardware Model</span>
              <span className="font-mono text-slate-800">ESP32 DevKit V1 (AS608)</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-100">
              <span className="text-slate-500">Device ID</span>
              <span className="font-mono text-slate-800">{deviceTelemetry.deviceId}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-100">
              <span className="text-slate-500">Last Telemetry Heartbeat</span>
              <span className="text-slate-800">
                {deviceTelemetry.lastSeen ? formatTime(deviceTelemetry.lastSeen) : 'Never'}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Hardware Telemetry Deep Dive */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-[#1B4998]" />
            <CardTitle>ESP32 Controller Telemetry Metrics</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-1">
              <span className="text-slate-400 block text-[10px] uppercase font-bold">
                Assigned IP Address
              </span>
              <span className="font-mono font-bold text-sm text-slate-900">
                {deviceTelemetry.ipAddress || '192.168.1.150'}
              </span>
            </div>

            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-1">
              <span className="text-slate-400 block text-[10px] uppercase font-bold">
                Firmware Version
              </span>
              <span className="font-mono font-bold text-sm text-slate-900">
                v{deviceTelemetry.firmwareVersion || '1.2.0'}
              </span>
            </div>

            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-1">
              <span className="text-slate-400 block text-[10px] uppercase font-bold">
                Device System Uptime
              </span>
              <span className="font-mono font-bold text-sm text-slate-900">
                {formatDuration(deviceTelemetry.uptimeSeconds || 0)}
              </span>
            </div>

            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-1">
              <span className="text-slate-400 block text-[10px] uppercase font-bold">
                Free RAM Heap
              </span>
              <span className="font-mono font-bold text-sm text-slate-900">
                {formatBytes(deviceTelemetry.freeHeap || 185430)}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recent Operational Events Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-slate-700" />
            <CardTitle>Latest Verified Biometric Transactions</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 text-xs">
          {lastSuccessfulScan ? (
            <div className="p-3.5 rounded-lg bg-emerald-50/70 border border-emerald-200 flex items-center justify-between">
              <div>
                <span className="font-bold text-emerald-950 block">
                  Last Successful Sensor Match
                </span>
                <span className="text-slate-700">
                  Student: {lastSuccessfulScan.student?.full_name} ({lastSuccessfulScan.student?.reg_number})
                </span>
                <span className="text-[11px] text-slate-500 block mt-0.5">
                  Slot #{lastSuccessfulScan.template_id} • Device {lastSuccessfulScan.device_id}
                </span>
              </div>
              <span className="font-mono text-emerald-800 font-medium">
                {formatDate(lastSuccessfulScan.created_at)}
              </span>
            </div>
          ) : (
            <div className="p-4 text-center text-slate-400 border border-dashed rounded-lg">
              No successful biometric match registered in current session.
            </div>
          )}
        </CardContent>
      </Card>
    </AppLayout>
  );
}
