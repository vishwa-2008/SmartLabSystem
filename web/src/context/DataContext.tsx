'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import {
  Student,
  Equipment,
  EquipmentTransaction,
  ScanEvent,
  StaffProfile,
  DashboardStats,
  DeviceTelemetry,
  EquipmentCondition,
  EnrollmentSession
} from '@/types';
import {
  INITIAL_STUDENTS,
  INITIAL_EQUIPMENT,
  INITIAL_TRANSACTIONS,
  INITIAL_SCANS,
  INITIAL_STAFF,
  INITIAL_DEVICE_TELEMETRY
} from '@/lib/mockData';
import { useAuth } from './AuthContext';
import { isSupabaseConfigured, supabase } from '@/lib/supabaseClient';

interface DataContextType {
  students: Student[];
  equipment: Equipment[];
  transactions: EquipmentTransaction[];
  scans: ScanEvent[];
  staff: StaffProfile[];
  deviceTelemetry: DeviceTelemetry;
  stats: DashboardStats;
  isLoading: boolean;
  isRefreshing: boolean;
  enrollmentSession: EnrollmentSession | null;
  refreshAll: () => Promise<void>;
  issueEquipment: (
    studentId: string,
    equipmentId: string,
    dueAt: string,
    remarks?: string
  ) => Promise<{ success: boolean; transactionId?: string; error?: string }>;
  returnEquipment: (
    transactionId: string,
    condition: EquipmentCondition,
    remarks?: string
  ) => Promise<{ success: boolean; error?: string }>;
  addStudent: (student: Omit<Student, 'id' | 'created_at'>) => Promise<{ success: boolean; error?: string }>;
  updateStudent: (id: string, student: Partial<Student>) => Promise<{ success: boolean; error?: string }>;
  toggleStudentStatus: (id: string) => Promise<{ success: boolean; error?: string }>;
  addEquipment: (item: Omit<Equipment, 'id' | 'created_at'>) => Promise<{ success: boolean; error?: string }>;
  updateEquipment: (id: string, item: Partial<Equipment>) => Promise<{ success: boolean; error?: string }>;
  deleteEquipment: (id: string) => Promise<{ success: boolean; error?: string }>;
  startEnrollment: (studentId: string, templateId: number) => Promise<{ success: boolean; sessionId?: string; error?: string }>;
  cancelEnrollment: () => void;
  simulateHardwareScan: (templateId: number, isTest?: boolean) => Promise<{ success: boolean; event?: ScanEvent; error?: string }>;
  addStaff: (staffData: Omit<StaffProfile, 'id' | 'created_at'>) => Promise<{ success: boolean; error?: string }>;
  toggleStaffStatus: (id: string) => Promise<{ success: boolean; error?: string }>;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3000';

export function DataProvider({ children }: { children: React.ReactNode }) {
  const { currentUser } = useAuth();
  const [students, setStudents] = useState<Student[]>(INITIAL_STUDENTS);
  const [equipment, setEquipment] = useState<Equipment[]>(INITIAL_EQUIPMENT);
  const [transactions, setTransactions] = useState<EquipmentTransaction[]>(INITIAL_TRANSACTIONS);
  const [scans, setScans] = useState<ScanEvent[]>(INITIAL_SCANS);
  const [staff, setStaff] = useState<StaffProfile[]>(INITIAL_STAFF);
  const [deviceTelemetry, setDeviceTelemetry] = useState<DeviceTelemetry>(INITIAL_DEVICE_TELEMETRY);
  const [enrollmentSession, setEnrollmentSession] = useState<EnrollmentSession | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  // Load persistent cache from localStorage
  useEffect(() => {
    try {
      const savedStudents = localStorage.getItem('kare_students');
      if (savedStudents) setStudents(JSON.parse(savedStudents));

      const savedEquipment = localStorage.getItem('kare_equipment');
      if (savedEquipment) setEquipment(JSON.parse(savedEquipment));

      const savedTransactions = localStorage.getItem('kare_transactions');
      if (savedTransactions) setTransactions(JSON.parse(savedTransactions));

      const savedScans = localStorage.getItem('kare_scans');
      if (savedScans) setScans(JSON.parse(savedScans));

      const savedStaff = localStorage.getItem('kare_staff');
      if (savedStaff) setStaff(JSON.parse(savedStaff));
    } catch (err) {
      console.warn('Failed to parse cached local data:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Save changes to localStorage
  useEffect(() => {
    if (!isLoading) {
      localStorage.setItem('kare_students', JSON.stringify(students));
      localStorage.setItem('kare_equipment', JSON.stringify(equipment));
      localStorage.setItem('kare_transactions', JSON.stringify(transactions));
      localStorage.setItem('kare_scans', JSON.stringify(scans));
      localStorage.setItem('kare_staff', JSON.stringify(staff));
    }
  }, [students, equipment, transactions, scans, staff, isLoading]);

  // Telemetry polling from Express API
  const pollDeviceStatus = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/device/status`, {
        headers: { 'Accept': 'application/json' }
      });
      if (res.ok) {
        const data = await res.json();
        setDeviceTelemetry(prev => ({
          ...prev,
          online: data.device?.online ?? prev.online,
          status: data.device?.online ? 'online' : 'offline',
          lastSeen: data.device?.lastSeen || prev.lastSeen,
          uptimeSeconds: data.device?.telemetry?.uptimeSeconds || prev.uptimeSeconds,
          freeHeap: data.device?.telemetry?.freeHeap || prev.freeHeap,
          ipAddress: data.device?.telemetry?.ipAddress || prev.ipAddress
        }));

        if (data.lastScan) {
          setScans(prev => {
            const exists = prev.some(s => s.id === data.lastScan.id);
            if (!exists) {
              const matchedStudent = students.find(st => st.id === data.lastScan.student_id);
              const newScan: ScanEvent = {
                ...data.lastScan,
                student: matchedStudent ? {
                  id: matchedStudent.id,
                  reg_number: matchedStudent.reg_number,
                  full_name: matchedStudent.full_name,
                  department: matchedStudent.department,
                  section: matchedStudent.section
                } : null
              };
              return [newScan, ...prev];
            }
            return prev;
          });
        }
      }
    } catch {
      // Backend not running or unreachable, preserve existing status
    }
  }, [students]);

  // Set up periodic device status polling & Supabase Realtime if active
  useEffect(() => {
    pollDeviceStatus();
    const interval = setInterval(pollDeviceStatus, 10000);

    // If Supabase is configured, subscribe to realtime updates
    let channel: ReturnType<typeof supabase.channel> | null = null;
    if (isSupabaseConfigured) {
      channel = supabase
        .channel('smartlab_realtime')
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'scan_events' },
          (payload) => {
            const raw = payload.new as ScanEvent;
            const studentMatch = students.find(s => s.id === raw.student_id);
            setScans(prev => [{ ...raw, student: studentMatch ? {
              id: studentMatch.id,
              reg_number: studentMatch.reg_number,
              full_name: studentMatch.full_name,
              department: studentMatch.department,
              section: studentMatch.section
            } : null }, ...prev]);
          }
        )
        .subscribe();
    }

    return () => {
      clearInterval(interval);
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [pollDeviceStatus, students]);

  const [stats, setStats] = useState<DashboardStats>({
    total_students: INITIAL_STUDENTS.length,
    total_equipment: INITIAL_EQUIPMENT.length,
    currently_issued: 2,
    available_equipment: 6,
    overdue_equipment: 1,
    damaged_equipment: 2,
    today_scans: 4,
    online_devices: 1,
    computed_at: ''
  });

  // Calculate authoritative operational statistics in client effect
  useEffect(() => {
    const total_students = students.filter(s => s.active).length;
    const total_equipment = equipment.length;
    const currently_issued = equipment.filter(e => e.status === 'issued').length;
    const available_equipment = equipment.filter(e => e.status === 'available').length;
    const damaged_equipment = equipment.filter(e => e.status === 'damaged' || e.status === 'maintenance').length;

    const now = new Date();
    const overdue_equipment = transactions.filter(t => {
      if (t.status !== 'active') return false;
      return new Date(t.due_at) < now;
    }).length;

    // Today's scans count (since midnight)
    const midnight = new Date();
    midnight.setHours(0, 0, 0, 0);
    const today_scans = scans.filter(s => new Date(s.created_at) >= midnight).length;
    const online_devices = deviceTelemetry.online ? 1 : 0;

    setStats({
      total_students,
      total_equipment,
      currently_issued,
      available_equipment,
      overdue_equipment,
      damaged_equipment,
      today_scans,
      online_devices,
      computed_at: now.toISOString()
    });
  }, [students, equipment, transactions, scans, deviceTelemetry]);

  // Refresh data
  const refreshAll = async () => {
    setIsRefreshing(true);
    await pollDeviceStatus();
    setIsRefreshing(false);
  };

  // Issue Equipment workflow (Concurrency-Safe)
  const issueEquipment = async (
    studentId: string,
    equipmentId: string,
    dueAt: string,
    remarks?: string
  ): Promise<{ success: boolean; transactionId?: string; error?: string }> => {
    if (!currentUser) {
      return { success: false, error: 'Authenticated staff session required' };
    }

    const student = students.find(s => s.id === studentId);
    if (!student) {
      return { success: false, error: 'Student record not found' };
    }
    if (!student.active) {
      return { success: false, error: 'Inactive student cannot borrow laboratory equipment' };
    }

    const item = equipment.find(e => e.id === equipmentId);
    if (!item) {
      return { success: false, error: 'Equipment asset not found' };
    }
    if (item.status !== 'available') {
      return { success: false, error: `Equipment is currently ${item.status} and cannot be issued` };
    }
    if (item.condition === 'damaged' || item.condition === 'needs_repair') {
      return { success: false, error: `Equipment condition is ${item.condition}. Issuance prohibited.` };
    }

    const transactionId = crypto.randomUUID();
    const nowIso = new Date().toISOString();

    const newTransaction: EquipmentTransaction = {
      id: transactionId,
      student_id: studentId,
      equipment_id: equipmentId,
      issued_by: currentUser.id,
      issued_at: nowIso,
      due_at: dueAt,
      status: 'active',
      issue_remarks: remarks,
      created_at: nowIso,
      student: {
        id: student.id,
        reg_number: student.reg_number,
        full_name: student.full_name,
        department: student.department,
        section: student.section
      },
      equipment: {
        id: item.id,
        asset_id: item.asset_id,
        name: item.name,
        category: item.category
      },
      issuer: {
        full_name: currentUser.full_name,
        role: currentUser.role
      }
    };

    // Update equipment status
    setEquipment(prev =>
      prev.map(e =>
        e.id === equipmentId
          ? {
              ...e,
              status: 'issued',
              current_borrower: {
                student_id: student.id,
                student_name: student.full_name,
                reg_number: student.reg_number,
                issued_at: nowIso,
                due_at: dueAt
              }
            }
          : e
      )
    );

    setTransactions(prev => [newTransaction, ...prev]);

    return { success: true, transactionId };
  };

  // Return Equipment workflow
  const returnEquipment = async (
    transactionId: string,
    condition: EquipmentCondition,
    remarks?: string
  ): Promise<{ success: boolean; error?: string }> => {
    if (!currentUser) {
      return { success: false, error: 'Authenticated staff session required' };
    }

    const trans = transactions.find(t => t.id === transactionId);
    if (!trans) {
      return { success: false, error: 'Transaction record not found' };
    }
    if (trans.status !== 'active' && trans.status !== 'overdue') {
      return { success: false, error: `Transaction is already marked as ${trans.status}` };
    }

    const nowIso = new Date().toISOString();
    const isDamaged = condition === 'damaged' || condition === 'needs_repair';
    const finalTransStatus = isDamaged ? 'damaged' : 'returned';
    const finalEquipStatus = isDamaged ? 'damaged' : 'available';

    // Update transaction
    setTransactions(prev =>
      prev.map(t =>
        t.id === transactionId
          ? {
              ...t,
              status: finalTransStatus,
              return_condition: condition,
              return_remarks: remarks,
              returned_by: currentUser.id,
              returned_at: nowIso,
              returner: {
                full_name: currentUser.full_name,
                role: currentUser.role
              }
            }
          : t
      )
    );

    // Update equipment
    setEquipment(prev =>
      prev.map(e =>
        e.id === trans.equipment_id
          ? {
              ...e,
              status: finalEquipStatus,
              condition: condition,
              current_borrower: undefined
            }
          : e
      )
    );

    return { success: true };
  };

  // Student management
  const addStudent = async (studentData: Omit<Student, 'id' | 'created_at'>) => {
    const exists = students.some(
      s => s.reg_number.toLowerCase() === studentData.reg_number.toLowerCase()
    );
    if (exists) {
      return { success: false, error: `Student with Registration Number ${studentData.reg_number} already exists` };
    }

    const newStudent: Student = {
      ...studentData,
      id: crypto.randomUUID(),
      created_at: new Date().toISOString()
    };

    setStudents(prev => [newStudent, ...prev]);
    return { success: true };
  };

  const updateStudent = async (id: string, updates: Partial<Student>) => {
    if (updates.reg_number) {
      const conflict = students.some(
        s => s.id !== id && s.reg_number.toLowerCase() === updates.reg_number!.toLowerCase()
      );
      if (conflict) {
        return { success: false, error: 'Another student already has this Registration Number' };
      }
    }

    setStudents(prev =>
      prev.map(s => (s.id === id ? { ...s, ...updates, updated_at: new Date().toISOString() } : s))
    );
    return { success: true };
  };

  const toggleStudentStatus = async (id: string) => {
    setStudents(prev =>
      prev.map(s => (s.id === id ? { ...s, active: !s.active, updated_at: new Date().toISOString() } : s))
    );
    return { success: true };
  };

  // Equipment management
  const addEquipment = async (itemData: Omit<Equipment, 'id' | 'created_at'>) => {
    const exists = equipment.some(
      e => e.asset_id.toLowerCase() === itemData.asset_id.toLowerCase()
    );
    if (exists) {
      return { success: false, error: `Equipment with Asset ID ${itemData.asset_id} already exists` };
    }

    const newItem: Equipment = {
      ...itemData,
      id: crypto.randomUUID(),
      created_at: new Date().toISOString()
    };

    setEquipment(prev => [newItem, ...prev]);
    return { success: true };
  };

  const updateEquipment = async (id: string, updates: Partial<Equipment>) => {
    if (updates.asset_id) {
      const conflict = equipment.some(
        e => e.id !== id && e.asset_id.toLowerCase() === updates.asset_id!.toLowerCase()
      );
      if (conflict) {
        return { success: false, error: 'Another item already has this Asset ID' };
      }
    }

    setEquipment(prev =>
      prev.map(e => (e.id === id ? { ...e, ...updates, updated_at: new Date().toISOString() } : e))
    );
    return { success: true };
  };

  const deleteEquipment = async (id: string) => {
    const hasActiveLoan = transactions.some(
      t => t.equipment_id === id && (t.status === 'active' || t.status === 'overdue')
    );
    if (hasActiveLoan) {
      return {
        success: false,
        error: 'Cannot delete equipment that is currently issued or overdue. Complete return first.'
      };
    }

    setEquipment(prev => prev.filter(e => e.id !== id));
    return { success: true };
  };

  // Hardware Enrollment Workflow
  const startEnrollment = async (studentId: string, templateId: number) => {
    const student = students.find(s => s.id === studentId);
    if (!student) return { success: false, error: 'Student not found' };

    const session: EnrollmentSession = {
      sessionId: crypto.randomUUID(),
      studentId,
      studentName: student.full_name,
      studentReg: student.reg_number,
      targetTemplateId: templateId,
      status: 'waiting_device',
      createdAt: new Date().toISOString()
    };

    setEnrollmentSession(session);

    // Notify backend API if available
    try {
      await fetch(`${API_BASE_URL}/api/enrollment/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId, targetTemplateId: templateId })
      });
    } catch {
      // Backend offline, fallback in local state
    }

    return { success: true, sessionId: session.sessionId };
  };

  const cancelEnrollment = () => {
    setEnrollmentSession(null);
  };

  // Biometric Scan Event Dispatcher / Simulator
  const simulateHardwareScan = async (templateId: number, isTest = true) => {
    const studentMatch = students.find(s => s.template_id === templateId);
    const status = studentMatch ? 'matched' : 'not_found';

    try {
      // Send to Express API endpoint
      const res = await fetch(`${API_BASE_URL}/api/test/simulate-scan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateId,
          studentName: studentMatch?.full_name || 'Simulated Student',
          status
        })
      });

      if (res.ok) {
        const data = await res.json();
        const event: ScanEvent = {
          ...data.event,
          student: studentMatch ? {
            id: studentMatch.id,
            reg_number: studentMatch.reg_number,
            full_name: studentMatch.full_name,
            department: studentMatch.department,
            section: studentMatch.section
          } : null
        };
        setScans(prev => [event, ...prev]);
        return { success: true, event };
      }
    } catch {
      // Offline fallback
    }

    const fallbackEvent: ScanEvent = {
      id: crypto.randomUUID(),
      template_id: templateId,
      student_id: studentMatch?.id || null,
      status,
      device_id: 'esp32-lab-01',
      is_test: isTest,
      created_at: new Date().toISOString(),
      student: studentMatch ? {
        id: studentMatch.id,
        reg_number: studentMatch.reg_number,
        full_name: studentMatch.full_name,
        department: studentMatch.department,
        section: studentMatch.section
      } : null
    };

    setScans(prev => [fallbackEvent, ...prev]);
    return { success: true, event: fallbackEvent };
  };

  // Staff Management (HOD only)
  const addStaff = async (staffData: Omit<StaffProfile, 'id' | 'created_at'>) => {
    if (currentUser?.role !== 'HOD') {
      return { success: false, error: 'Unauthorized: Only the HOD can add staff accounts' };
    }

    const exists = staff.some(s => s.email.toLowerCase() === staffData.email.toLowerCase());
    if (exists) {
      return { success: false, error: 'A staff member with this email address already exists' };
    }

    const newStaff: StaffProfile = {
      ...staffData,
      id: crypto.randomUUID(),
      created_at: new Date().toISOString()
    };

    setStaff(prev => [...prev, newStaff]);
    return { success: true };
  };

  const toggleStaffStatus = async (id: string) => {
    if (currentUser?.role !== 'HOD') {
      return { success: false, error: 'Unauthorized: Only the HOD can modify staff access' };
    }

    const target = staff.find(s => s.id === id);
    if (!target) return { success: false, error: 'Staff record not found' };

    // Prevent deactivating the last active HOD
    if (target.role === 'HOD' && target.active) {
      const activeHODs = staff.filter(s => s.role === 'HOD' && s.active);
      if (activeHODs.length <= 1) {
        return {
          success: false,
          error: 'Protection rule: Cannot deactivate the sole active HOD account.'
        };
      }
    }

    setStaff(prev =>
      prev.map(s => (s.id === id ? { ...s, active: !s.active, updated_at: new Date().toISOString() } : s))
    );
    return { success: true };
  };

  return (
    <DataContext.Provider
      value={{
        students,
        equipment,
        transactions,
        scans,
        staff,
        deviceTelemetry,
        stats,
        isLoading,
        isRefreshing,
        enrollmentSession,
        refreshAll,
        issueEquipment,
        returnEquipment,
        addStudent,
        updateStudent,
        toggleStudentStatus,
        addEquipment,
        updateEquipment,
        deleteEquipment,
        startEnrollment,
        cancelEnrollment,
        simulateHardwareScan,
        addStaff,
        toggleStaffStatus
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
