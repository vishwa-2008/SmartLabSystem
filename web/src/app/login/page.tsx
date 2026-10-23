'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Alert } from '@/components/ui/Alert';
import { ShieldCheck, UserCheck, KeyRound, ArrowRight } from 'lucide-react';
import { StaffRole } from '@/types';

export default function LoginPage() {
  const router = useRouter();
  const { signIn, error } = useAuth();
  const [email, setEmail] = useState<string>('hod.ece@klu.ac.in');
  const [password, setPassword] = useState<string>('password123');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setLocalError('Please enter your university email');
      return;
    }
    setLocalError(null);
    setIsSubmitting(true);

    const success = await signIn(email);
    setIsSubmitting(false);

    if (success) {
      router.push('/dashboard');
    }
  };

  const handleQuickDemoLogin = async (role: StaffRole, demoEmail: string) => {
    setEmail(demoEmail);
    setIsSubmitting(true);
    setLocalError(null);

    const success = await signIn(demoEmail, role);
    setIsSubmitting(false);

    if (success) {
      router.push('/dashboard');
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F7FB] flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        {/* University Crest / Logo Icon */}
        <div className="w-16 h-16 rounded-2xl bg-[#1B4998] text-white flex items-center justify-center font-bold text-2xl mx-auto shadow-md mb-4 border-2 border-white/40">
          K
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          KARE SMART LABORATORY
        </h1>
        <p className="text-xs font-medium text-slate-500 mt-1 uppercase tracking-wider">
          Equipment Circulation & Biometric Access Portal
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4 sm:px-0">
        <div className="bg-white py-8 px-6 shadow-sm border border-slate-200 rounded-xl sm:px-10 space-y-6">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Staff Portal Authentication
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Access restricted to verified university laboratory personnel.
            </p>
          </div>

          {(error || localError) && (
            <Alert variant="danger" title="Authentication Error">
              {error || localError}
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="University Email"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="name@klu.ac.in"
              required
            />

            <Input
              label="Password"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />

            <Button
              type="submit"
              className="w-full mt-2"
              isLoading={isSubmitting}
              rightIcon={<ArrowRight className="w-4 h-4" />}
            >
              Sign In to Portal
            </Button>
          </form>

          {/* Quick Demo Credentials Selector */}
          <div className="pt-4 border-t border-slate-100">
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-3 text-center">
              Evaluation & Demonstration Presets
            </div>
            <div className="grid grid-cols-1 gap-2">
              <button
                type="button"
                onClick={() => handleQuickDemoLogin('HOD', 'hod.ece@klu.ac.in')}
                className="flex items-center justify-between p-3 rounded-lg border border-slate-200 hover:border-[#1B4998] hover:bg-blue-50/40 text-left transition-all cursor-pointer group"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-md bg-[#1B4998]/10 text-[#1B4998] flex items-center justify-center shrink-0">
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-xs font-semibold text-slate-900 block group-hover:text-[#1B4998]">
                      Sign in as HOD
                    </span>
                    <span className="text-[10px] text-slate-500">Dr. S. Ramanathan (Full Admin)</span>
                  </div>
                </div>
                <KeyRound className="w-4 h-4 text-slate-300 group-hover:text-[#1B4998]" />
              </button>

              <button
                type="button"
                onClick={() => handleQuickDemoLogin('lab_incharge', 'vijayakumar.lab@klu.ac.in')}
                className="flex items-center justify-between p-3 rounded-lg border border-slate-200 hover:border-[#1B4998] hover:bg-blue-50/40 text-left transition-all cursor-pointer group"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-md bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
                    <UserCheck className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-xs font-semibold text-slate-900 block group-hover:text-[#1B4998]">
                      Sign in as Lab In-Charge
                    </span>
                    <span className="text-[10px] text-slate-500">Er. K. Vijayakumar (Circulation)</span>
                  </div>
                </div>
                <KeyRound className="w-4 h-4 text-slate-300 group-hover:text-[#1B4998]" />
              </button>
            </div>
          </div>
        </div>

        <div className="text-center mt-6 text-xs text-slate-400">
          Kalasalingam Academy of Research and Education • Smart Laboratory Division
        </div>
      </div>
    </div>
  );
}
