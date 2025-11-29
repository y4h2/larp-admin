/**
 * Prefixed NanoID generator for human-readable IDs.
 * Must match backend/app/utils/id_generator.py
 */

import { customAlphabet } from 'nanoid';

// Use URL-safe alphabet without ambiguous characters (0/O, 1/l/I)
const ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz';
const DEFAULT_SIZE = 12;

const nanoid = customAlphabet(ALPHABET, DEFAULT_SIZE);

export enum IDPrefix {
  SCRIPT = 'scr',
  NPC = 'npc',
  CLUE = 'clu',
  PROMPT_TEMPLATE = 'tpl',
  LLM_CONFIG = 'llm',
  DIALOGUE_LOG = 'dlg',
}

/**
 * Generate a prefixed NanoID.
 * @param prefix The entity type prefix
 * @returns A prefixed ID like 'scr_K4x8JqNm2Fpw'
 */
export function generatePrefixedId(prefix: IDPrefix): string {
  return `${prefix}_${nanoid()}`;
}

export function generateScriptId(): string {
  return generatePrefixedId(IDPrefix.SCRIPT);
}

export function generateNpcId(): string {
  return generatePrefixedId(IDPrefix.NPC);
}

export function generateClueId(): string {
  return generatePrefixedId(IDPrefix.CLUE);
}

export function generateTemplateId(): string {
  return generatePrefixedId(IDPrefix.PROMPT_TEMPLATE);
}

export function generateLlmConfigId(): string {
  return generatePrefixedId(IDPrefix.LLM_CONFIG);
}

export function generateDialogueLogId(): string {
  return generatePrefixedId(IDPrefix.DIALOGUE_LOG);
}
