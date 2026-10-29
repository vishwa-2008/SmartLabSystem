'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import {
  Student,
  Equipment,
  EquipmentTransaction,
  ScanEvent,
  StaffProfile,
  DashboardStats,
  DeviceTelemetry,
  EquipmentCondition,
  EnrollmentSession,
  Laboratory,
  AuditLog
} from '@/types';
import { useAuth } from './AuthContext';
import { isSupabaseConfigured, supabase } from '@/lib/supabaseClient';
import { apiClient, API_BASE_URL } from '@/lib/apiClient';

const EMPTY_STATS: DashboardStats = {
  total_students: 0,
  total_equipment: 0,
  currently_issued: 0,
  available_equipment: 0,
  overdue_equipment: 0,
  damaged_equipment: 0,
  returned_equipment: 0,
  today_scans: 0,
  online_devices: 0,
  total_labs: 0,
  active_staff: 0
};

const OFFLINE_DEVICE: DeviceTelemetry = {
  deviceId: 'esp32-lab-01',
  status: 'offline',
  online: false,
  lastSeen: null
};

interface DataContextType {
  students: Student[];
  equipment: Equipment[];
  transactions: EquipmentTransaction[];
  scans: ScanEvent[];
  staff: StaffProfile[];
  labs: Laboratory[];
  auditLogs: AuditLog[];
  deviceTelemetry: DeviceTelemetry;
  stats: DashboardStats;
  isLoading: boolean;
  isRefreshing: boolean;
  realtimeConnected: boolean;
  enrollmentSession: EnrollmentSession | null;
  refreshAll: () => Promise<void>;
  refreshStats: () => Promise<void>;
  issueEquipment: (
    studentId: string,
    equipmentId: string,
    dueAt: string,
    remarks?: string,
    labId?: string,
    issueCondition?: EquipmentCondition
  ) => Promise<{ success: boolean; transactionId?: string; error?: string }>;
  returnEquipment: (
    transactionId: string, condition: EquipmentCondition, remarks?: string
  ) => Promise<{ success: boolean; error?: string }>;
  fetchOutstanding: (params?: {
    search?: string;
    labId?: string;
    page?: number;
    limit?: number;
  }) => Promise<{ data: EquipmentTransaction[]; count: number }>;
  addStudent: (student: Omit<Student, 'id' | 'created_at'> & { lab_id?: string; template_id?: number | null }) => Promise<{ success: boolean; error?: string }>;
  updateStudent: (id: string, student: Partial<Student> & { template_id?: number | null }) => Promise<{ success: boolean; error?: string }>;
  deleteStudent: (id: string) => Promise<{ success: boolean; error?: string }>;
  addEquipment: (item: Omit<Equipment, 'id' | 'created_at'>) => Promise<{ success: boolean; error?: string }>;
  updateEquipment: (id: string, item: Partial<Equipment>) => Promise<{ success: boolean; error?: string }>;
  deleteEquipment: (id: string) => Promise<{ success: boolean; error?: string }>;
  toggleStudentStatus: (id: string) => Promise<{ success: boolean; error?: string }>;
  addStaff: (staffData: Omit<StaffProfile, 'id' | 'created_at' | 'updated_at'> & { password?: string; lab_ids?: string[] }) => Promise<{ success: boolean; error?: string }>;
  toggleStaffStatus: (id: string) => Promise<{ success: boolean; error?: string }>;
  simulateHardwareScan: (templateId: number, isTest?: boolean) => Promise<{ success: boolean; error?: string }>;
  startEnrollment: (studentId: string, targetTemplateId: number) => Promise<{ success: boolean; sessionId?: string; error?: string }>;
  cancelEnrollment: () => Promise<void>;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

// Forwarding helper to preserve compatibility with all internal calls
async function apiFetch<T = any>(path: string, options?: RequestInit, _token?: string | null): Promise<T> {
  return apiClient<T>(path, options);
}

export function DataProvider({ children }: { children: React.ReactNode }) {
  const { currentUser } = useAuth();
  const [students, setStudents] = useState<Student[]>([]);
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [transactions, setTransactions] = useState<EquipmentTransaction[]>([]);
  const [scans, setScans] = useState<ScanEvent[]>([]);
  const [staff, setStaff] = useState<StaffProfile[]>([]);
  const [labs, setLabs] = useState<Laboratory[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [deviceTelemetry, setDeviceTelemetry] = useState<DeviceTelemetry>(OFFLINE_DEVICE);
  const [enrollmentSession, setEnrollmentSession] = useState<EnrollmentSession | null>(null);
  const [stats, setStats] = useState<DashboardStats>(EMPTY_STATS);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [realtimeConnected, setRealtimeConnected] = useState<boolean>(false);
  const sessionTokenRef = useRef<string | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // Keep session token fresh
  useEffect(() => {
    const updateToken = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      sessionTokenRef.current = session?.access_token || null;
    };
    updateToken();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_ev, session) => {
      sessionTokenRef.current = session?.access_token || null;
    });
    return () => subscription.unsubscribe();
  }, []);

  const fetchStats = useCallback(async () => {
    if (!isSupabaseConfigured) return;
    try {
      const { data, error } = await supabase.rpc('rpc_get_dashboard_stats');
      if (!error && data) setStats(data as DashboardStats);
    } catch { /* silently fail stats — non-critical */ }
  }, []);

  const fetchAll = useCallback(async () => {
    if (!isSupabaseConfigured || !currentUser) return;

    try {
      // Fetch labs (scoped by assignment via RLS)
      const { data: labData } = await supabase
        .from('laboratories')
        .select('*')
        .eq('is_active', true)
        .order('name');
      if (labData) setLabs(labData as Laboratory[]);

      // Fetch students (RLS-scoped)
      const { data: studentData } = await supabase
        .from('students')
        .select('*, fingerprint_templates(template_id, active, enrolled_at)')
        .order('created_at', { ascending: false })
        .limit(200);
      if (studentData) {
        const formatted = (studentData as any[]).map(s => {
          let activeTpl: { template_id: number; active?: boolean } | null = null;
          if (Array.isArray(s.fingerprint_templates)) {
            activeTpl = s.fingerprint_templates.find((t: any) => t && t.active !== false) || null;
          } else if (s.fingerprint_templates && typeof s.fingerprint_templates === 'object') {
            activeTpl = s.fingerprint_templates.active !== false ? s.fingerprint_templates : null;
          }

          return {
            ...s,
            fingerprint_enrolled: Boolean(activeTpl),
            template_id: activeTpl ? activeTpl.template_id : null
          };
        });
        setStudents(formatted as Student[]);
      }

      // Fetch equipment (RLS-scoped)
      const { data: equipData } = await supabase
        .from('equipment')
        .select('*, lab:laboratories(id, name, lab_code)')
        .order('created_at', { ascending: false })
        .limit(200);
      if (equipData) setEquipment(equipData as Equipment[]);

      // Fetch transactions
      const { data: txData } = await supabase
        .from('equipment_transactions')
        .select(`
          *,
          student:students(id, reg_number, full_name, department, section),
          equipment:equipment(id, asset_id, name, category),
          issuer:profiles!issued_by(full_name, role),
          returner:profiles!returned_by(full_name, role)
        `)
        .order('issued_at', { ascending: false })
        .limit(200);
      if (txData) setTransactions(txData as EquipmentTransaction[]);

      // Fetch scans
      const { data: scanData } = await supabase
        .from('scan_events')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
      if (scanData) setScans(scanData as ScanEvent[]);

      // HOD only: fetch all staff
      if (currentUser.role === 'HOD') {
        const { data: staffData } = await supabase
          .from('profiles')
          .select('*, lab_assignments(lab_id, is_active, laboratories(id, name, lab_code))')
          .order('full_name');
        if (staffData) setStaff(staffData as StaffProfile[]);

        const { data: logsData } = await supabase
          .from('audit_logs')
          .select('*, actor:profiles!actor_id(full_name, role, email)')
          .order('created_at', { ascending: false })
          .limit(100);
        if (logsData) setAuditLogs(logsData as AuditLog[]);
      }

      // Device status (from backend API — no auth needed for status)
      try {
        const statusRes = await fetch(`${API_BASE_URL}/api/device/status`);
        if (statusRes.ok) {
          const statusData = await statusRes.json();
          if (statusData.device) {
            setDeviceTelemetry({
              deviceId: statusData.device.id,
              online: statusData.device.online,
              status: statusData.device.online ? 'online' : 'offline',
              lastSeen: statusData.device.lastSeen,
              ...statusData.device.telemetry
            });
          }
        }
      } catch { /* device offline is expected */ }

      await fetchStats();
    } catch (err) {
      console.error('Data fetch error:', err);
    }
  }, [currentUser, fetchStats]);

  // Initial load
  useEffect(() => {
    if (!currentUser) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    fetchAll().finally(() => setIsLoading(false));
  }, [currentUser, fetchAll]);

  const fetchAllRef = useRef(fetchAll);
  fetchAllRef.current = fetchAll;
  const fetchStatsRef = useRef(fetchStats);
  fetchStatsRef.current = fetchStats;

  // Set up Supabase Realtime subscriptions
  useEffect(() => {
    if (!isSupabaseConfigured || !currentUser?.id) return;

    let isMounted = true;
    const channel = supabase
      .channel(`smartlab-realtime-${currentUser.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'equipment' },
        (payload) => {
          if (!isMounted) return;
          if (payload.eventType === 'INSERT') {
            setEquipment(prev => [payload.new as Equipment, ...prev]);
          } else if (payload.eventType === 'UPDATE') {
            setEquipment(prev => prev.map(e => e.id === payload.new.id ? { ...e, ...payload.new } : e));
          } else if (payload.eventType === 'DELETE') {
            setEquipment(prev => prev.filter(e => e.id !== payload.old.id));
          }
          fetchStatsRef.current();
        }
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'equipment_transactions' },
        (payload) => {
          if (!isMounted) return;
          if (payload.eventType === 'INSERT') {
            fetchAllRef.current();
          } else if (payload.eventType === 'UPDATE') {
            setTransactions(prev =>
              prev.map(t => t.id === payload.new.id ? { ...t, ...payload.new } : t)
            );
            fetchStatsRef.current();
          }
        }
      )
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'students' },
        (payload) => {
          if (!isMounted) return;
          setStudents(prev => [payload.new as Student, ...prev]);
          fetchStatsRef.current();
        }
      )
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'students' },
        (payload) => {
          if (!isMounted) return;
          setStudents(prev => prev.map(s => s.id === payload.new.id ? { ...s, ...payload.new } : s));
        }
      )
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'scan_events' },
        (payload) => {
          if (!isMounted) return;
          setScans(prev => [payload.new as ScanEvent, ...prev.slice(0, 49)]);
          fetchStatsRef.current();
        }
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'laboratories' },
        () => {
          if (!isMounted) return;
          fetchAllRef.current();
        }
      )
      .subscribe((status) => {
        if (!isMounted) return;
        setRealtimeConnected(status === 'SUBSCRIBED');
      });

    channelRef.current = channel;

    return () => {
      isMounted = false;
      supabase.removeChannel(channel);
      channelRef.current = null;
      setRealtimeConnected(false);
    };
  }, [currentUser?.id]);

  const refreshAll = useCallback(async () => {
    setIsRefreshing(true);
    await fetchAll();
    setIsRefreshing(false);
  }, [fetchAll]);

  const refreshStats = useCallback(fetchStats, [fetchStats]);

  // ─── ISSUE EQUIPMENT ────────────────────────────────────────────────────────
  const issueEquipment = useCallback(async (
    studentId: string,
    equipmentId: string,
    dueAt: string,
    remarks?: string,
    labId?: string,
    issueCondition?: EquipmentCondition
  ) => {
    try {
      const token = sessionTokenRef.current;
      const result = await apiFetch('/api/equipment/issue', {
        method: 'POST',
        body: JSON.stringify({
          student_id: studentId,
          equipment_id: equipmentId,
          due_at: dueAt,
          remarks,
          lab_id: labId,
          issue_condition: issueCondition || 'good'
        })
      }, token);
      await fetchAll();
      return { success: true, transactionId: result.transaction_id };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : 'Failed to issue equipment' };
    }
  }, [fetchAll]);

  // ─── RETURN EQUIPMENT ───────────────────────────────────────────────────────
  const returnEquipment = useCallback(async (
    transactionId: string, condition: EquipmentCondition, remarks?: string
  ) => {
    try {
      const token = sessionTokenRef.current;
      await apiFetch('/api/equipment/return', {
        method: 'POST',
        body: JSON.stringify({ transaction_id: transactionId, condition, remarks })
      }, token);
      await fetchAll();
      return { success: true };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : 'Failed to return equipment' };
    }
  }, [fetchAll]);

  // ─── ADD STUDENT ────────────────────────────────────────────────────────────
  const addStudent = useCallback(async (
    studentData: Omit<Student, 'id' | 'created_at'> & { lab_id?: string; template_id?: number | null }
  ) => {
    try {
      const token = sessionTokenRef.current;
      await apiFetch('/api/students', {
        method: 'POST',
        body: JSON.stringify(studentData)
      }, token);
      await fetchAll();
      await fetchStats();
      return { success: true };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : 'Failed to add student' };
    }
  }, [fetchAll, fetchStats]);

  // ─── UPDATE STUDENT ─────────────────────────────────────────────────────────
  const updateStudent = useCallback(async (id: string, updates: Partial<Student> & { template_id?: number | null }) => {
    try {
      const token = sessionTokenRef.current;
      await apiFetch(`/api/students/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(updates)
      }, token);
      await fetchAll();
      return { success: true };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : 'Failed to update student' };
    }
  }, [fetchAll]);

  // ─── ADD EQUIPMENT ──────────────────────────────────────────────────────────
  const addEquipment = useCallback(async (item: Omit<Equipment, 'id' | 'created_at'>) => {
    try {
      const token = sessionTokenRef.current;
      const result = await apiFetch('/api/equipment', {
        method: 'POST',
        body: JSON.stringify(item)
      }, token);
      setEquipment(prev => [result as Equipment, ...prev]);
      await fetchStats();
      return { success: true };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : 'Failed to add equipment' };
    }
  }, [fetchStats]);

  // ─── UPDATE EQUIPMENT ───────────────────────────────────────────────────────
  const updateEquipment = useCallback(async (id: string, updates: Partial<Equipment>) => {
    try {
      const token = sessionTokenRef.current;
      const result = await apiFetch(`/api/equipment/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(updates)
      }, token);
      setEquipment(prev => prev.map(e => e.id === id ? { ...e, ...result } : e));
      return { success: true };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : 'Failed to update equipment' };
    }
  }, []);

  // ─── DELETE EQUIPMENT ───────────────────────────────────────────────────────
  const deleteEquipment = useCallback(async (id: string) => {
    try {
      const token = sessionTokenRef.current;
      await apiFetch(`/api/equipment/${id}`, { method: 'DELETE' }, token);
      setEquipment(prev => prev.filter(e => e.id !== id));
      await fetchStats();
      return { success: true };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : 'Failed to delete equipment' };
    }
  }, [fetchStats]);

  // ─── DELETE STUDENT ─────────────────────────────────────────────────────────
  const deleteStudent = useCallback(async (id: string) => {
    try {
      const token = sessionTokenRef.current;
      await apiFetch(`/api/students/${id}`, { method: 'DELETE' }, token);
      setStudents(prev => prev.filter(s => s.id !== id));
      await fetchStats();
      return { success: true };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : 'Failed to delete student' };
    }
  }, [fetchStats]);

  // ─── TOGGLE STUDENT STATUS ──────────────────────────────────────────────────
  const toggleStudentStatus = useCallback(async (id: string) => {
    const student = students.find(s => s.id === id);
    if (!student) return { success: false, error: 'Student not found' };
    try {
      const token = sessionTokenRef.current;
      const updated = await apiFetch(`/api/students/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ active: !student.active })
      }, token);
      setStudents(prev => prev.map(s => s.id === id ? { ...s, active: updated.active } : s));
      await fetchStats();
      return { success: true };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : 'Failed to toggle student status' };
    }
  }, [students, fetchStats]);

  // ─── STAFF MANAGEMENT ───────────────────────────────────────────────────────
  const addStaff = useCallback(async (staffData: Omit<StaffProfile, 'id' | 'created_at' | 'updated_at'> & { password?: string; lab_ids?: string[] }) => {
    try {
      const token = sessionTokenRef.current;
      await apiFetch('/api/lab-incharges', {
        method: 'POST',
        body: JSON.stringify(staffData)
      }, token);
      await fetchAll();
      return { success: true };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : 'Failed to create staff account' };
    }
  }, [fetchAll]);

  const toggleStaffStatus = useCallback(async (id: string) => {
    const member = staff.find(s => s.id === id);
    if (!member) return { success: false, error: 'Staff member not found' };
    try {
      const token = sessionTokenRef.current;
      await apiFetch(`/api/lab-incharges/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ active: !member.active })
      }, token);
      setStaff(prev => prev.map(s => s.id === id ? { ...s, active: !member.active } : s));
      return { success: true };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : 'Failed to update staff status' };
    }
  }, [staff]);

  // ─── FETCH OUTSTANDING EQUIPMENT ───────────────────────────────────────────
  const fetchOutstanding = useCallback(async (params?: {
    search?: string;
    labId?: string;
    page?: number;
    limit?: number;
  }) => {
    try {
      const token = sessionTokenRef.current;
      const queryParams = new URLSearchParams();
      if (params?.search) queryParams.set('search', params.search);
      if (params?.labId) queryParams.set('lab_id', params.labId);
      if (params?.page) queryParams.set('page', String(params.page));
      if (params?.limit) queryParams.set('limit', String(params.limit));

      const queryStr = queryParams.toString() ? `?${queryParams.toString()}` : '';
      const result = await apiFetch(`/api/outstanding${queryStr}`, { method: 'GET' }, token);
      return { data: result.data || [], count: result.count || 0 };
    } catch (err: unknown) {
      console.error('Failed to fetch outstanding equipment:', err);
      return { data: [], count: 0 };
    }
  }, []);

  // ─── HARDWARE SCAN SIMULATOR (HOD / DEV TEST) ────────────────────────────────
  const simulateHardwareScan = useCallback(async (templateId: number, isTest?: boolean) => {
    try {
      const token = sessionTokenRef.current;
      await apiFetch('/api/test/simulate-scan', {
        method: 'POST',
        body: JSON.stringify({ templateId, isTest: isTest ?? true })
      }, token);
      await fetchAll();
      return { success: true };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : 'Simulation failed' };
    }
  }, [fetchAll]);

  // ─── BIOMETRIC ENROLLMENT ──────────────────────────────────────────────────
  const startEnrollment = useCallback(async (studentId: string, targetTemplateId: number) => {
    try {
      const token = sessionTokenRef.current;
      const res = await apiFetch<EnrollmentSession>('/api/enrollment/start', {
        method: 'POST',
        body: JSON.stringify({ studentId, targetTemplateId })
      }, token);
      setEnrollmentSession(res);
      return { success: true, sessionId: res.sessionId };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : 'Failed to start enrollment' };
    }
  }, []);

  const cancelEnrollment = useCallback(async () => {
    if (!enrollmentSession?.sessionId) {
      setEnrollmentSession(null);
      return;
    }
    try {
      const token = sessionTokenRef.current;
      await apiFetch('/api/enrollment/cancel', {
        method: 'POST',
        body: JSON.stringify({ sessionId: enrollmentSession.sessionId })
      }, token);
    } catch { /* ignore */ }
    setEnrollmentSession(null);
  }, [enrollmentSession]);

  // Polling enrollment session status while active
  useEffect(() => {
    if (!enrollmentSession || ['enrolled', 'failed', 'cancelled'].includes(enrollmentSession.status)) {
      return;
    }

    const interval = setInterval(async () => {
      try {
        const token = sessionTokenRef.current;
        const status = await apiFetch<EnrollmentSession>(`/api/enrollment/status/${enrollmentSession.sessionId}`, {}, token);
        if (status) {
          setEnrollmentSession(status);
          if (status.status === 'enrolled') {
            await fetchAll();
            await fetchStats();
          }
        }
      } catch {
        // Silently continue polling
      }
    }, 1500);

    return () => clearInterval(interval);
  }, [enrollmentSession, fetchAll, fetchStats]);

  return (
    <DataContext.Provider
      value={{
        students, equipment, transactions, scans, staff, labs, auditLogs,
        deviceTelemetry, stats, isLoading, isRefreshing, realtimeConnected,
        enrollmentSession,
        refreshAll, refreshStats,
        issueEquipment, returnEquipment, fetchOutstanding,
        addStudent, updateStudent, deleteStudent, toggleStudentStatus,
        addEquipment, updateEquipment, deleteEquipment,
        addStaff, toggleStaffStatus,
        simulateHardwareScan,
        startEnrollment, cancelEnrollment
      }}
    >
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  const context = useContext(DataContext);
  if (!context) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
}
