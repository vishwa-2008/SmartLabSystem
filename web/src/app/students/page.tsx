'use client';

import React, { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Modal } from '@/components/ui/Modal';
import { StatusBadge, Badge } from '@/components/ui/Badge';
import { Alert } from '@/components/ui/Alert';
import { useData } from '@/context/DataContext';
import { formatDate } from '@/lib/utils';
import { Student } from '@/types';
import {
  Users,
  Search,
  Filter,
  PlusCircle,
  Fingerprint,
  Edit2,
  Trash2,
  Eye,
  CheckCircle2,
  XCircle,
  PackageCheck
} from 'lucide-react';
import Link from 'next/link';

export default function StudentsPage() {
  const {
    students,
    transactions,
    scans,
    addStudent,
    updateStudent,
    toggleStudentStatus
  } = useData();

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [departmentFilter, setDepartmentFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [yearFilter, setYearFilter] = useState<string>('all');

  // Modal States
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState<boolean>(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState<boolean>(false);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    reg_number: '',
    full_name: '',
    department: 'Computer Science and Engineering',
    section: 'A',
    year: 3,
    phone: '',
    active: true
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Filter students
  const filteredStudents = students.filter(student => {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      !searchQuery ||
      student.full_name.toLowerCase().includes(q) ||
      student.reg_number.toLowerCase().includes(q);

    const matchesDept = departmentFilter === 'all' || student.department === departmentFilter;
    const matchesStatus =
      statusFilter === 'all' ||
      (statusFilter === 'active' && student.active) ||
      (statusFilter === 'inactive' && !student.active);
    const matchesYear = yearFilter === 'all' || student.year === Number(yearFilter);

    return matchesSearch && matchesDept && matchesStatus && matchesYear;
  });

  // Open Edit Modal
  const openEditModal = (student: Student) => {
    setSelectedStudent(student);
    setFormData({
      reg_number: student.reg_number,
      full_name: student.full_name,
      department: student.department,
      section: student.section,
      year: student.year,
      phone: student.phone || '',
      active: student.active
    });
    setFormError(null);
    setIsEditModalOpen(true);
  };

  // Open Details Modal
  const openDetailModal = (student: Student) => {
    setSelectedStudent(student);
    setIsDetailModalOpen(true);
  };

  // Handle Add Student
  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setIsSubmitting(true);

    const res = await addStudent({
      ...formData,
      year: Number(formData.year),
      fingerprint_enrolled: false
    });

    setIsSubmitting(false);
    if (!res.success) {
      setFormError(res.error || 'Failed to register student');
    } else {
      setIsAddModalOpen(false);
      setFormData({
        reg_number: '',
        full_name: '',
        department: 'Computer Science and Engineering',
        section: 'A',
        year: 3,
        phone: '',
        active: true
      });
    }
  };

  // Handle Edit Student
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudent) return;
    setFormError(null);
    setIsSubmitting(true);

    const res = await updateStudent(selectedStudent.id, {
      ...formData,
      year: Number(formData.year)
    });

    setIsSubmitting(false);
    if (!res.success) {
      setFormError(res.error || 'Failed to update student');
    } else {
      setIsEditModalOpen(false);
    }
  };

  return (
    <AppLayout>
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">
            Student Laboratory Directory
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage student registrations, departments, sections, and biometric enrollment status.
          </p>
        </div>

        <Button
          size="sm"
          onClick={() => {
            setFormData({
              reg_number: '',
              full_name: '',
              department: 'Computer Science and Engineering',
              section: 'A',
              year: 3,
              phone: '',
              active: true
            });
            setFormError(null);
            setIsAddModalOpen(true);
          }}
          leftIcon={<PlusCircle className="w-4 h-4" />}
        >
          Register New Student
        </Button>
      </div>

      {/* Filter and Search Bar */}
      <Card>
        <CardContent className="p-4 flex flex-col md:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search by student name or registration number..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-1.5 text-sm rounded-md border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#1B4998]"
            />
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto flex-wrap">
            <Filter className="w-4 h-4 text-slate-400 shrink-0" />

            <select
              value={departmentFilter}
              onChange={e => setDepartmentFilter(e.target.value)}
              className="h-9 px-3 text-xs rounded-md border border-slate-300 bg-white text-slate-700"
            >
              <option value="all">All Departments</option>
              <option value="Computer Science and Engineering">CSE</option>
              <option value="Electronics and Communication">ECE</option>
              <option value="Electrical and Electronics">EEE</option>
              <option value="Mechanical Engineering">MECH</option>
              <option value="Information Technology">IT</option>
            </select>

            <select
              value={yearFilter}
              onChange={e => setYearFilter(e.target.value)}
              className="h-9 px-3 text-xs rounded-md border border-slate-300 bg-white text-slate-700"
            >
              <option value="all">All Years</option>
              <option value="1">Year 1</option>
              <option value="2">Year 2</option>
              <option value="3">Year 3</option>
              <option value="4">Year 4</option>
            </select>

            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="h-9 px-3 text-xs rounded-md border border-slate-300 bg-white text-slate-700"
            >
              <option value="all">All Statuses</option>
              <option value="active">Active Only</option>
              <option value="inactive">Inactive Only</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Student Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-[#1B4998]" />
            <CardTitle>Registered Students ({filteredStudents.length})</CardTitle>
          </div>
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-100 text-slate-500 uppercase text-[10px] font-semibold tracking-wider">
              <tr>
                <th className="px-5 py-3">Registration No</th>
                <th className="px-5 py-3">Full Name</th>
                <th className="px-5 py-3">Department</th>
                <th className="px-5 py-3">Sec / Year</th>
                <th className="px-5 py-3">Biometrics</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-slate-400">
                    No students match the selected filters.
                  </td>
                </tr>
              ) : (
                filteredStudents.map(student => (
                  <tr key={student.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-5 py-3 font-mono font-semibold text-[#1B4998]">
                      {student.reg_number}
                    </td>
                    <td className="px-5 py-3 font-medium text-slate-900">
                      {student.full_name}
                    </td>
                    <td className="px-5 py-3 text-slate-600">{student.department}</td>
                    <td className="px-5 py-3 text-slate-600">
                      Sec {student.section} • Year {student.year}
                    </td>
                    <td className="px-5 py-3">
                      {student.fingerprint_enrolled ? (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-800 border border-emerald-200">
                          <Fingerprint className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Slot #{student.template_id}</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-50 text-amber-800 border border-amber-200">
                          <XCircle className="w-3.5 h-3.5 text-amber-600" />
                          <span>Not Enrolled</span>
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <StatusBadge status={student.active ? 'active' : 'inactive'} />
                    </td>
                    <td className="px-5 py-3 text-right space-x-1 whitespace-nowrap">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => openDetailModal(student)}
                        className="h-7 w-7 p-0"
                        title="View Full Profile"
                      >
                        <Eye className="w-3.5 h-3.5 text-slate-600" />
                      </Button>

                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => openEditModal(student)}
                        className="h-7 w-7 p-0"
                        title="Edit Student"
                      >
                        <Edit2 className="w-3.5 h-3.5 text-slate-600" />
                      </Button>

                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => toggleStudentStatus(student.id)}
                        className="h-7 w-7 p-0"
                        title={student.active ? 'Deactivate Account' : 'Reactivate Account'}
                      >
                        {student.active ? (
                          <XCircle className="w-3.5 h-3.5 text-rose-500" />
                        ) : (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        )}
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Add Student Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Register New Student"
        description="Add a new engineering student to the Smart Lab registry"
      >
        <form onSubmit={handleAddSubmit} className="space-y-4">
          {formError && (
            <Alert variant="danger" title="Validation Error">
              {formError}
            </Alert>
          )}

          <Input
            label="Registration Number"
            placeholder="e.g. 9921004010"
            value={formData.reg_number}
            onChange={e => setFormData({ ...formData, reg_number: e.target.value })}
            required
          />

          <Input
            label="Full Name"
            placeholder="Student's official name"
            value={formData.full_name}
            onChange={e => setFormData({ ...formData, full_name: e.target.value })}
            required
          />

          <Select
            label="Department / Branch"
            value={formData.department}
            onChange={e => setFormData({ ...formData, department: e.target.value })}
          >
            <option value="Computer Science and Engineering">Computer Science and Engineering</option>
            <option value="Electronics and Communication">Electronics and Communication</option>
            <option value="Electrical and Electronics">Electrical and Electronics</option>
            <option value="Mechanical Engineering">Mechanical Engineering</option>
            <option value="Information Technology">Information Technology</option>
          </Select>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Section"
              placeholder="A, B, or C"
              value={formData.section}
              onChange={e => setFormData({ ...formData, section: e.target.value })}
              required
            />

            <Select
              label="Academic Year"
              value={formData.year}
              onChange={e => setFormData({ ...formData, year: Number(e.target.value) })}
            >
              <option value={1}>1st Year</option>
              <option value={2}>2nd Year</option>
              <option value={3}>3rd Year</option>
              <option value={4}>4th Year</option>
            </Select>
          </div>

          <Input
            label="Contact Mobile (Optional)"
            placeholder="+91 98765 43210"
            value={formData.phone}
            onChange={e => setFormData({ ...formData, phone: e.target.value })}
          />

          <div className="pt-2 flex justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsAddModalOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" isLoading={isSubmitting}>
              Register Student
            </Button>
          </div>
        </form>
      </Modal>

      {/* Edit Student Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title="Edit Student Profile"
        description="Update student demographic and academic details"
      >
        <form onSubmit={handleEditSubmit} className="space-y-4">
          {formError && (
            <Alert variant="danger" title="Validation Error">
              {formError}
            </Alert>
          )}

          <Input
            label="Registration Number"
            value={formData.reg_number}
            onChange={e => setFormData({ ...formData, reg_number: e.target.value })}
            required
          />

          <Input
            label="Full Name"
            value={formData.full_name}
            onChange={e => setFormData({ ...formData, full_name: e.target.value })}
            required
          />

          <Select
            label="Department / Branch"
            value={formData.department}
            onChange={e => setFormData({ ...formData, department: e.target.value })}
          >
            <option value="Computer Science and Engineering">Computer Science and Engineering</option>
            <option value="Electronics and Communication">Electronics and Communication</option>
            <option value="Electrical and Electronics">Electrical and Electronics</option>
            <option value="Mechanical Engineering">Mechanical Engineering</option>
            <option value="Information Technology">Information Technology</option>
          </Select>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Section"
              value={formData.section}
              onChange={e => setFormData({ ...formData, section: e.target.value })}
              required
            />

            <Select
              label="Academic Year"
              value={formData.year}
              onChange={e => setFormData({ ...formData, year: Number(e.target.value) })}
            >
              <option value={1}>1st Year</option>
              <option value={2}>2nd Year</option>
              <option value={3}>3rd Year</option>
              <option value={4}>4th Year</option>
            </Select>
          </div>

          <Input
            label="Contact Mobile"
            value={formData.phone}
            onChange={e => setFormData({ ...formData, phone: e.target.value })}
          />

          <div className="pt-2 flex justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsEditModalOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" isLoading={isSubmitting}>
              Save Changes
            </Button>
          </div>
        </form>
      </Modal>

      {/* Student Detail Modal */}
      {selectedStudent && (
        <Modal
          isOpen={isDetailModalOpen}
          onClose={() => setIsDetailModalOpen(false)}
          title={selectedStudent.full_name}
          description={`Registration No: ${selectedStudent.reg_number}`}
          maxWidth="lg"
        >
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-xs p-3 rounded-lg bg-slate-50 border border-slate-200">
              <div>
                <span className="text-slate-400 block">Department</span>
                <span className="font-semibold text-slate-800">{selectedStudent.department}</span>
              </div>
              <div>
                <span className="text-slate-400 block">Class & Year</span>
                <span className="font-semibold text-slate-800">
                  Section {selectedStudent.section} • Year {selectedStudent.year}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block">Contact Phone</span>
                <span className="font-mono text-slate-800">{selectedStudent.phone || 'None'}</span>
              </div>
              <div>
                <span className="text-slate-400 block">Account Status</span>
                <StatusBadge status={selectedStudent.active ? 'active' : 'inactive'} />
              </div>
            </div>

            {/* Fingerprint Status Card */}
            <div className="p-3 rounded-lg border border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-[#1B4998]/10 text-[#1B4998] flex items-center justify-center">
                  <Fingerprint className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-xs font-semibold text-slate-900">
                    {selectedStudent.fingerprint_enrolled
                      ? `Enrolled in Sensor Slot #${selectedStudent.template_id}`
                      : 'No Fingerprint Enrolled'}
                  </div>
                  <div className="text-[10px] text-slate-500">
                    {selectedStudent.fingerprint_enrolled
                      ? 'Student can authenticate at ESP32 reader.'
                      : 'Enroll student to enable fast biometric equipment checkouts.'}
                  </div>
                </div>
              </div>

              {!selectedStudent.fingerprint_enrolled && (
                <Link href="/scans">
                  <Button size="sm" variant="outline" className="text-xs">
                    Enroll Now
                  </Button>
                </Link>
              )}
            </div>

            {/* Loan History for this student */}
            <div>
              <h5 className="font-semibold text-xs text-slate-800 mb-2">Equipment Loan History</h5>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {transactions.filter(t => t.student_id === selectedStudent.id).length === 0 ? (
                  <p className="text-xs text-slate-400 py-3 text-center border rounded-md">
                    No borrowing transactions recorded yet.
                  </p>
                ) : (
                  transactions
                    .filter(t => t.student_id === selectedStudent.id)
                    .map(t => (
                      <div
                        key={t.id}
                        className="p-2.5 rounded-md border border-slate-200 text-xs flex items-center justify-between"
                      >
                        <div>
                          <div className="font-semibold text-slate-900">{t.equipment?.name}</div>
                          <div className="text-[10px] text-slate-500">
                            Issued: {formatDate(t.issued_at)} • Due: {formatDate(t.due_at)}
                          </div>
                        </div>
                        <StatusBadge status={t.status} />
                      </div>
                    ))
                )}
              </div>
            </div>
          </div>
        </Modal>
      )}
    </AppLayout>
  );
}
