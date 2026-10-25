'use client';

import React, { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import {
  Menu,
  Clock,
  Radio,
  WifiOff,
  Bell,
  RefreshCw,
  UserCheck,
  LogOut,
  ChevronDown
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useData } from '@/context/DataContext';
import { cn } from '@/lib/utils';

interface HeaderProps {
  onMenuClick: () => void;
}

export function Header({ onMenuClick }: HeaderProps) {
  const pathname = usePathname();
  const { currentUser, signOut } = useAuth();
  const { deviceTelemetry, isRefreshing, refreshAll, stats } = useData();
  const [currentTime, setCurrentTime] = useState<string>('');
  const [currentDate, setCurrentDate] = useState<string>('');
  const [notificationsOpen, setNotificationsOpen] = useState<boolean>(false);
  const [roleSwitcherOpen, setRoleSwitcherOpen] = useState<boolean>(false);

  // Live browser clock update
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString('en-IN', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true
        })
      );
      setCurrentDate(
        now.toLocaleDateString('en-IN', {
          weekday: 'short',
          day: 'numeric',
          month: 'short',
          year: 'numeric'
        })
      );
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Compute readable page title and breadcrumb from route
  const getPageMeta = () => {
    switch (pathname) {
      case '/dashboard':
        return { title: 'Laboratory Operational Overview', section: 'Dashboard' };
      case '/scans':
        return { title: 'Fingerprint Scans & Enrollment', section: 'Biometrics' };
      case '/students':
        return { title: 'Student Laboratory Directory', section: 'Students' };
      case '/equipment':
        return { title: 'Lab Equipment Inventory', section: 'Inventory' };
      case '/issue':
        return { title: 'Issue Lab Equipment', section: 'Circulation' };
      case '/return':
        return { title: 'Return Equipment & Inspection', section: 'Circulation' };
      case '/transactions':
        return { title: 'Circulation Transaction Audit Log', section: 'Audit' };
      case '/reports':
        return { title: 'Equipment Utilization & Reports', section: 'Analytics' };
      case '/staff':
        return { title: 'Staff Authorization & Accounts', section: 'Administration' };
      case '/device':
        return { title: 'ESP32 Device & System Telemetry', section: 'Diagnostics' };
      case '/settings':
        return { title: 'Laboratory Portal Configuration', section: 'Settings' };
      default:
        return { title: 'Smart Lab Equipment System', section: 'Portal' };
    }
  };

  const { title, section } = getPageMeta();
  const hasAlerts = stats.overdue_equipment > 0 || !deviceTelemetry.online;

  return (
    <header className="h-16 bg-white border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between sticky top-0 z-30">
      {/* Left Section: Mobile toggle, Breadcrumb & Title */}
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuClick}
          className="p-2 -ml-2 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 lg:hidden cursor-pointer"
          aria-label="Open navigation menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="flex flex-col">
          <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-400">
            <span>KARE Smart Lab</span>
            <span>/</span>
            <span className="text-[#1B4998] font-semibold">{section}</span>
          </div>
          <h1 className="text-sm sm:text-base font-bold text-slate-900 leading-tight">
            {title}
          </h1>
        </div>
      </div>

      {/* Right Section: Time, Hardware Status, Role Switcher, Profile */}
      <div className="flex items-center gap-2 sm:gap-4">
        {/* Live Date/Time Badge */}
        <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-600">
          <Clock className="w-3.5 h-3.5 text-[#1B4998]" />
          <span className="font-medium text-slate-800">{currentTime}</span>
          <span className="text-slate-300">|</span>
          <span className="text-slate-500">{currentDate}</span>
        </div>

        {/* Hardware Status Indicator */}
        <div
          className={cn(
            'flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border',
            deviceTelemetry.online
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-rose-50 text-rose-800 border-rose-200'
          )}
          title={`ESP32 Hardware: ${deviceTelemetry.online ? 'Online and transmitting telemetry' : 'Offline / Standby'}`}
        >
          {deviceTelemetry.online ? (
            <>
              <Radio className="w-3.5 h-3.5 text-emerald-600 animate-pulse" />
              <span className="hidden sm:inline">ESP32 Online</span>
            </>
          ) : (
            <>
              <WifiOff className="w-3.5 h-3.5 text-rose-600" />
              <span className="hidden sm:inline">ESP32 Offline</span>
            </>
          )}
        </div>

        {/* Manual Refresh Button */}
        <button
          onClick={() => refreshAll()}
          disabled={isRefreshing}
          className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
          title="Refresh Data & Device Status"
        >
          <RefreshCw className={cn('w-4 h-4', isRefreshing && 'animate-spin text-[#1B4998]')} />
        </button>

        {/* Notifications Popover Toggle */}
        <div className="relative">
          <button
            onClick={() => setNotificationsOpen(!notificationsOpen)}
            className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors relative cursor-pointer"
            title="Operational Alerts"
          >
            <Bell className="w-4 h-4" />
            {hasAlerts && (
              <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-rose-500 ring-2 ring-white" />
            )}
          </button>

          {notificationsOpen && (
            <div className="absolute right-0 mt-2 w-72 bg-white rounded-lg shadow-lg border border-slate-200 p-3 z-50 text-xs animate-in fade-in zoom-in-95">
              <div className="font-semibold text-slate-800 pb-2 mb-2 border-b border-slate-100 flex items-center justify-between">
                <span>Operational Alerts</span>
                <span className="text-[10px] text-slate-400">Live</span>
              </div>
              <div className="space-y-2">
                {stats.overdue_equipment > 0 && (
                  <div className="p-2 rounded bg-amber-50 border border-amber-200 text-amber-900">
                    <span className="font-semibold block">⚠️ Overdue Equipment</span>
                    <span>{stats.overdue_equipment} asset(s) are past their due return time.</span>
                  </div>
                )}
                {!deviceTelemetry.online && (
                  <div className="p-2 rounded bg-rose-50 border border-rose-200 text-rose-900">
                    <span className="font-semibold block">📡 ESP32 Controller Offline</span>
                    <span>Device has not reported a heartbeat in the last 60 seconds.</span>
                  </div>
                )}
                {stats.overdue_equipment === 0 && deviceTelemetry.online && (
                  <div className="p-2 text-center text-slate-500">
                    All lab systems and loans operational. No critical alerts.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Authenticated Staff User Menu */}
        <div className="relative">
          <button
            onClick={() => setRoleSwitcherOpen(!roleSwitcherOpen)}
            className="flex items-center gap-2 px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
            title="User Profile & Sign Out"
          >
            <div className="w-5 h-5 rounded-full bg-[#1B4998] text-white flex items-center justify-center text-[10px] font-bold">
              {currentUser?.full_name?.charAt(0) || 'U'}
            </div>
            <span className="font-semibold text-slate-800 hidden md:inline">
              {currentUser?.full_name || 'Staff User'}
            </span>
            <span className={cn(
              "text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider",
              currentUser?.role === 'HOD' ? "bg-amber-100 text-amber-900 border border-amber-300" : "bg-blue-100 text-[#1B4998] border border-blue-200"
            )}>
              {currentUser?.role === 'HOD' ? 'HOD' : 'In-Charge'}
            </span>
            <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
          </button>

          {roleSwitcherOpen && (
            <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-xl border border-slate-200 p-3 z-50 text-xs">
              <div className="pb-2.5 mb-2.5 border-b border-slate-100">
                <div className="font-semibold text-slate-900">{currentUser?.full_name || 'Authenticated Staff'}</div>
                <div className="text-[11px] text-slate-500 truncate">{currentUser?.email || 'staff@klu.ac.in'}</div>
                <div className="mt-1 text-[10px] text-slate-400">
                  Role: <strong className="text-slate-700">{currentUser?.role === 'HOD' ? 'Head of Department' : 'Lab In-Charge'}</strong>
                </div>
              </div>
              <button
                onClick={async () => {
                  setRoleSwitcherOpen(false);
                  await signOut();
                }}
                className="w-full flex items-center gap-2 px-2.5 py-2 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer font-medium text-left"
              >
                <LogOut className="w-4 h-4" />
                <span>Sign Out of Portal</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
