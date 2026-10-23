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
import { formatDate } from '@/lib/utils';
import { Equipment, EquipmentCondition, EquipmentStatus } from '@/types';
import {
  Cpu,
  Search,
  Filter,
  PlusCircle,
  Edit2,
  Trash2,
  Eye,
  Wrench,
  CheckCircle2,
  ArrowRight
} from 'lucide-react';
import Link from 'next/link';

export default function EquipmentPage() {
  const {
    equipment,
    transactions,
    addEquipment,
    updateEquipment,
    deleteEquipment
  } = useData();

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [conditionFilter, setConditionFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  // Modal States
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState<boolean>(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState<boolean>(false);
  const [selectedItem, setSelectedItem] = useState<Equipment | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    asset_id: '',
    name: '',
    category: 'Testing & Measurement',
    location: 'Main Lab - Bench A',
    status: 'available' as EquipmentStatus,
    condition: 'good' as EquipmentCondition,
    description: ''
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Filtered Equipment
  const filteredEquipment = equipment.filter(item => {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      !searchQuery ||
      item.name.toLowerCase().includes(q) ||
      item.asset_id.toLowerCase().includes(q);

    const matchesStatus = statusFilter === 'all' || item.status === statusFilter;
    const matchesCondition = conditionFilter === 'all' || item.condition === conditionFilter;
    const matchesCategory = categoryFilter === 'all' || item.category === categoryFilter;

    return matchesSearch && matchesStatus && matchesCondition && matchesCategory;
  });

  // Open Edit Modal
  const openEditModal = (item: Equipment) => {
    setSelectedItem(item);
    setFormData({
      asset_id: item.asset_id,
      name: item.name,
      category: item.category,
      location: item.location,
      status: item.status,
      condition: item.condition,
      description: item.description || ''
    });
    setFormError(null);
    setIsEditModalOpen(true);
  };

  // Open Detail Modal
  const openDetailModal = (item: Equipment) => {
    setSelectedItem(item);
    setIsDetailModalOpen(true);
  };

  // Handle Add Item
  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setIsSubmitting(true);

    const res = await addEquipment(formData);
    setIsSubmitting(false);

    if (!res.success) {
      setFormError(res.error || 'Failed to add equipment');
    } else {
      setIsAddModalOpen(false);
      setFormData({
        asset_id: '',
        name: '',
        category: 'Testing & Measurement',
        location: 'Main Lab - Bench A',
        status: 'available',
        condition: 'good',
        description: ''
      });
    }
  };

  // Handle Edit Item
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem) return;
    setFormError(null);
    setIsSubmitting(true);

    const res = await updateEquipment(selectedItem.id, formData);
    setIsSubmitting(false);

    if (!res.success) {
      setFormError(res.error || 'Failed to update equipment');
    } else {
      setIsEditModalOpen(false);
    }
  };

  // Handle Delete Item
  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to remove this equipment item from inventory?')) {
      const res = await deleteEquipment(id);
      if (!res.success) {
        alert(res.error);
      }
    }
  };

  return (
    <AppLayout>
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">
            Laboratory Equipment Inventory
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage laboratory test instruments, developer boards, and sensor kits.
          </p>
        </div>

        <Button
          size="sm"
          onClick={() => {
            setFormData({
              asset_id: `EQ-LAB-${Math.floor(100 + Math.random() * 900)}`,
              name: '',
              category: 'Testing & Measurement',
              location: 'Main Lab - Bench A',
              status: 'available',
              condition: 'good',
              description: ''
            });
            setFormError(null);
            setIsAddModalOpen(true);
          }}
          leftIcon={<PlusCircle className="w-4 h-4" />}
        >
          Add Equipment Asset
        </Button>
      </div>

      {/* Filter and Search Bar */}
      <Card>
        <CardContent className="p-4 flex flex-col md:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search by equipment name or asset ID (e.g. DSO, EQ-DMM)..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-1.5 text-sm rounded-md border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#1B4998]"
            />
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto flex-wrap">
            <Filter className="w-4 h-4 text-slate-400 shrink-0" />

            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="h-9 px-3 text-xs rounded-md border border-slate-300 bg-white text-slate-700"
            >
              <option value="all">All Statuses</option>
              <option value="available">Available Only</option>
              <option value="issued">Issued / On Loan</option>
              <option value="overdue">Overdue</option>
              <option value="damaged">Damaged</option>
              <option value="maintenance">Maintenance</option>
            </select>

            <select
              value={conditionFilter}
              onChange={e => setConditionFilter(e.target.value)}
              className="h-9 px-3 text-xs rounded-md border border-slate-300 bg-white text-slate-700"
            >
              <option value="all">All Conditions</option>
              <option value="good">Good Condition</option>
              <option value="fair">Fair</option>
              <option value="damaged">Damaged</option>
              <option value="needs_repair">Needs Repair</option>
            </select>

            <select
              value={categoryFilter}
              onChange={e => setCategoryFilter(e.target.value)}
              className="h-9 px-3 text-xs rounded-md border border-slate-300 bg-white text-slate-700"
            >
              <option value="all">All Categories</option>
              <option value="Testing & Measurement">Testing & Measurement</option>
              <option value="Signal Sources">Signal Sources</option>
              <option value="Measurement">Measurement</option>
              <option value="Embedded Systems">Embedded Systems</option>
              <option value="Digital Design">Digital Design</option>
              <option value="Power Supplies">Power Supplies</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Equipment Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Cpu className="w-4 h-4 text-[#1B4998]" />
            <CardTitle>Cataloged Assets ({filteredEquipment.length})</CardTitle>
          </div>
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-100 text-slate-500 uppercase text-[10px] font-semibold tracking-wider">
              <tr>
                <th className="px-5 py-3">Asset ID</th>
                <th className="px-5 py-3">Equipment Name</th>
                <th className="px-5 py-3">Category</th>
                <th className="px-5 py-3">Storage Location</th>
                <th className="px-5 py-3">Condition</th>
                <th className="px-5 py-3">Availability</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {filteredEquipment.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-slate-400">
                    No equipment matches the selected filters.
                  </td>
                </tr>
              ) : (
                filteredEquipment.map(item => (
                  <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-5 py-3 font-mono font-semibold text-[#1B4998]">
                      {item.asset_id}
                    </td>
                    <td className="px-5 py-3 font-medium text-slate-900 max-w-[240px] truncate">
                      {item.name}
                    </td>
                    <td className="px-5 py-3 text-slate-600">{item.category}</td>
                    <td className="px-5 py-3 text-slate-600 font-mono text-[11px]">
                      {item.location}
                    </td>
                    <td className="px-5 py-3">
                      <StatusBadge status={item.condition} />
                    </td>
                    <td className="px-5 py-3">
                      <StatusBadge status={item.status} />
                    </td>
                    <td className="px-5 py-3 text-right space-x-1 whitespace-nowrap">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => openDetailModal(item)}
                        className="h-7 w-7 p-0"
                        title="View Asset Details"
                      >
                        <Eye className="w-3.5 h-3.5 text-slate-600" />
                      </Button>

                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => openEditModal(item)}
                        className="h-7 w-7 p-0"
                        title="Edit Asset"
                      >
                        <Edit2 className="w-3.5 h-3.5 text-slate-600" />
                      </Button>

                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDelete(item.id)}
                        className="h-7 w-7 p-0 text-rose-500 hover:text-rose-700"
                        title="Remove Asset"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Add Equipment Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Add Equipment to Inventory"
        description="Register a new laboratory instrument or developer board"
      >
        <form onSubmit={handleAddSubmit} className="space-y-4">
          {formError && (
            <Alert variant="danger" title="Validation Error">
              {formError}
            </Alert>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Asset ID / Serial Number"
              placeholder="e.g. EQ-DSO-105"
              value={formData.asset_id}
              onChange={e => setFormData({ ...formData, asset_id: e.target.value })}
              required
            />

            <Select
              label="Category"
              value={formData.category}
              onChange={e => setFormData({ ...formData, category: e.target.value })}
            >
              <option value="Testing & Measurement">Testing & Measurement</option>
              <option value="Signal Sources">Signal Sources</option>
              <option value="Measurement">Measurement</option>
              <option value="Embedded Systems">Embedded Systems</option>
              <option value="Digital Design">Digital Design</option>
              <option value="Power Supplies">Power Supplies</option>
              <option value="IoT & Sensors">IoT & Sensors</option>
              <option value="Fabrication">Fabrication</option>
            </Select>
          </div>

          <Input
            label="Equipment Name"
            placeholder="e.g. Tektronix 50MHz Oscilloscope"
            value={formData.name}
            onChange={e => setFormData({ ...formData, name: e.target.value })}
            required
          />

          <Input
            label="Laboratory Storage Location"
            placeholder="e.g. Bench A-03 or Cabinet C-02"
            value={formData.location}
            onChange={e => setFormData({ ...formData, location: e.target.value })}
            required
          />

          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Physical Condition"
              value={formData.condition}
              onChange={e =>
                setFormData({ ...formData, condition: e.target.value as EquipmentCondition })
              }
            >
              <option value="good">Good (Ready for Use)</option>
              <option value="fair">Fair (Minor Wear)</option>
              <option value="damaged">Damaged (Faulty)</option>
              <option value="needs_repair">Needs Repair / Calibration</option>
            </Select>

            <Select
              label="Initial Availability Status"
              value={formData.status}
              onChange={e =>
                setFormData({ ...formData, status: e.target.value as EquipmentStatus })
              }
            >
              <option value="available">Available in Lab</option>
              <option value="damaged">Damaged (Tag Out)</option>
              <option value="maintenance">Maintenance</option>
            </Select>
          </div>

          <Input
            label="Technical Notes / Description"
            placeholder="Optional serial number, probe details, calibration date..."
            value={formData.description}
            onChange={e => setFormData({ ...formData, description: e.target.value })}
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
              Add to Inventory
            </Button>
          </div>
        </form>
      </Modal>

      {/* Edit Equipment Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title="Edit Equipment Details"
        description="Update asset specifications, condition, and location"
      >
        <form onSubmit={handleEditSubmit} className="space-y-4">
          {formError && (
            <Alert variant="danger" title="Validation Error">
              {formError}
            </Alert>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Asset ID"
              value={formData.asset_id}
              onChange={e => setFormData({ ...formData, asset_id: e.target.value })}
              required
            />

            <Select
              label="Category"
              value={formData.category}
              onChange={e => setFormData({ ...formData, category: e.target.value })}
            >
              <option value="Testing & Measurement">Testing & Measurement</option>
              <option value="Signal Sources">Signal Sources</option>
              <option value="Measurement">Measurement</option>
              <option value="Embedded Systems">Embedded Systems</option>
              <option value="Digital Design">Digital Design</option>
              <option value="Power Supplies">Power Supplies</option>
              <option value="IoT & Sensors">IoT & Sensors</option>
              <option value="Fabrication">Fabrication</option>
            </Select>
          </div>

          <Input
            label="Equipment Name"
            value={formData.name}
            onChange={e => setFormData({ ...formData, name: e.target.value })}
            required
          />

          <Input
            label="Storage Location"
            value={formData.location}
            onChange={e => setFormData({ ...formData, location: e.target.value })}
            required
          />

          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Condition"
              value={formData.condition}
              onChange={e =>
                setFormData({ ...formData, condition: e.target.value as EquipmentCondition })
              }
            >
              <option value="good">Good</option>
              <option value="fair">Fair</option>
              <option value="damaged">Damaged</option>
              <option value="needs_repair">Needs Repair</option>
            </Select>

            <Select
              label="Status"
              value={formData.status}
              onChange={e =>
                setFormData({ ...formData, status: e.target.value as EquipmentStatus })
              }
            >
              <option value="available">Available</option>
              <option value="issued">Issued (On Loan)</option>
              <option value="overdue">Overdue</option>
              <option value="damaged">Damaged</option>
              <option value="maintenance">Maintenance</option>
            </Select>
          </div>

          <Input
            label="Description"
            value={formData.description}
            onChange={e => setFormData({ ...formData, description: e.target.value })}
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

      {/* Detail Equipment Modal */}
      {selectedItem && (
        <Modal
          isOpen={isDetailModalOpen}
          onClose={() => setIsDetailModalOpen(false)}
          title={selectedItem.name}
          description={`Asset ID: ${selectedItem.asset_id}`}
          maxWidth="lg"
        >
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-xs p-3 rounded-lg bg-slate-50 border border-slate-200">
              <div>
                <span className="text-slate-400 block">Category</span>
                <span className="font-semibold text-slate-800">{selectedItem.category}</span>
              </div>
              <div>
                <span className="text-slate-400 block">Location</span>
                <span className="font-mono text-slate-800">{selectedItem.location}</span>
              </div>
              <div>
                <span className="text-slate-400 block">Condition</span>
                <StatusBadge status={selectedItem.condition} />
              </div>
              <div>
                <span className="text-slate-400 block">Availability</span>
                <StatusBadge status={selectedItem.status} />
              </div>
            </div>

            {selectedItem.description && (
              <div className="text-xs text-slate-600 bg-white p-3 rounded-md border border-slate-200">
                <span className="font-semibold text-slate-800 block mb-1">Specifications / Notes</span>
                {selectedItem.description}
              </div>
            )}

            {/* Current Borrower (if issued) */}
            {selectedItem.current_borrower && (
              <div className="p-3 rounded-lg bg-blue-50/70 border border-blue-200 text-xs space-y-1">
                <span className="font-semibold text-[#1B4998] block">Currently Issued To:</span>
                <div className="flex justify-between text-slate-900 font-medium">
                  <span>{selectedItem.current_borrower.student_name}</span>
                  <span className="font-mono">{selectedItem.current_borrower.reg_number}</span>
                </div>
                <div className="text-[10px] text-slate-500 pt-1 border-t border-blue-100 flex justify-between">
                  <span>Issued: {formatDate(selectedItem.current_borrower.issued_at)}</span>
                  <span>Due: {formatDate(selectedItem.current_borrower.due_at)}</span>
                </div>
              </div>
            )}

            {/* Complete Transaction History */}
            <div>
              <h5 className="font-semibold text-xs text-slate-800 mb-2">Loan History for Asset</h5>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {transactions.filter(t => t.equipment_id === selectedItem.id).length === 0 ? (
                  <p className="text-xs text-slate-400 py-3 text-center border rounded-md">
                    No borrowing records for this item.
                  </p>
                ) : (
                  transactions
                    .filter(t => t.equipment_id === selectedItem.id)
                    .map(t => (
                      <div
                        key={t.id}
                        className="p-2.5 rounded-md border border-slate-200 text-xs flex items-center justify-between"
                      >
                        <div>
                          <div className="font-semibold text-slate-900">
                            {t.student?.full_name} ({t.student?.reg_number})
                          </div>
                          <div className="text-[10px] text-slate-500">
                            Issued: {formatDate(t.issued_at)} • Returned:{' '}
                            {t.returned_at ? formatDate(t.returned_at) : 'Active'}
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
