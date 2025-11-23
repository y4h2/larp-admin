import { Tag } from 'antd';
import type { Clue } from '@/types';

interface ClueTypeTagProps {
  type: Clue['clue_type'];
}

const typeConfig: Record<Clue['clue_type'], { color: string; text: string }> = {
  evidence: { color: 'red', text: 'Evidence' },
  testimony: { color: 'blue', text: 'Testimony' },
  world_info: { color: 'green', text: 'World Info' },
  decoy: { color: 'orange', text: 'Decoy' },
};

export default function ClueTypeTag({ type }: ClueTypeTagProps) {
  const config = typeConfig[type];
  return <Tag color={config.color}>{config.text}</Tag>;
}

interface ImportanceTagProps {
  importance: Clue['importance'];
}

const importanceConfig: Record<Clue['importance'], { color: string; text: string }> = {
  critical: { color: 'red', text: 'Critical' },
  major: { color: 'orange', text: 'Major' },
  minor: { color: 'blue', text: 'Minor' },
  easter_egg: { color: 'purple', text: 'Easter Egg' },
};

export function ImportanceTag({ importance }: ImportanceTagProps) {
  const config = importanceConfig[importance];
  return <Tag color={config.color}>{config.text}</Tag>;
}

interface RoleTypeTagProps {
  roleType: 'suspect' | 'witness' | 'other';
}

const roleTypeConfig: Record<'suspect' | 'witness' | 'other', { color: string; text: string }> = {
  suspect: { color: 'red', text: 'Suspect' },
  witness: { color: 'blue', text: 'Witness' },
  other: { color: 'default', text: 'Other' },
};

export function RoleTypeTag({ roleType }: RoleTypeTagProps) {
  const config = roleTypeConfig[roleType];
  return <Tag color={config.color}>{config.text}</Tag>;
}
