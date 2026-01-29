/**
 * Profile Selector Component
 *
 * Dropdown for selecting/overriding VSI profile for a VM.
 * Shows auto-mapped profile with option to override.
 */

import { useState } from 'react';
import {
  Dropdown,
  Tag,
  Button,
  Tooltip,
} from '@carbon/react';
import { Reset, Edit, Checkmark } from '@carbon/icons-react';
import type { CustomProfile } from '@/hooks/useCustomProfiles';
import './ProfileSelector.scss';

// Standard profile definitions
const STANDARD_PROFILES = {
  // Balanced (bx2) - 1:4 ratio
  'bx2-2x8': { vcpus: 2, memoryGiB: 8, family: 'balanced' },
  'bx2-4x16': { vcpus: 4, memoryGiB: 16, family: 'balanced' },
  'bx2-8x32': { vcpus: 8, memoryGiB: 32, family: 'balanced' },
  'bx2-16x64': { vcpus: 16, memoryGiB: 64, family: 'balanced' },
  'bx2-32x128': { vcpus: 32, memoryGiB: 128, family: 'balanced' },
  'bx2-48x192': { vcpus: 48, memoryGiB: 192, family: 'balanced' },
  'bx2-64x256': { vcpus: 64, memoryGiB: 256, family: 'balanced' },
  'bx2-96x384': { vcpus: 96, memoryGiB: 384, family: 'balanced' },
  'bx2-128x512': { vcpus: 128, memoryGiB: 512, family: 'balanced' },
  // Compute (cx2) - 1:2 ratio
  'cx2-2x4': { vcpus: 2, memoryGiB: 4, family: 'compute' },
  'cx2-4x8': { vcpus: 4, memoryGiB: 8, family: 'compute' },
  'cx2-8x16': { vcpus: 8, memoryGiB: 16, family: 'compute' },
  'cx2-16x32': { vcpus: 16, memoryGiB: 32, family: 'compute' },
  'cx2-32x64': { vcpus: 32, memoryGiB: 64, family: 'compute' },
  'cx2-48x96': { vcpus: 48, memoryGiB: 96, family: 'compute' },
  'cx2-64x128': { vcpus: 64, memoryGiB: 128, family: 'compute' },
  'cx2-96x192': { vcpus: 96, memoryGiB: 192, family: 'compute' },
  'cx2-128x256': { vcpus: 128, memoryGiB: 256, family: 'compute' },
  // Memory (mx2) - 1:8 ratio
  'mx2-2x16': { vcpus: 2, memoryGiB: 16, family: 'memory' },
  'mx2-4x32': { vcpus: 4, memoryGiB: 32, family: 'memory' },
  'mx2-8x64': { vcpus: 8, memoryGiB: 64, family: 'memory' },
  'mx2-16x128': { vcpus: 16, memoryGiB: 128, family: 'memory' },
  'mx2-32x256': { vcpus: 32, memoryGiB: 256, family: 'memory' },
  'mx2-48x384': { vcpus: 48, memoryGiB: 384, family: 'memory' },
  'mx2-64x512': { vcpus: 64, memoryGiB: 512, family: 'memory' },
  'mx2-96x768': { vcpus: 96, memoryGiB: 768, family: 'memory' },
  'mx2-128x1024': { vcpus: 128, memoryGiB: 1024, family: 'memory' },
};

interface ProfileSelectorProps {
  vmName: string;
  autoMappedProfile: string;
  currentProfile: string;
  isOverridden: boolean;
  customProfiles: CustomProfile[];
  onProfileChange: (vmName: string, newProfile: string, originalProfile: string) => void;
  onResetToAuto: (vmName: string) => void;
  compact?: boolean;
}

interface DropdownItem {
  id: string;
  text: string;
  family: string;
  specs: string;
  isCustom?: boolean;
}

export function ProfileSelector({
  vmName,
  autoMappedProfile,
  currentProfile,
  isOverridden,
  customProfiles,
  onProfileChange,
  onResetToAuto,
  compact = false,
}: ProfileSelectorProps) {
  const [isEditing, setIsEditing] = useState(false);

  // Build dropdown items
  const buildDropdownItems = (): DropdownItem[] => {
    const items: DropdownItem[] = [];

    // Group standard profiles by family
    const families = ['balanced', 'compute', 'memory'];
    const familyLabels: Record<string, string> = {
      balanced: 'Balanced (bx2)',
      compute: 'Compute (cx2)',
      memory: 'Memory (mx2)',
    };

    for (const family of families) {
      const familyProfiles = Object.entries(STANDARD_PROFILES)
        .filter(([, spec]) => spec.family === family)
        .map(([name, spec]) => ({
          id: name,
          text: name,
          family: familyLabels[family],
          specs: `${spec.vcpus} vCPU, ${spec.memoryGiB} GiB`,
        }));
      items.push(...familyProfiles);
    }

    // Add custom profiles
    if (customProfiles.length > 0) {
      for (const profile of customProfiles) {
        items.push({
          id: profile.name,
          text: profile.name,
          family: 'Custom',
          specs: `${profile.vcpus} vCPU, ${profile.memoryGiB} GiB`,
          isCustom: true,
        });
      }
    }

    return items;
  };

  const dropdownItems = buildDropdownItems();
  const selectedItem = dropdownItems.find(item => item.id === currentProfile);

  const handleSelect = (selection: { selectedItem: DropdownItem | null }) => {
    if (selection.selectedItem && selection.selectedItem.id !== currentProfile) {
      onProfileChange(vmName, selection.selectedItem.id, autoMappedProfile);
    }
    setIsEditing(false);
  };

  const handleReset = () => {
    onResetToAuto(vmName);
    setIsEditing(false);
  };

  // Compact view (for table cells)
  if (compact && !isEditing) {
    return (
      <div className="profile-selector profile-selector--compact">
        <span className="profile-selector__name">{currentProfile}</span>
        {isOverridden && (
          <Tag type="blue" size="sm" className="profile-selector__tag">
            Override
          </Tag>
        )}
        <Tooltip label="Change profile" align="top">
          <Button
            kind="ghost"
            size="sm"
            hasIconOnly
            iconDescription="Edit profile"
            renderIcon={Edit}
            onClick={() => setIsEditing(true)}
            className="profile-selector__edit-btn"
          />
        </Tooltip>
        {isOverridden && (
          <Tooltip label="Reset to auto-mapped" align="top">
            <Button
              kind="ghost"
              size="sm"
              hasIconOnly
              iconDescription="Reset to auto"
              renderIcon={Reset}
              onClick={handleReset}
              className="profile-selector__reset-btn"
            />
          </Tooltip>
        )}
      </div>
    );
  }

  // Editing or full view
  return (
    <div className="profile-selector">
      <Dropdown
        id={`profile-select-${vmName}`}
        titleText=""
        label="Select profile"
        items={dropdownItems}
        itemToString={(item: DropdownItem | null) =>
          item ? `${item.text} (${item.specs})` : ''
        }
        selectedItem={selectedItem}
        onChange={handleSelect}
        size="sm"
        className="profile-selector__dropdown"
      />
      {isOverridden && (
        <div className="profile-selector__actions">
          <Tag type="blue" size="sm">
            Override (was: {autoMappedProfile})
          </Tag>
          <Button
            kind="ghost"
            size="sm"
            renderIcon={Reset}
            onClick={handleReset}
          >
            Reset
          </Button>
        </div>
      )}
      {compact && isEditing && (
        <Button
          kind="ghost"
          size="sm"
          hasIconOnly
          iconDescription="Done"
          renderIcon={Checkmark}
          onClick={() => setIsEditing(false)}
          className="profile-selector__done-btn"
        />
      )}
    </div>
  );
}

export default ProfileSelector;
