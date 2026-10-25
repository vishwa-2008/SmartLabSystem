'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Alert } from '@/components/ui/Alert';
import { ShieldCheck, ArrowRight, Lock } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const { signIn, error } = useAuth();
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setLocalError('Please enter both your university email and password');
      return;
    }
    setLocalError(null);
    setIsSubmitting(true);

    try {
      const success = await signIn(email.trim(), password);
      if (success) {
        router.push('/dashboard');
      }
    } finally {
      setIsSubmitting(false);
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
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-[#1B4998]" />
              <h2 className="text-base font-semibold text-slate-900">
                Staff Portal Authentication
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Access restricted to authorized Department Heads and Lab In-Charges.
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
              autoComplete="email"
              required
            />

            <Input
              label="Password"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
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

          <div className="pt-4 border-t border-slate-100 text-center">
            <div className="flex items-center justify-center gap-1.5 text-xs text-slate-500">
              <Lock className="w-3.5 h-3.5 text-slate-400" />
              <span>Role-Based Access Control enforced via Supabase Auth</span>
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
