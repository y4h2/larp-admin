import { Tooltip } from 'antd';
import { InfoCircleOutlined } from '@ant-design/icons';

export const PromptLegend: React.FC = () => (
  <div style={{ display: 'flex', gap: 16, fontSize: 11, marginTop: 8, color: '#666', alignItems: 'center', flexWrap: 'wrap' }}>
    <Tooltip title="系统固定的提示文本，不会变化">
      <span style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'help' }}>
        <span style={{ background: '#e6f7ff', border: '1px solid #91d5ff', width: 14, height: 14, borderRadius: 2, display: 'inline-block' }} />
        系统文本
      </span>
    </Tooltip>
    <Tooltip title="来自提示词模板的内容">
      <span style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'help' }}>
        <span style={{ background: '#fff7e6', border: '1px solid #ffd591', width: 14, height: 14, borderRadius: 2, display: 'inline-block' }} />
        模板内容
      </span>
    </Tooltip>
    <Tooltip title="动态填充的变量值（如 NPC 名称、线索内容等），鼠标悬停可查看变量名和说明">
      <span style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'help' }}>
        <span style={{ background: '#f6ffed', border: '1px solid #b7eb8f', width: 14, height: 14, borderRadius: 2, display: 'inline-block' }} />
        动态变量
        <InfoCircleOutlined style={{ fontSize: 10 }} />
      </span>
    </Tooltip>
  </div>
);
