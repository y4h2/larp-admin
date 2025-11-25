import { useMemo, useRef } from 'react';
import {
  Card,
  Space,
  Tag,
  Divider,
  Button,
  Dropdown,
  Tooltip,
  Typography,
  Input,
  Modal,
} from 'antd';
import {
  HistoryOutlined,
  StarOutlined,
  StarFilled,
  DownOutlined,
  DeleteOutlined,
  EditOutlined,
  ExportOutlined,
  ImportOutlined,
} from '@ant-design/icons';
import type { Script, NPC, MatchingStrategy } from '@/types';
import type { HistoryPreset, FavoritePreset } from '@/hooks/usePresets';
import type { TFunction } from 'i18next';

const { Text } = Typography;
const { TextArea } = Input;

interface StatusBarProps {
  selectedScript: Script | null;
  selectedNpc: NPC | null;
  matchingStrategy: MatchingStrategy;
  enableNpcReply: boolean;
  npcClueTemplateId: string | undefined;
  npcNoClueTemplateId: string | undefined;
  npcChatConfigId: string | undefined;
  presetHistory: HistoryPreset[];
  presetFavorites: FavoritePreset[];
  favoriteModalOpen: boolean;
  favoriteName: string;
  favoriteNote: string;
  editingFavoriteId: string | null;
  t: TFunction;
  onPresetSelect: (presetId: string) => void;
  onClearHistory: () => void;
  onRemoveFavorite: (id: string) => void;
  onEditFavorite: (favorite: FavoritePreset) => void;
  onOpenFavoriteModal: () => void;
  onCloseFavoriteModal: () => void;
  onFavoriteNameChange: (name: string) => void;
  onFavoriteNoteChange: (note: string) => void;
  onSaveToFavorites: () => void;
  onExportFavorites: () => void;
  onImportFavorites: (file: File) => void;
}

export default function StatusBar({
  selectedScript,
  selectedNpc,
  matchingStrategy,
  enableNpcReply,
  npcClueTemplateId,
  npcNoClueTemplateId,
  npcChatConfigId,
  presetHistory,
  presetFavorites,
  favoriteModalOpen,
  favoriteName,
  favoriteNote,
  editingFavoriteId,
  t,
  onPresetSelect,
  onClearHistory,
  onRemoveFavorite,
  onEditFavorite,
  onOpenFavoriteModal,
  onCloseFavoriteModal,
  onFavoriteNameChange,
  onFavoriteNoteChange,
  onSaveToFavorites,
  onExportFavorites,
  onImportFavorites,
}: StatusBarProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Format relative time for presets
  const formatRelativeTime = (timestamp: number): string => {
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return t('debug.justNow');
    if (minutes < 60) return t('debug.minutesAgo', { count: minutes });
    if (hours < 24) return t('debug.hoursAgo', { count: hours });
    return t('debug.daysAgo', { count: days });
  };

  // Configuration status items
  const configStatus = useMemo(() => {
    const items: { icon: React.ReactNode; label: string; value: string | null; color?: string }[] = [];

    items.push({
      icon: '📜',
      label: t('debug.selectScript'),
      value: selectedScript?.title || null,
    });

    items.push({
      icon: '👤',
      label: t('debug.selectNpc'),
      value: selectedNpc?.name || null,
    });

    const strategyLabels: Record<MatchingStrategy, string> = {
      keyword: t('debug.keywordMatching'),
      embedding: t('debug.embeddingMatching'),
      llm: t('debug.llmMatching'),
    };
    items.push({
      icon: '🎯',
      label: t('debug.matchingStrategy'),
      value: strategyLabels[matchingStrategy],
    });

    if (enableNpcReply) {
      const hasConfig = (npcClueTemplateId || npcNoClueTemplateId) && npcChatConfigId;
      items.push({
        icon: '🤖',
        label: t('debug.npcReplyConfig'),
        value: hasConfig ? t('debug.npcReplyEnabled') : t('debug.npcReplyIncomplete'),
        color: hasConfig ? 'green' : 'orange',
      });
    }

    return items;
  }, [selectedScript, selectedNpc, matchingStrategy, enableNpcReply, npcClueTemplateId, npcNoClueTemplateId, npcChatConfigId, t]);

  // Preset dropdown menu items
  const presetDropdownItems = useMemo(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const items: any[] = [];

    // Favorites section
    if (presetFavorites.length > 0) {
      items.push({
        key: 'favorites-group',
        type: 'group',
        label: (
          <Space>
            <StarFilled style={{ color: '#faad14' }} />
            <span>{t('debug.favorites')}</span>
          </Space>
        ),
        children: presetFavorites.map((f) => ({
          key: f.id,
          label: (
            <div style={{ minWidth: 200 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>{f.name}</span>
                <Space size={0}>
                  <Button
                    type="text"
                    size="small"
                    icon={<EditOutlined />}
                    onClick={(e) => {
                      e.stopPropagation();
                      onEditFavorite(f);
                    }}
                  />
                  <Button
                    type="text"
                    size="small"
                    icon={<DeleteOutlined />}
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemoveFavorite(f.id);
                    }}
                  />
                </Space>
              </div>
              {f.note && (
                <Text type="secondary" style={{ fontSize: 11, display: 'block', marginTop: 2 }}>
                  {f.note}
                </Text>
              )}
            </div>
          ),
        })),
      });
    }

    // History section
    if (presetHistory.length > 0) {
      if (presetFavorites.length > 0) {
        items.push({ key: 'divider-1', type: 'divider' });
      }
      items.push({
        key: 'history-group',
        type: 'group',
        label: (
          <Space style={{ width: '100%', justifyContent: 'space-between' }}>
            <Space>
              <HistoryOutlined />
              <span>{t('debug.recentHistory')}</span>
            </Space>
            {presetHistory.length > 0 && (
              <Button
                type="link"
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  onClearHistory();
                }}
                style={{ padding: 0, height: 'auto' }}
              >
                {t('debug.clear')}
              </Button>
            )}
          </Space>
        ),
        children: presetHistory.map((h) => ({
          key: h.id,
          label: (
            <Space direction="vertical" size={0} style={{ width: '100%' }}>
              <Text ellipsis style={{ maxWidth: 200 }}>{h.name}</Text>
              <Text type="secondary" style={{ fontSize: 11 }}>
                {formatRelativeTime(h.createdAt)}
              </Text>
            </Space>
          ),
        })),
      });
    }

    return items;
  }, [presetFavorites, presetHistory, t, onRemoveFavorite, onClearHistory, onEditFavorite]);

  return (
    <>
      <Card
        size="small"
        style={{ marginBottom: 16 }}
        bodyStyle={{ padding: '8px 16px' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <Space split={<Divider type="vertical" />} wrap>
            {configStatus.map((item, index) => (
              <Space key={index} size={4}>
                <span>{item.icon}</span>
                <Text type="secondary" style={{ fontSize: 12 }}>{item.label}:</Text>
                {item.value ? (
                  <Tag color={item.color || 'blue'} style={{ margin: 0 }}>
                    {item.value}
                  </Tag>
                ) : (
                  <Text type="secondary" style={{ fontSize: 12, fontStyle: 'italic' }}>
                    {t('debug.notConfigured')}
                  </Text>
                )}
              </Space>
            ))}
          </Space>

          {/* Preset controls */}
          <Space>
            <Dropdown
              menu={{
                items: presetDropdownItems.length > 0 ? presetDropdownItems : [
                  { key: 'empty', label: t('debug.noPresets'), disabled: true }
                ],
                onClick: ({ key }) => {
                  if (key !== 'empty' && !key.startsWith('divider') && !key.endsWith('-group')) {
                    onPresetSelect(key);
                  }
                },
              }}
              trigger={['click']}
              disabled={presetDropdownItems.length === 0}
            >
              <Button size="small" icon={<HistoryOutlined />}>
                {t('debug.presets')}
                <DownOutlined style={{ fontSize: 10, marginLeft: 4 }} />
              </Button>
            </Dropdown>
            <Tooltip title={t('debug.saveToFavorites')}>
              <Button
                size="small"
                icon={<StarOutlined />}
                onClick={onOpenFavoriteModal}
                disabled={!selectedScript || !selectedNpc}
              />
            </Tooltip>
            <Divider type="vertical" style={{ margin: '0 4px' }} />
            <Tooltip title={t('debug.exportPresets')}>
              <Button
                size="small"
                icon={<ExportOutlined />}
                onClick={onExportFavorites}
                disabled={presetFavorites.length === 0}
              />
            </Tooltip>
            <Tooltip title={t('debug.importPresets')}>
              <Button
                size="small"
                icon={<ImportOutlined />}
                onClick={() => fileInputRef.current?.click()}
              />
            </Tooltip>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              style={{ display: 'none' }}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  onImportFavorites(file);
                  e.target.value = '';
                }
              }}
            />
          </Space>
        </div>
      </Card>

      {/* Favorite Modal */}
      <Modal
        title={
          <Space>
            <StarFilled style={{ color: '#faad14' }} />
            {editingFavoriteId ? t('debug.editFavorite') : t('debug.saveToFavorites')}
          </Space>
        }
        open={favoriteModalOpen}
        onOk={onSaveToFavorites}
        onCancel={onCloseFavoriteModal}
        okText={t('common.save')}
        cancelText={t('common.cancel')}
      >
        <div style={{ marginTop: 16 }}>
          <div style={{ marginBottom: 8 }}>
            <Text>{t('debug.presetName')}</Text>
          </div>
          <Input
            placeholder={t('debug.enterPresetName')}
            value={favoriteName}
            onChange={(e) => onFavoriteNameChange(e.target.value)}
          />

          <div style={{ marginTop: 16, marginBottom: 8 }}>
            <Text>{t('debug.presetNote')}</Text>
            <Text type="secondary" style={{ marginLeft: 8, fontSize: 12 }}>
              ({t('debug.optional')})
            </Text>
          </div>
          <TextArea
            placeholder={t('debug.enterPresetNote')}
            value={favoriteNote}
            onChange={(e) => onFavoriteNoteChange(e.target.value)}
            rows={3}
            maxLength={200}
            showCount
          />

          <div style={{ marginTop: 12 }}>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {t('debug.presetSaveHint')}
            </Text>
          </div>
        </div>
      </Modal>
    </>
  );
}
