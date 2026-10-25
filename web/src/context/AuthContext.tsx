'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { StaffProfile, StaffRole } from '@/types';
import { isSupabaseConfigured, supabase } from '@/lib/supabaseClient';

interface AuthContextType {
  currentUser: StaffProfile | null;
  isAuthenticated: boolean;
  isHOD: boolean;
  isLoading: boolean;
  error: string | null;
  signIn: (email: string, password: string) => Promise<boolean>;
  signOut: () => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

async function loadProfileForUser(userId: string): Promise<StaffProfile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, full_name, role, active, created_at, updated_at')
    .eq('id', userId)
    .single();

  if (error || !data) return null;
  return data as StaffProfile;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<StaffProfile | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // On mount: restore session from Supabase if one exists
  useEffect(() => {
    let mounted = true;

    const initSession = async () => {
      if (!isSupabaseConfigured) {
        setIsLoading(false);
        return;
      }

      try {
        const { data: { session } } = await supabase.auth.getSession();

        if (session?.user && mounted) {
          const profile = await loadProfileForUser(session.user.id);
          if (profile?.active) {
            setCurrentUser(profile);
          } else if (profile && !profile.active) {
            // Account deactivated — sign out
            await supabase.auth.signOut();
          }
        }
      } catch (err) {
        console.error('Session init error:', err);
      } finally {
        if (mounted) setIsLoading(false);
      }
    };

    initSession();

    // Listen for auth state changes (token refresh, sign out)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return;

        if (event === 'SIGNED_OUT' || !session) {
          setCurrentUser(null);
          return;
        }

        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          if (session.user) {
            const profile = await loadProfileForUser(session.user.id);
            if (profile?.active) {
              setCurrentUser(profile);
            } else {
              await supabase.auth.signOut();
              setCurrentUser(null);
              setError('Your account has been deactivated. Contact the HOD.');
            }
          }
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string): Promise<boolean> => {
    setError(null);
    setIsLoading(true);

    if (!isSupabaseConfigured) {
      setError('Supabase is not configured. Add your project credentials to web/.env.local and restart.');
      setIsLoading(false);
      return false;
    }

    if (!email || !password) {
      setError('Please enter your email and password.');
      setIsLoading(false);
      return false;
    }

    try {
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password
      });

      if (authError) {
        if (authError.message?.includes('Invalid login')) {
          throw new Error('Invalid email or password.');
        }
        throw new Error(authError.message);
      }

      if (!authData.user) {
        throw new Error('Authentication failed. Please try again.');
      }

      const profile = await loadProfileForUser(authData.user.id);

      if (!profile) {
        await supabase.auth.signOut();
        throw new Error('Staff profile not found. Contact the system administrator.');
      }

      if (!profile.active) {
        await supabase.auth.signOut();
        throw new Error('This account has been deactivated. Please contact the HOD.');
      }

      setCurrentUser(profile);
      setIsLoading(false);
      return true;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Authentication failed';
      setError(msg);
      setIsLoading(false);
      return false;
    }
  }, []);

  const signOut = useCallback(async () => {
    setIsLoading(true);
    if (isSupabaseConfigured) {
      await supabase.auth.signOut();
    }
    setCurrentUser(null);
    setIsLoading(false);
  }, []);

  const clearError = useCallback(() => setError(null), []);

  const isHOD = currentUser?.role === 'HOD';
  const isAuthenticated = Boolean(currentUser?.active);

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
        clearError
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

// Helper hook to get the Supabase session token for API calls
export function useSessionToken() {
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    const getToken = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setToken(session?.access_token || null);
    };
    getToken();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setToken(session?.access_token || null);
    });

    return () => subscription.unsubscribe();
  }, []);

  return token;
}

// Role type re-export for convenience
export type { StaffRole };
