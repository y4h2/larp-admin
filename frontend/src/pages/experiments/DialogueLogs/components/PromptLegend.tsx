export const PromptLegend: React.FC = () => (
  <div style={{ display: 'flex', gap: 16, fontSize: 11, marginTop: 8, color: '#666' }}>
    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <span style={{ background: '#e6f7ff', border: '1px solid #91d5ff', width: 14, height: 14, borderRadius: 2, display: 'inline-block' }} />
      系统
    </span>
    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <span style={{ background: '#fff7e6', border: '1px solid #ffd591', width: 14, height: 14, borderRadius: 2, display: 'inline-block' }} />
      模板
    </span>
    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <span style={{ background: '#f6ffed', border: '1px solid #b7eb8f', width: 14, height: 14, borderRadius: 2, display: 'inline-block' }} />
      变量
    </span>
  </div>
);
