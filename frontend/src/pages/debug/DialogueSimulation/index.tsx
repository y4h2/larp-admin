import { useTranslation } from 'react-i18next';
import { Card, Row, Col, Tabs, Tag } from 'antd';
import {
  SearchOutlined,
  RobotOutlined,
  LockOutlined,
  SettingOutlined,
  AimOutlined,
} from '@ant-design/icons';
import { PageHeader } from '@/components/common';

import {
  ChatPanel,
  StatusBar,
  BasicConfigTab,
  MatchingConfigTab,
  NpcReplyConfigTab,
  MatchResultsPanel,
  LockedCluesPanel,
  NpcTemplatesPanel,
} from './components';
import { useDialogueSimulation } from './hooks/useDialogueSimulation';

export default function DialogueSimulation() {
  const { t } = useTranslation();

  const simulation = useDialogueSimulation(t);

  return (
    <div>
      <PageHeader title={t('debug.simulation')} subtitle={t('debug.simulationSubtitle')} />

      {/* Status Bar */}
      <StatusBar
        selectedScript={simulation.selectedScript}
        selectedNpc={simulation.selectedNpc}
        matchingStrategy={simulation.matchingStrategy}
        enableNpcReply={simulation.enableNpcReply}
        npcClueTemplateId={simulation.npcClueTemplateId}
        npcNoClueTemplateId={simulation.npcNoClueTemplateId}
        npcChatConfigId={simulation.npcChatConfigId}
        presetHistory={simulation.presetHistory}
        presetFavorites={simulation.presetFavorites}
        favoriteModalOpen={simulation.favoriteModalOpen}
        favoriteName={simulation.favoriteName}
        favoriteNote={simulation.favoriteNote}
        editingFavoriteId={simulation.editingFavoriteId}
        t={t}
        onPresetSelect={simulation.handlePresetSelect}
        onClearHistory={simulation.clearHistory}
        onRemoveFavorite={simulation.removeFromFavorites}
        onEditFavorite={simulation.handleEditFavorite}
        onOpenFavoriteModal={simulation.openFavoriteModal}
        onCloseFavoriteModal={simulation.closeFavoriteModal}
        onFavoriteNameChange={simulation.setFavoriteName}
        onFavoriteNoteChange={simulation.setFavoriteNote}
        onSaveToFavorites={simulation.handleSaveToFavorites}
        onExportFavorites={simulation.exportFavorites}
        onImportFavorites={simulation.handleImportFavorites}
      />

      <Row gutter={[16, 16]}>
        {/* Left: Configuration */}
        <Col xs={24} sm={24} md={8} lg={6} xl={6}>
          <Card title={t('debug.configuration')} size="small" styles={{ body: { padding: '0 12px 12px' } }}>
            <Tabs
              size="small"
              items={[
                {
                  key: 'basic',
                  label: (
                    <span>
                      <SettingOutlined />
                      <span style={{ marginLeft: 4 }}>{t('debug.basicConfig')}</span>
                    </span>
                  ),
                  children: (
                    <BasicConfigTab
                      scripts={simulation.scripts}
                      npcs={simulation.npcs}
                      clues={simulation.clues}
                      selectedScriptId={simulation.selectedScriptId}
                      selectedNpcId={simulation.selectedNpcId}
                      unlockedClueIds={simulation.unlockedClueIds}
                      onScriptChange={simulation.handleScriptChange}
                      onNpcChange={simulation.setSelectedNpcId}
                      onUnlockedCluesChange={simulation.setUnlockedClueIds}
                      getNpcName={simulation.getNpcName}
                      t={t}
                    />
                  ),
                },
                {
                  key: 'matching',
                  label: (
                    <span>
                      <AimOutlined />
                      <span style={{ marginLeft: 4 }}>{t('debug.matchingConfig')}</span>
                    </span>
                  ),
                  children: (
                    <MatchingConfigTab
                      matchingStrategy={simulation.matchingStrategy}
                      matchingTemplateId={simulation.matchingTemplateId}
                      matchingLlmConfigId={simulation.matchingLlmConfigId}
                      matchingTemplates={simulation.matchingTemplates}
                      embeddingConfigs={simulation.embeddingConfigs}
                      chatConfigs={simulation.chatConfigs}
                      selectedMatchingConfig={simulation.selectedMatchingConfig}
                      overrideSimilarityThreshold={simulation.overrideSimilarityThreshold}
                      overrideVectorBackend={simulation.overrideVectorBackend}
                      llmReturnAllScores={simulation.llmReturnAllScores}
                      llmScoreThreshold={simulation.llmScoreThreshold}
                      onStrategyChange={simulation.setMatchingStrategy}
                      onTemplateChange={simulation.setMatchingTemplateId}
                      onLlmConfigChange={simulation.setMatchingLlmConfigId}
                      onSimilarityThresholdChange={simulation.setOverrideSimilarityThreshold}
                      onVectorBackendChange={simulation.setOverrideVectorBackend}
                      onLlmReturnAllScoresChange={simulation.setLlmReturnAllScores}
                      onLlmScoreThresholdChange={simulation.setLlmScoreThreshold}
                      t={t}
                    />
                  ),
                },
                {
                  key: 'npc',
                  label: (
                    <span>
                      <RobotOutlined />
                      <span style={{ marginLeft: 4 }}>{t('debug.npcReply')}</span>
                      {simulation.enableNpcReply && <Tag color="green" style={{ marginLeft: 4, fontSize: 10 }}>ON</Tag>}
                    </span>
                  ),
                  children: (
                    <NpcReplyConfigTab
                      enableNpcReply={simulation.enableNpcReply}
                      npcClueTemplateId={simulation.npcClueTemplateId}
                      npcNoClueTemplateId={simulation.npcNoClueTemplateId}
                      npcChatConfigId={simulation.npcChatConfigId}
                      npcSystemTemplates={simulation.npcSystemTemplates}
                      chatConfigs={simulation.chatConfigs}
                      selectedNpcChatConfig={simulation.selectedNpcChatConfig}
                      overrideTemperature={simulation.overrideTemperature}
                      overrideMaxTokens={simulation.overrideMaxTokens}
                      onEnableChange={simulation.setEnableNpcReply}
                      onClueTemplateChange={simulation.setNpcClueTemplateId}
                      onNoClueTemplateChange={simulation.setNpcNoClueTemplateId}
                      onChatConfigChange={simulation.setNpcChatConfigId}
                      onTemperatureChange={simulation.setOverrideTemperature}
                      onMaxTokensChange={simulation.setOverrideMaxTokens}
                      t={t}
                    />
                  ),
                },
              ]}
            />
          </Card>
        </Col>

        {/* Middle: Match Results + Templates + Locked Clues */}
        <Col xs={24} sm={24} md={16} lg={10} xl={10}>
          <Card size="small">
            <Tabs
              defaultActiveKey="clues"
              size="small"
              items={[
                {
                  key: 'clues',
                  label: (
                    <span>
                      <LockOutlined /> {t('debug.lockedClues')}
                      <Tag style={{ marginLeft: 8 }}>{simulation.lockedClues.length}/{simulation.npcClues.length}</Tag>
                    </span>
                  ),
                  children: (
                    <LockedCluesPanel
                      lockedClues={simulation.lockedClues}
                      totalClues={simulation.clues.length}
                      matchingTemplateId={simulation.matchingTemplateId}
                      renderedPreviews={simulation.renderedPreviews}
                      renderingClueId={simulation.renderingClueId}
                      onRenderClue={simulation.handleRenderClue}
                      t={t}
                    />
                  ),
                },
                {
                  key: 'results',
                  label: (
                    <span>
                      <SearchOutlined /> {t('debug.matchResults')}
                      {simulation.lastMatchResults && simulation.lastMatchResults.length > 0 && (
                        <Tag style={{ marginLeft: 8 }}>{simulation.lastMatchResults.length}</Tag>
                      )}
                    </span>
                  ),
                  children: (
                    <MatchResultsPanel
                      lastMatchResults={simulation.lastMatchResults}
                      lastDebugInfo={simulation.lastDebugInfo}
                      selectedMatchingTemplate={simulation.selectedMatchingTemplate}
                      t={t}
                    />
                  ),
                },
                {
                  key: 'npcTemplates',
                  label: (
                    <span>
                      <RobotOutlined /> {t('debug.npcTemplates')}
                    </span>
                  ),
                  disabled: !simulation.enableNpcReply,
                  children: (
                    <NpcTemplatesPanel
                      selectedNpc={simulation.selectedNpc}
                      selectedNpcClueTemplate={simulation.selectedNpcClueTemplate}
                      selectedNpcNoClueTemplate={simulation.selectedNpcNoClueTemplate}
                      npcClueTemplatePreview={simulation.npcClueTemplatePreview}
                      npcNoClueTemplatePreview={simulation.npcNoClueTemplatePreview}
                      renderingNpcClueTemplate={simulation.renderingNpcClueTemplate}
                      renderingNpcNoClueTemplate={simulation.renderingNpcNoClueTemplate}
                      onRenderClueTemplate={simulation.handleRenderNpcClueTemplate}
                      onRenderNoClueTemplate={simulation.handleRenderNpcNoClueTemplate}
                      t={t}
                    />
                  ),
                },
              ]}
            />
          </Card>
        </Col>

        {/* Right: Chat */}
        <Col xs={24} sm={24} md={24} lg={8} xl={8}>
          <ChatPanel
            chatHistory={simulation.chatHistory}
            playerMessage={simulation.playerMessage}
            loading={simulation.loading}
            canSend={!!simulation.selectedScriptId && !!simulation.selectedNpcId}
            t={t}
            onMessageChange={simulation.setPlayerMessage}
            onSend={simulation.handleSend}
            onClear={simulation.handleClear}
          />
        </Col>
      </Row>
    </div>
  );
}
