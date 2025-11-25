import { Tag } from 'antd';
import type { Clue } from '@/types';

interface ClueTypeTagProps {
  type: Clue['type'];
}

const typeConfig: Record<Clue['type'], { color: string; text: string }> = {
  text: { color: 'blue', text: 'Text' },
  image: { color: 'purple', text: 'Image' },
};

export default function ClueTypeTag({ type }: ClueTypeTagProps) {
  const config = typeConfig[type] || { color: 'default', text: type };
  return <Tag color={config.color}>{config.text}</Tag>;
}
