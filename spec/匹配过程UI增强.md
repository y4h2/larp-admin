# 匹配过程 UI 增强

## 需求概要
1. **重命名**: "检索过程" → "匹配过程" ✅
2. **候选线索根据策略显示**: ✅
   - `keyword` 策略: 显示触发关键词
   - `embedding` 策略: 显示渲染结果 (支持分色显示)
   - `llm` 策略: 显示完整的 LLM 匹配提示词 (支持分色显示)
3. **提示词分色显示**: ✅
   - 不同背景色区分: 系统添加 / 模板提供 / 变量替换

## 实施状态: ✅ 已完成

---

## 已实现功能

### 1. 后端支持

#### 1.1 模板渲染器返回分段信息

**文件**: `backend/app/services/template_renderer.py`

`render()` 方法现在返回 `TemplateRenderResponse`，包含：
- `rendered_content`: 渲染后的完整内容
- `segments`: 分段信息列表，用于颜色区分显示

#### 1.2 数据模型

**文件**: `backend/app/schemas/prompt_template.py`

```python
class PromptSegment(BaseModel):
    """Segment of rendered template for color-coded display."""
    type: Literal["template", "variable"]  # 来源类型
    content: str                            # 内容
    variable_name: str | None = None        # 如果是变量，变量名

class TemplateRenderResponse(BaseModel):
    rendered_content: str
    warnings: list[str]
    unresolved_variables: list[str]
    segments: list[PromptSegment]  # 分段信息
```

#### 1.3 匹配服务返回分段信息

**文件**: `backend/app/services/matching/models.py`

```python
@dataclass
class EmbeddingRenderedContent:
    clue_contents: dict[str, str]                    # clue_id -> rendered content
    clue_segments: dict[str, list[PromptSegment]] | None = None  # clue_id -> segments
```

**文件**: `backend/app/services/matching/service.py`

`_build_candidate_details()` 方法返回：
- `embedding_rendered_content`: 渲染后的内容
- `embedding_rendered_segments`: 分段信息 (用于颜色区分)

---

### 2. 前端实现

#### 2.1 类型定义

**文件**: `frontend/src/types/index.ts`

```typescript
export interface PromptSegment {
  type: 'system' | 'template' | 'variable';
  content: string;
  variable_name?: string;
}

export interface CandidateClueDetail {
  clue_id: string;
  name: string;
  trigger_keywords: string[];
  trigger_semantic_summary: string;
  // LLM 策略
  llm_system_prompt?: string;
  llm_user_message?: string;
  llm_system_prompt_segments?: PromptSegment[];
  llm_user_message_segments?: PromptSegment[];
  // Embedding 策略
  embedding_rendered_content?: string;
  embedding_rendered_segments?: PromptSegment[];
}
```

#### 2.2 分段渲染组件

**文件**: `frontend/src/pages/experiments/DialogueLogs.tsx`

```tsx
// 分段提示词渲染组件 - 不同颜色区分来源
const SegmentedPromptRenderer: React.FC<{ segments: PromptSegment[] }> = ({ segments }) => {
  const getSegmentStyle = (type: PromptSegment['type']) => {
    switch (type) {
      case 'system':
        return { background: '#e6f7ff', borderBottom: '2px solid #1890ff' };  // 蓝色
      case 'template':
        return { background: '#fff7e6', borderBottom: '2px solid #fa8c16' };  // 橙色
      case 'variable':
        return { background: '#f6ffed', borderBottom: '2px solid #52c41a' };  // 绿色
      default:
        return {};
    }
  };

  return (
    <div style={{ whiteSpace: 'pre-wrap', fontSize: 12, lineHeight: 1.6 }}>
      {segments.map((seg, i) => (
        <span
          key={i}
          style={{
            ...getSegmentStyle(seg.type),
            padding: '1px 2px',
            borderRadius: 2,
          }}
          title={seg.type === 'variable' ? `变量: ${seg.variable_name}` : seg.type}
        >
          {seg.content}
        </span>
      ))}
    </div>
  );
};
```

#### 2.3 颜色图例组件

```tsx
const PromptLegend: React.FC = () => (
  <div style={{ display: 'flex', gap: 16, fontSize: 11, marginTop: 8, color: '#666' }}>
    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <span style={{
        background: '#e6f7ff',
        border: '1px solid #91d5ff',
        width: 14,
        height: 14,
        borderRadius: 2,
        display: 'inline-block'
      }} />
      系统
    </span>
    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <span style={{
        background: '#fff7e6',
        border: '1px solid #ffd591',
        width: 14,
        height: 14,
        borderRadius: 2,
        display: 'inline-block'
      }} />
      模板
    </span>
    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <span style={{
        background: '#f6ffed',
        border: '1px solid #b7eb8f',
        width: 14,
        height: 14,
        borderRadius: 2,
        display: 'inline-block'
      }} />
      变量
    </span>
  </div>
);
```

---

## 颜色说明

| 类型 | 背景色 | 边框色 | 说明 |
|------|--------|--------|------|
| 系统 | `#e6f7ff` | `#91d5ff` | 系统自动添加的内容 |
| 模板 | `#fff7e6` | `#ffd591` | 模板定义的静态内容 |
| 变量 | `#f6ffed` | `#b7eb8f` | 变量替换的动态内容 |

---

## 修改文件清单

### 后端
1. `backend/app/schemas/prompt_template.py` - 添加 `PromptSegment` 和更新 `TemplateRenderResponse`
2. `backend/app/services/template_renderer.py` - `render()` 方法返回 segments
3. `backend/app/services/matching/models.py` - `EmbeddingRenderedContent` 添加 `clue_segments`
4. `backend/app/services/matching/strategies/embedding.py` - `_render_clue_for_embedding()` 返回 segments
5. `backend/app/services/matching/service.py` - `_build_candidate_details()` 包含 segments

### 前端
1. `frontend/src/types/index.ts` - 添加 `embedding_rendered_segments` 字段
2. `frontend/src/pages/experiments/DialogueLogs.tsx` - 更新 embedding 策略显示和图例组件
3. `frontend/src/locales/zh.json` - 翻译 key
4. `frontend/src/locales/en.json` - 翻译 key

---

## UI 效果预览

### keyword 策略
```
┌─────────────────────────────────────┐
│ 血迹喷溅模式                         │
│ [血迹] [血] [地板] [地上] [喷溅]     │
└─────────────────────────────────────┘
```

### embedding 策略 (分色显示)
```
┌───────────────────────────────────────────────┐
│ 血迹喷溅模式                                   │
│ 渲染结果:                                      │
│ ┌──────────────────────────────────────────┐  │
│ │[橙色]线索名称：[绿色]血迹喷溅模式          │  │
│ │[橙色]详情：[绿色]检查地板上的血迹...       │  │
│ └──────────────────────────────────────────┘  │
│ [□ 系统] [□ 模板] [□ 变量]                    │
└───────────────────────────────────────────────┘
```

### llm 策略 (分色显示)
```
┌───────────────────────────────────────────────┐
│ 血迹喷溅模式                                   │
│ System Prompt:                                 │
│ ┌──────────────────────────────────────────┐  │
│ │[蓝色]你是一个线索匹配助手。                │  │
│ │[橙色]请判断玩家消息是否涉及以下线索:       │  │
│ │[绿色]血迹喷溅模式                         │  │
│ └──────────────────────────────────────────┘  │
│ User Message:                                  │
│ ┌──────────────────────────────────────────┐  │
│ │[橙色]玩家消息:                            │  │
│ │[绿色]我看到地上有很多血                    │  │
│ └──────────────────────────────────────────┘  │
│ [□ 系统] [□ 模板] [□ 变量]                    │
└───────────────────────────────────────────────┘
```
