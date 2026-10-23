'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { Loader2 } from 'lucide-react';

export default function RootPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading) {
      if (isAuthenticated) {
        router.replace('/dashboard');
      } else {
        router.replace('/login');
      }
    }
  }, [isAuthenticated, isLoading, router]);

  return (
    <div className="min-h-screen bg-[#F5F7FB] flex flex-col items-center justify-center p-4">
      <div className="w-12 h-12 rounded-xl bg-[#1B4998] text-white flex items-center justify-center font-bold text-xl mb-4 shadow-sm">
        K
      </div>
      <div className="flex items-center gap-2 text-slate-600 text-sm font-medium">
        <Loader2 className="w-4 h-4 animate-spin text-[#1B4998]" />
        <span>Initializing KARE Smart Lab Portal...</span>
      </div>
    </div>
  );
}
