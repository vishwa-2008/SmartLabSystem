'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { StaffProfile, StaffRole } from '@/types';
import { INITIAL_STAFF } from '@/lib/mockData';
import { isSupabaseConfigured, supabase } from '@/lib/supabaseClient';

interface AuthContextType {
  currentUser: StaffProfile | null;
  isAuthenticated: boolean;
  isHOD: boolean;
  isLoading: boolean;
  error: string | null;
  signIn: (email: string, role?: StaffRole) => Promise<boolean>;
  signOut: () => Promise<void>;
  switchDemoRole: (role: StaffRole) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<StaffProfile | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Initialize session from localStorage or default to HOD for immediate usability
    const savedUser = localStorage.getItem('kare_smartlab_user');
    if (savedUser) {
      try {
        const parsed = JSON.parse(savedUser) as StaffProfile;
        if (parsed.active) {
          setCurrentUser(parsed);
        } else {
          setCurrentUser(INITIAL_STAFF[0]);
        }
      } catch {
        setCurrentUser(INITIAL_STAFF[0]);
      }
    } else {
      // Default to HOD for demonstration
      setCurrentUser(INITIAL_STAFF[0]);
      localStorage.setItem('kare_smartlab_user', JSON.stringify(INITIAL_STAFF[0]));
    }
    setIsLoading(false);
  }, []);

  const signIn = async (email: string, preferredRole?: StaffRole): Promise<boolean> => {
    setIsLoading(true);
    setError(null);

    try {
      if (isSupabaseConfigured) {
        // Authenticate via Supabase Auth
        const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
          email,
          password: 'password123'
        });

        if (authError) {
          throw new Error(authError.message);
        }

        if (authData.user) {
          const { data: profile, error: profError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', authData.user.id)
            .single();

          if (profError || !profile) {
            throw new Error('Staff profile record not found');
          }

          if (!profile.active) {
            throw new Error('This staff account has been deactivated. Please contact the HOD.');
          }

          setCurrentUser(profile);
          localStorage.setItem('kare_smartlab_user', JSON.stringify(profile));
          setIsLoading(false);
          return true;
        }
      }

      // Local / Offline authentication fallback matching staff email
      const matched = INITIAL_STAFF.find(
        s => s.email.toLowerCase() === email.toLowerCase() || (preferredRole && s.role === preferredRole)
      );

      if (!matched) {
        throw new Error('Invalid university staff credentials');
      }

      if (!matched.active) {
        throw new Error('This account has been deactivated. Please contact the HOD.');
      }

      setCurrentUser(matched);
      localStorage.setItem('kare_smartlab_user', JSON.stringify(matched));
      setIsLoading(false);
      return true;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Authentication failed';
      setError(msg);
      setIsLoading(false);
      return false;
    }
  };

  const signOut = async () => {
    setIsLoading(true);
    if (isSupabaseConfigured) {
      await supabase.auth.signOut();
    }
    setCurrentUser(null);
    localStorage.removeItem('kare_smartlab_user');
    setIsLoading(false);
  };

  const switchDemoRole = (role: StaffRole) => {
    const target = INITIAL_STAFF.find(s => s.role === role && s.active) || INITIAL_STAFF[0];
    setCurrentUser(target);
    localStorage.setItem('kare_smartlab_user', JSON.stringify(target));
  };

  const isHOD = currentUser?.role === 'HOD';
  const isAuthenticated = Boolean(currentUser && currentUser.active);

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        isAuthenticated,
        isHOD,
        isLoading,
        error,
        signIn,
        signOut,
        switchDemoRole
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
