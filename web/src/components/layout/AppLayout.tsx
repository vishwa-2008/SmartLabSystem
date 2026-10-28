'use client';

import React, { useState } from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { useAuth } from '@/context/AuthContext';
import { Loader2 } from 'lucide-react';
import Link from 'next/link';

interface AppLayoutProps {
  children: React.ReactNode;
  title?: string;
}

export function AppLayout({ children, title }: AppLayoutProps) {
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);
  const [mobileOpen, setMobileOpen] = useState<boolean>(false);
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#F5F7FB] flex flex-col items-center justify-center p-4">
        <div className="w-12 h-12 rounded-xl bg-[#1B4998] text-white flex items-center justify-center font-bold text-xl mb-4 shadow-sm">
          K
        </div>
        <div className="flex items-center gap-2 text-slate-600 text-sm font-medium">
          <Loader2 className="w-4 h-4 animate-spin text-[#1B4998]" />
          <span>Loading KARE Laboratory Portal...</span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#F5F7FB] flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-xl border border-slate-200 shadow-sm p-6 text-center space-y-4">
          <div className="w-12 h-12 rounded-xl bg-[#1B4998] text-white flex items-center justify-center font-bold text-xl mx-auto shadow-sm">
            K
          </div>
          <h2 className="text-lg font-bold text-slate-900">Authentication Required</h2>
          <p className="text-xs text-slate-500 leading-relaxed">
            Please sign in with your authorized university staff credentials to access the laboratory equipment management system.
          </p>
          <Link
            href="/login"
            className="inline-flex items-center justify-center w-full px-4 py-2 text-sm font-medium text-white bg-[#1B4998] rounded-md hover:bg-[#153a7a] transition-colors"
          >
            Go to Staff Login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F5F7FB] flex">
      <Sidebar
        isCollapsed={isCollapsed}
        setIsCollapsed={setIsCollapsed}
        mobileOpen={mobileOpen}
        setMobileOpen={setMobileOpen}
      />
      <div className="flex-1 flex flex-col min-w-0">
        <Header onMenuClick={() => setMobileOpen(true)} />
        <main className="flex-1 p-4 sm:p-6 max-w-7xl w-full mx-auto space-y-6">
          {children}
        </main>
      </div>
    </div>
  );
}
