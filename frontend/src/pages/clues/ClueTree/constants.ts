import type { ClueNodeField, ClueFieldConfig } from './types';

export const DEFAULT_VISIBLE_FIELDS: ClueNodeField[] = ['name', 'type'];

// All available fields with their i18n keys
export const ALL_CLUE_FIELDS: ClueFieldConfig[] = [
  { field: 'name', labelKey: 'common.name' },
  { field: 'type', labelKey: 'clue.type' },
  { field: 'detail', labelKey: 'clue.detail' },
  { field: 'npc_id', labelKey: 'common.npc' },
  { field: 'prereq_clue_ids', labelKey: 'clue.prerequisites' },
  { field: 'trigger_keywords', labelKey: 'clue.triggerKeywords' },
  { field: 'created_at', labelKey: 'common.createdAt' },
  { field: 'updated_at', labelKey: 'common.updatedAt' },
];

// Local storage key for saved positions
export const POSITIONS_STORAGE_KEY = 'clue-tree-positions';
