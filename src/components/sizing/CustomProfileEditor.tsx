/**
 * Custom Profile Editor Component
 *
 * Modal for creating and editing custom VSI profiles.
 * Allows users to define profiles with custom specs and pricing.
 */

import { useState, useEffect } from 'react';
import {
  Modal,
  TextInput,
  NumberInput,
  Select,
  SelectItem,
  InlineNotification,
  DataTable,
  Table,
  TableHead,
  TableRow,
  TableHeader,
  TableBody,
  TableCell,
  Button,
  Tag,
} from '@carbon/react';
import { Add, TrashCan, Edit } from '@carbon/icons-react';
import type { CustomProfile } from '@/hooks/useCustomProfiles';
import './CustomProfileEditor.scss';

const HOURS_PER_MONTH = 730;

interface CustomProfileEditorProps {
  isOpen: boolean;
  onClose: () => void;
  customProfiles: CustomProfile[];
  onAddProfile: (profile: Omit<CustomProfile, 'id' | 'isCustom'>) => void;
  onUpdateProfile: (id: string, updates: Partial<CustomProfile>) => void;
  onRemoveProfile: (id: string) => void;
}

interface FormState {
  name: string;
  family: 'balanced' | 'compute' | 'memory' | 'custom';
  vcpus: number;
  memoryGiB: number;
  hourlyRate: number;
  description: string;
}

const initialFormState: FormState = {
  name: '',
  family: 'custom',
  vcpus: 2,
  memoryGiB: 4,
  hourlyRate: 0.10,
  description: '',
};

export function CustomProfileEditor({
  isOpen,
  onClose,
  customProfiles,
  onAddProfile,
  onUpdateProfile,
  onRemoveProfile,
}: CustomProfileEditorProps) {
  const [formState, setFormState] = useState<FormState>(initialFormState);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  // Reset form when modal closes
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!isOpen) {
      setFormState(initialFormState);
      setEditingId(null);
      setError(null);
      setShowForm(false);
    }
  }, [isOpen]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const validateForm = (): boolean => {
    if (!formState.name.trim()) {
      setError('Profile name is required');
      return false;
    }

    // Check for duplicate names (excluding current edit)
    const isDuplicate = customProfiles.some(
      p => p.name === formState.name.trim() && p.id !== editingId
    );
    if (isDuplicate) {
      setError('A profile with this name already exists');
      return false;
    }

    // Check name format (should be lowercase with hyphens)
    const namePattern = /^[a-z0-9]+-\d+x\d+$/;
    if (!namePattern.test(formState.name.trim())) {
      setError('Profile name should follow format: family-vcpuxmemory (e.g., custom-4x16)');
      return false;
    }

    if (formState.vcpus < 1 || formState.vcpus > 256) {
      setError('vCPUs must be between 1 and 256');
      return false;
    }

    if (formState.memoryGiB < 1 || formState.memoryGiB > 2048) {
      setError('Memory must be between 1 and 2048 GiB');
      return false;
    }

    if (formState.hourlyRate <= 0) {
      setError('Hourly rate must be greater than 0');
      return false;
    }

    setError(null);
    return true;
  };

  const handleSubmit = () => {
    if (!validateForm()) return;

    const profileData = {
      name: formState.name.trim(),
      family: formState.family,
      vcpus: formState.vcpus,
      memoryGiB: formState.memoryGiB,
      hourlyRate: formState.hourlyRate,
      monthlyRate: Math.round(formState.hourlyRate * HOURS_PER_MONTH * 100) / 100,
      description: formState.description.trim() || undefined,
    };

    if (editingId) {
      onUpdateProfile(editingId, profileData);
    } else {
      onAddProfile(profileData);
    }

    // Reset form
    setFormState(initialFormState);
    setEditingId(null);
    setShowForm(false);
  };

  const handleEdit = (profile: CustomProfile) => {
    setFormState({
      name: profile.name,
      family: profile.family,
      vcpus: profile.vcpus,
      memoryGiB: profile.memoryGiB,
      hourlyRate: profile.hourlyRate,
      description: profile.description || '',
    });
    setEditingId(profile.id);
    setShowForm(true);
    setError(null);
  };

  const handleCancel = () => {
    setFormState(initialFormState);
    setEditingId(null);
    setShowForm(false);
    setError(null);
  };

  const handleNameGenerate = () => {
    const prefix = formState.family === 'custom' ? 'custom' : formState.family.charAt(0) + 'x2';
    const name = `${prefix}-${formState.vcpus}x${formState.memoryGiB}`;
    setFormState(prev => ({ ...prev, name }));
  };

  // Table data
  const tableHeaders = [
    { key: 'name', header: 'Profile Name' },
    { key: 'specs', header: 'Specs' },
    { key: 'hourly', header: 'Hourly' },
    { key: 'monthly', header: 'Monthly' },
    { key: 'actions', header: '' },
  ];

  const tableRows = customProfiles.map(profile => ({
    id: profile.id,
    name: profile.name,
    specs: `${profile.vcpus} vCPU, ${profile.memoryGiB} GiB`,
    hourly: `$${profile.hourlyRate.toFixed(4)}`,
    monthly: `$${profile.monthlyRate.toFixed(2)}`,
  }));

  return (
    <Modal
      open={isOpen}
      onRequestClose={onClose}
      modalHeading="Custom VSI Profiles"
      primaryButtonText={showForm ? (editingId ? 'Update Profile' : 'Add Profile') : 'Close'}
      secondaryButtonText={showForm ? 'Cancel' : undefined}
      onRequestSubmit={showForm ? handleSubmit : onClose}
      onSecondarySubmit={showForm ? handleCancel : undefined}
      size="lg"
      className="custom-profile-editor"
      aria-describedby="custom-profile-description"
    >
      <div className="custom-profile-editor__content">
        <p id="custom-profile-description" className="custom-profile-editor__description">
          Define custom VSI profiles with your own specifications and pricing.
          Custom profiles can be used to override auto-mapped profiles for specific VMs.
        </p>

        {/* Existing Profiles Table */}
        {customProfiles.length > 0 && !showForm && (
          <div className="custom-profile-editor__table">
            <DataTable rows={tableRows} headers={tableHeaders} size="sm">
              {({ rows, headers, getTableProps, getHeaderProps, getRowProps }) => (
                <Table {...getTableProps()} aria-label="Custom VSI profiles">
                  <TableHead>
                    <TableRow>
                      {headers.map(header => (
                        <TableHeader {...getHeaderProps({ header })} key={header.key}>
                          {header.header}
                        </TableHeader>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {rows.map(row => {
                      const profile = customProfiles.find(p => p.id === row.id);
                      return (
                        <TableRow {...getRowProps({ row })} key={row.id}>
                          <TableCell>
                            <code>{row.cells[0].value}</code>
                            <Tag type="purple" size="sm" style={{ marginLeft: '8px' }}>
                              Custom
                            </Tag>
                          </TableCell>
                          <TableCell>{row.cells[1].value}</TableCell>
                          <TableCell>{row.cells[2].value}</TableCell>
                          <TableCell>{row.cells[3].value}</TableCell>
                          <TableCell>
                            <Button
                              kind="ghost"
                              size="sm"
                              hasIconOnly
                              iconDescription="Edit"
                              renderIcon={Edit}
                              onClick={() => profile && handleEdit(profile)}
                            />
                            <Button
                              kind="ghost"
                              size="sm"
                              hasIconOnly
                              iconDescription="Delete"
                              renderIcon={TrashCan}
                              onClick={() => onRemoveProfile(row.id)}
                            />
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </DataTable>
          </div>
        )}

        {/* Add New Button */}
        {!showForm && (
          <Button
            kind="tertiary"
            size="sm"
            renderIcon={Add}
            onClick={() => setShowForm(true)}
            className="custom-profile-editor__add-btn"
          >
            Add Custom Profile
          </Button>
        )}

        {/* Form */}
        {showForm && (
          <div className="custom-profile-editor__form">
            <h4>{editingId ? 'Edit Profile' : 'New Custom Profile'}</h4>

            {error && (
              <InlineNotification
                kind="error"
                title="Validation Error"
                subtitle={error}
                lowContrast
                hideCloseButton
              />
            )}

            <div className="custom-profile-editor__form-grid">
              <Select
                id="profile-family"
                labelText="Profile Family"
                value={formState.family}
                onChange={(e) => setFormState(prev => ({
                  ...prev,
                  family: e.target.value as FormState['family']
                }))}
              >
                <SelectItem value="custom" text="Custom" />
                <SelectItem value="balanced" text="Balanced (like bx2)" />
                <SelectItem value="compute" text="Compute (like cx2)" />
                <SelectItem value="memory" text="Memory (like mx2)" />
              </Select>

              <NumberInput
                id="profile-vcpus"
                label="vCPUs"
                min={1}
                max={256}
                value={formState.vcpus}
                onChange={(_, { value }) => setFormState(prev => ({
                  ...prev,
                  vcpus: Number(value) || 1
                }))}
              />

              <NumberInput
                id="profile-memory"
                label="Memory (GiB)"
                min={1}
                max={2048}
                value={formState.memoryGiB}
                onChange={(_, { value }) => setFormState(prev => ({
                  ...prev,
                  memoryGiB: Number(value) || 1
                }))}
              />

              <NumberInput
                id="profile-hourly"
                label="Hourly Rate ($)"
                min={0.001}
                max={100}
                step={0.001}
                value={formState.hourlyRate}
                onChange={(_, { value }) => setFormState(prev => ({
                  ...prev,
                  hourlyRate: Number(value) || 0.001
                }))}
              />

              <div className="custom-profile-editor__name-row">
                <TextInput
                  id="profile-name"
                  labelText="Profile Name"
                  placeholder="e.g., custom-4x16"
                  value={formState.name}
                  onChange={(e) => setFormState(prev => ({ ...prev, name: e.target.value }))}
                  helperText="Format: family-vcpuxmemory"
                />
                <Button
                  kind="ghost"
                  size="sm"
                  onClick={handleNameGenerate}
                  className="custom-profile-editor__generate-btn"
                >
                  Auto-generate
                </Button>
              </div>

              <TextInput
                id="profile-description"
                labelText="Description (optional)"
                placeholder="e.g., SAP HANA optimized"
                value={formState.description}
                onChange={(e) => setFormState(prev => ({ ...prev, description: e.target.value }))}
              />
            </div>

            <div className="custom-profile-editor__preview">
              <strong>Preview:</strong>{' '}
              <code>{formState.name || '(enter name)'}</code> —{' '}
              {formState.vcpus} vCPU, {formState.memoryGiB} GiB —{' '}
              ${formState.hourlyRate.toFixed(4)}/hr (${(formState.hourlyRate * HOURS_PER_MONTH).toFixed(2)}/mo)
            </div>
          </div>
        )}

        {/* Empty State */}
        {customProfiles.length === 0 && !showForm && (
          <div className="custom-profile-editor__empty">
            <p>No custom profiles defined yet.</p>
            <p>Click "Add Custom Profile" to create a new profile with custom specs and pricing.</p>
          </div>
        )}
      </div>
    </Modal>
  );
}

export default CustomProfileEditor;
