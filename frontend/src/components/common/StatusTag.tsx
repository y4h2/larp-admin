import { Tag } from 'antd';

type StatusType =
  | 'draft' | 'test' | 'online' | 'archived'
  | 'active' | 'disabled' | 'published' | 'deprecated'
  | 'running' | 'completed';

interface StatusTagProps {
  status: StatusType;
}

const statusConfig: Record<StatusType, { color: string; text: string }> = {
  draft: { color: 'default', text: 'Draft' },
  test: { color: 'processing', text: 'Testing' },
  online: { color: 'success', text: 'Online' },
  archived: { color: 'default', text: 'Archived' },
  active: { color: 'success', text: 'Active' },
  disabled: { color: 'error', text: 'Disabled' },
  published: { color: 'success', text: 'Published' },
  deprecated: { color: 'warning', text: 'Deprecated' },
  running: { color: 'processing', text: 'Running' },
  completed: { color: 'default', text: 'Completed' },
};

export default function StatusTag({ status }: StatusTagProps) {
  const config = statusConfig[status] || { color: 'default', text: status };
  return <Tag color={config.color}>{config.text}</Tag>;
}
