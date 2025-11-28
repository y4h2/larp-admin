import { useEffect, useState } from 'react';
import { Badge, Tag, Tooltip, notification } from 'antd';
import { SyncOutlined, CheckCircleOutlined, WarningOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import type { MergeResult } from '@/utils/autoMerge';
import { formatUpdatedFields } from '@/utils/autoMerge';

interface SyncStatusProps {
  isConnected: boolean;
  lastMergeResult: MergeResult<unknown> | null;
  showNotification?: boolean;
}

export default function SyncStatus({
  isConnected,
  lastMergeResult,
  showNotification = true,
}: SyncStatusProps) {
  const { t } = useTranslation();
  const [showMergeIndicator, setShowMergeIndicator] = useState(false);

  // Show notification when merge happens
  useEffect(() => {
    if (lastMergeResult?.hasRemoteChanges && showNotification) {
      setShowMergeIndicator(true);

      const fieldsStr = formatUpdatedFields(lastMergeResult.updatedFields);
      const hasConflicts = lastMergeResult.conflicts.length > 0;

      if (hasConflicts) {
        notification.warning({
          title: t('sync.conflictResolved'),
          description: t('sync.fieldsUpdated', { fields: fieldsStr }),
          duration: 4,
        });
      } else {
        notification.info({
          title: t('sync.autoMerged', { name: 'Another user' }),
          description: t('sync.fieldsUpdated', { fields: fieldsStr }),
          duration: 3,
        });
      }

      // Hide the merge indicator after a few seconds
      const timer = setTimeout(() => setShowMergeIndicator(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [lastMergeResult, showNotification, t]);

  if (!isConnected) {
    return (
      <Tooltip title={t('sync.syncing')}>
        <Tag icon={<SyncOutlined spin />} color="processing">
          {t('sync.syncing')}
        </Tag>
      </Tooltip>
    );
  }

  if (showMergeIndicator && lastMergeResult?.hasRemoteChanges) {
    const hasConflicts = lastMergeResult.conflicts.length > 0;
    return (
      <Tooltip
        title={
          hasConflicts
            ? t('sync.conflictResolved')
            : t('sync.fieldsUpdated', {
                fields: formatUpdatedFields(lastMergeResult.updatedFields),
              })
        }
      >
        <Tag
          icon={hasConflicts ? <WarningOutlined /> : <CheckCircleOutlined />}
          color={hasConflicts ? 'warning' : 'success'}
        >
          {hasConflicts ? t('sync.conflictResolved') : t('sync.synced')}
        </Tag>
      </Tooltip>
    );
  }

  return (
    <Tooltip title={t('sync.synced')}>
      <Badge status="success" text={t('sync.synced')} />
    </Tooltip>
  );
}
