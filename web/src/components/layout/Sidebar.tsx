'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Fingerprint,
  Users,
  Cpu,
  PackagePlus,
  PackageCheck,
  History,
  FileBarChart,
  UserCheck,
  Activity,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
  ShieldCheck
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';
import { useData } from '@/context/DataContext';

interface SidebarProps {
  isCollapsed: boolean;
  setIsCollapsed: (v: boolean) => void;
  mobileOpen: boolean;
  setMobileOpen: (v: boolean) => void;
}

export function Sidebar({
  isCollapsed,
  setIsCollapsed,
  mobileOpen,
  setMobileOpen
}: SidebarProps) {
  const pathname = usePathname();
  const { currentUser, isHOD, signOut } = useAuth();
  const { stats, deviceTelemetry } = useData();

  const navItems = [
    {
      name: 'Overview',
      href: '/dashboard',
      icon: LayoutDashboard,
      badge: null
    },
    {
      name: 'Fingerprint Scans',
      href: '/scans',
      icon: Fingerprint,
      badge: stats.today_scans > 0 ? stats.today_scans : null,
      badgeColor: 'bg-blue-100 text-[#1B4998]'
    },
    {
      name: 'Students',
      href: '/students',
      icon: Users,
      badge: stats.total_students,
      badgeColor: 'bg-slate-100 text-slate-700'
    },
    {
      name: 'Equipment Inventory',
      href: '/equipment',
      icon: Cpu,
      badge: stats.total_equipment,
      badgeColor: 'bg-slate-100 text-slate-700'
    },
    {
      name: 'Issue Equipment',
      href: '/issue',
      icon: PackagePlus,
      badge: stats.available_equipment > 0 ? `${stats.available_equipment} avail` : null,
      badgeColor: 'bg-emerald-100 text-emerald-800'
    },
    {
      name: 'Return Equipment',
      href: '/return',
      icon: PackageCheck,
      badge: stats.currently_issued > 0 ? `${stats.currently_issued} loaned` : null,
      badgeColor: 'bg-amber-100 text-amber-800'
    },
    {
      name: 'Transaction History',
      href: '/transactions',
      icon: History,
      badge: null
    },
    {
      name: 'Reports & Audit',
      href: '/reports',
      icon: FileBarChart,
      badge: null
    },
    // Staff Management (HOD Only)
    ...(isHOD
      ? [
          {
            name: 'Staff Management',
            href: '/staff',
            icon: UserCheck,
            badge: 'HOD',
            badgeColor: 'bg-indigo-100 text-indigo-800 font-semibold'
          }
        ]
      : []),
    {
      name: 'System / Device Status',
      href: '/device',
      icon: Activity,
      badge: deviceTelemetry.online ? 'Online' : 'Offline',
      badgeColor: deviceTelemetry.online
        ? 'bg-emerald-100 text-emerald-800'
        : 'bg-rose-100 text-rose-800'
    },
    {
      name: 'Settings',
      href: '/settings',
      icon: Settings,
      badge: null
    }
  ];

  return (
    <>
      {/* Mobile Drawer Overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-xs lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={cn(
          'fixed top-0 bottom-0 left-0 z-40 flex flex-col bg-white border-r border-slate-200 transition-all duration-200 ease-in-out lg:static',
          isCollapsed ? 'w-20' : 'w-64',
          mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
      >
        {/* Brand Header */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-slate-200">
          <Link
            href="/dashboard"
            className="flex items-center gap-3 overflow-hidden"
            onClick={() => setMobileOpen(false)}
          >
            <div className="w-10 h-10 rounded-lg bg-[#1B4998] text-white flex items-center justify-center font-bold text-lg shrink-0 shadow-xs">
              K
            </div>
            {!isCollapsed && (
              <div className="flex flex-col truncate">
                <span className="font-bold text-sm tracking-tight text-slate-900 leading-tight">
                  KARE SMART LAB
                </span>
                <span className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">
                  Equipment Portal
                </span>
              </div>
            )}
          </Link>

          {/* Desktop Collapse Button */}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="hidden lg:flex p-1.5 rounded-md hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
            aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>

        {/* Navigation Items */}
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          {navItems.map(item => {
            const isActive = pathname === item.href;
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  'group flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors relative',
                  isActive
                    ? 'bg-[#1B4998] text-white shadow-xs'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                )}
                title={isCollapsed ? item.name : undefined}
              >
                <Icon
                  className={cn(
                    'w-5 h-5 shrink-0 transition-colors',
                    isActive ? 'text-white' : 'text-slate-400 group-hover:text-slate-600'
                  )}
                />
                {!isCollapsed && (
                  <div className="flex items-center justify-between flex-1 truncate">
                    <span className="truncate">{item.name}</span>
                    {item.badge && (
                      <span
                        className={cn(
                          'text-[10px] px-2 py-0.5 rounded-full font-medium ml-2',
                          isActive ? 'bg-white/20 text-white' : item.badgeColor
                        )}
                      >
                        {item.badge}
                      </span>
                    )}
                  </div>
                )}
              </Link>
            );
          })}
        </div>

        {/* Staff Profile and Sign Out Section */}
        <div className="p-3 border-t border-slate-200 bg-slate-50/50">
          {!isCollapsed ? (
            <div className="space-y-3">
              <div className="flex items-center gap-3 px-2">
                <div className="w-8 h-8 rounded-full bg-[#1B4998]/10 text-[#1B4998] flex items-center justify-center font-bold text-xs shrink-0">
                  {currentUser?.full_name?.charAt(0) || 'U'}
                </div>
                <div className="truncate flex-1">
                  <div className="text-xs font-semibold text-slate-800 truncate">
                    {currentUser?.full_name || 'Staff Member'}
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <ShieldCheck className="w-3 h-3 text-[#1B4998]" />
                    <span className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">
                      {currentUser?.role === 'HOD' ? 'Head of Department' : 'Lab In-Charge'}
                    </span>
                  </div>
                </div>
              </div>
              <button
                onClick={signOut}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-xs font-medium text-rose-700 hover:bg-rose-50 transition-colors cursor-pointer"
              >
                <LogOut className="w-4 h-4 text-rose-600 shrink-0" />
                <span>Sign Out</span>
              </button>
            </div>
          ) : (
            <button
              onClick={signOut}
              className="w-full flex items-center justify-center p-2 rounded-md text-rose-700 hover:bg-rose-50 transition-colors cursor-pointer"
              title="Sign Out"
            >
              <LogOut className="w-5 h-5 text-rose-600" />
            </button>
          )}
        </div>
      </aside>
    </>
  );
}
