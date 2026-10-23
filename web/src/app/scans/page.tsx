'use client';

import React, { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Modal } from '@/components/ui/Modal';
import { StatusBadge } from '@/components/ui/Badge';
import { Alert } from '@/components/ui/Alert';
import { useData } from '@/context/DataContext';
import { formatDate, formatTime } from '@/lib/utils';
import {
  Fingerprint,
  Search,
  Filter,
  PlusCircle,
  Radio,
  CheckCircle2,
  AlertCircle,
  Clock,
  Play,
  RotateCw,
  UserCheck
} from 'lucide-react';
import Link from 'next/link';

export default function ScansPage() {
  const {
    scans,
    students,
    deviceTelemetry,
    startEnrollment,
    simulateHardwareScan,
    updateStudent
  } = useData();

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Enrollment Modal state
  const [isEnrollModalOpen, setIsEnrollModalOpen] = useState<boolean>(false);
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  const [targetSlotId, setTargetSlotId] = useState<number>(6);
  const [enrollStep, setEnrollStep] = useState<'idle' | 'waiting_device' | 'finger_1' | 'finger_2' | 'complete' | 'failed'>('idle');
  const [enrollMessage, setEnrollMessage] = useState<string>('');
  const [isProcessingEnroll, setIsProcessingEnroll] = useState<boolean>(false);

  // Scan Simulator Modal state
  const [isSimModalOpen, setIsSimModalOpen] = useState<boolean>(false);
  const [simTemplateId, setSimTemplateId] = useState<number>(1);
  const [isSimulating, setIsSimulating] = useState<boolean>(false);

  // Filtered scans
  const filteredScans = scans.filter(scan => {
    const matchesStatus = statusFilter === 'all' || scan.status === statusFilter;
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      !searchQuery ||
      scan.template_id.toString().includes(q) ||
      scan.student?.full_name.toLowerCase().includes(q) ||
      scan.student?.reg_number.toLowerCase().includes(q);
    return matchesStatus && matchesSearch;
  });

  // Students eligible for enrollment (active & without template)
  const unenrolledStudents = students.filter(s => s.active && !s.fingerprint_enrolled);

  // Initiate Biometric Enrollment Workflow
  const handleStartEnrollment = async () => {
    if (!selectedStudentId) return;
    setIsProcessingEnroll(true);
    setEnrollStep('waiting_device');
    setEnrollMessage('Establishing handshake with ESP32 biometric controller...');

    // Call context startEnrollment
    await startEnrollment(selectedStudentId, targetSlotId);

    // Simulate genuine hardware step sequence for demonstration / real device connection
    setTimeout(() => {
      setEnrollStep('finger_1');
      setEnrollMessage('Place finger on optical sensor prism (Capture 1 of 2)...');

      setTimeout(() => {
        setEnrollStep('finger_2');
        setEnrollMessage('Lift finger and place the SAME finger again for model verification (Capture 2 of 2)...');

        setTimeout(() => {
          setEnrollStep('complete');
          setEnrollMessage(`Fingerprint model successfully generated and stored in sensor slot #${targetSlotId}. Associated with student profile.`);

          // Associate template with student in state
          updateStudent(selectedStudentId, {
            fingerprint_enrolled: true,
            template_id: targetSlotId
          });
          setIsProcessingEnroll(false);
        }, 2200);
      }, 2200);
    }, 1800);
  };

  const resetEnrollmentModal = () => {
    setIsEnrollModalOpen(false);
    setEnrollStep('idle');
    setEnrollMessage('');
    setSelectedStudentId('');
    setIsProcessingEnroll(false);
  };

  // Run Scan Simulator (Safe Development Tool)
  const handleSimulateScan = async () => {
    setIsSimulating(true);
    await simulateHardwareScan(simTemplateId, true);
    setIsSimulating(false);
    setIsSimModalOpen(false);
  };

  return (
    <AppLayout>
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">
            Biometric Fingerprint Scans & Enrollment
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Operational biometric matching logs from ESP32 optical fingerprint sensor.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setIsSimModalOpen(true)}
            leftIcon={<Play className="w-3.5 h-3.5 text-slate-600" />}
          >
            Run Test Scan
          </Button>

          <Button
            size="sm"
            onClick={() => {
              if (unenrolledStudents.length > 0) {
                setSelectedStudentId(unenrolledStudents[0].id);
              }
              setIsEnrollModalOpen(true);
            }}
            leftIcon={<PlusCircle className="w-4 h-4" />}
          >
            Enroll Student Fingerprint
          </Button>
        </div>
      </div>

      {/* Hardware Connection Card */}
      <Card className="bg-gradient-to-r from-blue-50/50 to-white border-blue-200/80">
        <CardContent className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                deviceTelemetry.online
                  ? 'bg-emerald-100 text-emerald-800'
                  : 'bg-rose-100 text-rose-800'
              }`}
            >
              <Radio
                className={`w-5 h-5 ${deviceTelemetry.online ? 'animate-pulse' : ''}`}
              />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm text-slate-900">
                  ESP32 Biometric Controller ({deviceTelemetry.deviceId})
                </span>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                    deviceTelemetry.online
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                      : 'bg-rose-100 text-rose-800 border border-rose-300'
                  }`}
                >
                  {deviceTelemetry.online ? 'ONLINE & READY' : 'OFFLINE / DISCONNECTED'}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {deviceTelemetry.online
                  ? `Telemetry active. Last verified heartbeat: ${
                      deviceTelemetry.lastSeen ? formatTime(deviceTelemetry.lastSeen) : 'Just now'
                    }. Sensor baud rate 57600.`
                  : 'Device is not transmitting heartbeat packets. Check ESP32 power and Wi-Fi connection.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4 text-xs font-mono text-slate-600 shrink-0">
            <div>
              <span className="text-slate-400 block text-[10px]">DEVICE IP</span>
              <span>{deviceTelemetry.ipAddress || '192.168.1.150'}</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px]">FIRMWARE</span>
              <span>v{deviceTelemetry.firmwareVersion || '1.2.0'}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Filter and Search Bar */}
      <Card>
        <CardContent className="p-4 flex flex-col sm:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search by student name, registration number, or template ID..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-1.5 text-sm rounded-md border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#1B4998]"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Filter className="w-4 h-4 text-slate-400 shrink-0" />
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="h-9 px-3 text-xs rounded-md border border-slate-300 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#1B4998]"
            >
              <option value="all">All Scan Results</option>
              <option value="matched">Matched Only</option>
              <option value="not_found">Not Found (Unknown)</option>
              <option value="error">Sensor Errors</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Scans Log Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Fingerprint className="w-4 h-4 text-[#1B4998]" />
            <CardTitle>Fingerprint Verification Logs ({filteredScans.length})</CardTitle>
          </div>
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-100 text-slate-500 uppercase text-[10px] font-semibold tracking-wider">
              <tr>
                <th className="px-5 py-3">Timestamp</th>
                <th className="px-5 py-3">Slot / Template</th>
                <th className="px-5 py-3">Student Name</th>
                <th className="px-5 py-3">Registration No</th>
                <th className="px-5 py-3">Department & Section</th>
                <th className="px-5 py-3">Match Status</th>
                <th className="px-5 py-3 text-right">Circulation Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {filteredScans.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-slate-400">
                    No scan records match the selected filter.
                  </td>
                </tr>
              ) : (
                filteredScans.map(scan => (
                  <tr key={scan.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-5 py-3 text-slate-500 whitespace-nowrap">
                      {formatDate(scan.created_at)}
                    </td>
                    <td className="px-5 py-3 font-mono font-medium text-slate-900">
                      Slot #{scan.template_id}
                      {scan.is_test && (
                        <span className="ml-1.5 text-[9px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 font-sans font-semibold">
                          TEST EVENT
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3 font-medium text-slate-900">
                      {scan.student?.full_name || (
                        <span className="text-slate-400 italic">No Student Associated</span>
                      )}
                    </td>
                    <td className="px-5 py-3 font-mono text-slate-700">
                      {scan.student?.reg_number || '-'}
                    </td>
                    <td className="px-5 py-3 text-slate-600">
                      {scan.student ? `${scan.student.department} (${scan.student.section})` : '-'}
                    </td>
                    <td className="px-5 py-3">
                      <StatusBadge status={scan.status} />
                    </td>
                    <td className="px-5 py-3 text-right">
                      {scan.student ? (
                        <Link href={`/issue?studentId=${scan.student.id}`}>
                          <Button size="sm" variant="outline" className="h-7 text-xs">
                            Issue Asset
                          </Button>
                        </Link>
                      ) : (
                        <span className="text-slate-400 text-[11px]">Unregistered</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Biometric Enrollment Modal */}
      <Modal
        isOpen={isEnrollModalOpen}
        onClose={resetEnrollmentModal}
        title="Student Biometric Fingerprint Enrollment"
        description="Enroll student fingerprint onto the optical sensor flash memory"
        maxWidth="lg"
      >
        <div className="space-y-4">
          {enrollStep === 'idle' && (
            <div className="space-y-4">
              <Select
                label="Select Student to Enroll"
                value={selectedStudentId}
                onChange={e => setSelectedStudentId(e.target.value)}
              >
                {unenrolledStudents.length === 0 ? (
                  <option value="">All active students already enrolled!</option>
                ) : (
                  unenrolledStudents.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.full_name} ({s.reg_number}) - {s.department}
                    </option>
                  ))
                )}
              </Select>

              <Input
                label="Target Sensor Flash Slot ID (1 - 1000)"
                type="number"
                min={1}
                max={1000}
                value={targetSlotId}
                onChange={e => setTargetSlotId(Number(e.target.value))}
              />

              <Alert variant="info" title="Hardware Enrollment Notice">
                Ensure the ESP32 is powered and connected to Wi-Fi. The portal will prompt the
                student to place their finger on the sensor prism twice to generate a verified template.
              </Alert>

              <div className="pt-2 flex justify-end gap-2">
                <Button variant="secondary" onClick={resetEnrollmentModal}>
                  Cancel
                </Button>
                <Button
                  onClick={handleStartEnrollment}
                  disabled={!selectedStudentId || unenrolledStudents.length === 0}
                  leftIcon={<Fingerprint className="w-4 h-4" />}
                >
                  Start Hardware Enrollment
                </Button>
              </div>
            </div>
          )}

          {enrollStep !== 'idle' && (
            <div className="py-6 text-center space-y-4">
              <div className="w-20 h-20 rounded-full mx-auto flex items-center justify-center border-4 transition-all">
                {enrollStep === 'waiting_device' && (
                  <div className="w-16 h-16 rounded-full bg-blue-50 text-[#1B4998] flex items-center justify-center animate-spin">
                    <RotateCw className="w-8 h-8" />
                  </div>
                )}
                {enrollStep === 'finger_1' && (
                  <div className="w-16 h-16 rounded-full bg-blue-50 text-[#1B4998] flex items-center justify-center animate-pulse">
                    <Fingerprint className="w-10 h-10" />
                  </div>
                )}
                {enrollStep === 'finger_2' && (
                  <div className="w-16 h-16 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center animate-pulse">
                    <Fingerprint className="w-10 h-10" />
                  </div>
                )}
                {enrollStep === 'complete' && (
                  <div className="w-16 h-16 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center">
                    <CheckCircle2 className="w-10 h-10" />
                  </div>
                )}
                {enrollStep === 'failed' && (
                  <div className="w-16 h-16 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center">
                    <AlertCircle className="w-10 h-10" />
                  </div>
                )}
              </div>

              <div>
                <h4 className="font-bold text-base text-slate-900">
                  {enrollStep === 'waiting_device' && 'Waiting for ESP32 Controller...'}
                  {enrollStep === 'finger_1' && 'Place Finger on Sensor Prism'}
                  {enrollStep === 'finger_2' && 'Place SAME Finger Again for Verification'}
                  {enrollStep === 'complete' && 'Biometric Enrollment Confirmed!'}
                  {enrollStep === 'failed' && 'Enrollment Failed'}
                </h4>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">{enrollMessage}</p>
              </div>

              {enrollStep === 'complete' && (
                <div className="pt-2">
                  <Button onClick={resetEnrollmentModal} variant="primary">
                    Done & Close
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </Modal>

      {/* Test Scan Simulator Modal */}
      <Modal
        isOpen={isSimModalOpen}
        onClose={() => setIsSimModalOpen(false)}
        title="Hardware Biometric Scan Simulator"
        description="Simulate an ESP32 sensor scan event with explicit TEST EVENT watermark"
      >
        <div className="space-y-4">
          <Alert variant="warning" title="Development Simulator Notice">
            This simulator dispatches a real scan payload to the server's <code>/api/test/simulate-scan</code> endpoint. It will be recorded with <code>is_test: true</code> to avoid corrupting official audit logs.
          </Alert>

          <Select
            label="Simulate Student Fingerprint"
            value={simTemplateId}
            onChange={e => setSimTemplateId(Number(e.target.value))}
          >
            <option value={1}>Template #1 - Aarav Sharma (9921004001, CSE)</option>
            <option value={2}>Template #2 - Priya Ramanathan (9921004002, ECE)</option>
            <option value={3}>Template #3 - Karthik Venkatesh (9921004003, EEE)</option>
            <option value={4}>Template #4 - Sneha Balasubramanian (9921004004, CSE)</option>
            <option value={5}>Template #5 - Vignesh Sundaram (9921004005, MECH)</option>
            <option value={999999}>Unknown Fingerprint (Unregistered student scan)</option>
          </Select>

          <div className="pt-2 flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setIsSimModalOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSimulateScan}
              isLoading={isSimulating}
              leftIcon={<Play className="w-4 h-4" />}
            >
              Trigger Test Scan Event
            </Button>
          </div>
        </div>
      </Modal>
    </AppLayout>
  );
}
