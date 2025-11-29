

# 评价系统
对于大模型的回复，可以从多个维度进行打分


# 对话模拟页面


存储历史对话。历史对话发送给大模型。
NPC 对话模板应该分成三种提示词，system prompt, user prompt, AI prompt




# 线索树
- 允许用户删除线索间的依赖



# 匹配策略
embedding 的匹配策略，参考VectorClueRetrievalStrategy的实现




# 数据结构处理
id除了 uuid 之外考虑一些更加方便人类阅读的id




根据当前代码分析，我有以下 UI 优化建议：

  🎯 UI 优化建议



  ---
  3. 聊天区域增强

  | 当前问题               | 优化建议                            |
  |--------------------|---------------------------------|
  | NPC回复没有明显区分使用了哪个模板 | 在 NPC 消息旁添加标签：🎯 命中线索 或 💬 日常对话 |
  | 对话列表没有时间戳          | 添加相对时间显示                        |
  | 系统消息太突兀            | 改为更轻量的内联提示                      |

  6. Floating Action Panel

  将发送区域改为浮动在底部的固定面板，避免滚动：

  // 固定在底部
  <div style={{
    position: 'sticky',
    bottom: 0,
    background: '#fff',
    padding: 16,
    borderTop: '1px solid #f0f0f0'
  }}>
    <TextArea ... />
    <Button type="primary">发送</Button>
  </div>

  ---
  7. 视觉层级优化

  | 区域     | 建议                          |
  |--------|-----------------------------|
  | 匹配结果表格 | 触发的线索用绿色背景高亮，未触发用灰色         |
  | NPC回复  | 区分命中/未命中用不同颜色气泡（紫色 vs 橙色）   |
  | 配置区域   | 使用 Card 内的 Collapse 折叠不常用选项 |


  ---
  🚀 推荐优先级

  | 优先级 | 优化项             | 工作量 |
  |-----|-----------------|-----|
  | P0  | NPC回复标识（命中/未命中） | 小   |
  | P1  | 配置状态指示器         | 小   |
  | P1  | 响应式布局           | 中   |
  | P2  | Tabs 分组配置       | 中   |
  | P2  | 发送区域固定          | 小   |
  | P3  | 实时匹配预览          | 大   |
  | P3  | 预设配置功能          | 大   |



模拟对话页面，我希望能够看到比如相似度阈值的其他参数



允许导出剧本下的所有相关数据

---
  优化建议

  一、代码结构 (高优先级)

  问题： 文件过大（1900+ 行），难以维护

  建议： 拆分为子组件
  DialogueSimulation/
  ├── index.tsx                    # 主组件，状态管理
  ├── components/
  │   ├── ConfigPanel.tsx          # 左侧配置面板
  │   ├── MatchResultsPanel.tsx    # 中间匹配结果
  │   ├── ChatPanel.tsx            # 右侧聊天窗口
  │   ├── PresetDropdown.tsx       # 预设下拉菜单
  │   └── ConfigDetails.tsx        # 配置详情展示
  └── hooks/
      └── useSimulation.ts         # 模拟相关逻辑

  ---
  二、功能增强

  | 建议     | 描述                        | 难度  |
  |--------|---------------------------|-----|
  | 线索自动解锁 | 触发的线索自动加入"已解锁"列表          | 低   |
  | 聊天记录导出 | 导出为 JSON/Markdown，便于分享和存档 | 低   |
  | 快捷键    | Ctrl+Enter 发送消息           | 低   |
  | 批量测试   | 输入多条消息，一次性测试              | 中   |
  | 策略对比   | 同时用多种策略匹配，对比结果            | 中   |
  | 会话持久化  | 聊天记录保存到 localStorage/数据库  | 中   |

  ---
  三、UX 优化

  1. 发送按钮状态 - 发送中显示加载动画，禁用重复点击
  2. 空状态引导 - 未选择剧本/NPC 时，显示引导步骤
  3. 配置验证提示 - 配置不完整时，高亮缺失项
  4. 聊天滚动 - 新消息自动滚动到底部

  ---


鼠标悬浮在 edge 上的时候，给 edge 的边缘添加一个蓝色的高光



当前布局分析

  当前算法：
  1. BFS 计算层级（根据依赖关系）
  2. 同层节点等间距水平排列
  3. 固定间距：水平 250px，垂直 150px

  存在的问题：
  - 节点多时容易横向过宽
  - 没有考虑边的交叉最小化
  - 不支持手动调整位置
  - 无法按 NPC 分组

  ---
  优化方案

  | 方案          | 复杂度 | 效果    | 描述                   |
  |-------------|-----|-------|----------------------|
  | 1. Dagre 布局 | 低   | ⭐⭐⭐⭐  | 使用专业 DAG 布局库，自动优化边交叉 |
  | 2. ELK 布局   | 中   | ⭐⭐⭐⭐⭐ | 更强大的布局引擎，支持多种算法      |
  | 3. 按 NPC 分组 | 中   | ⭐⭐⭐   | 同一 NPC 的线索用颜色/区域分组   |
  | 4. 自适应间距    | 低   | ⭐⭐⭐   | 根据节点数量动态调整间距         |
  | 5. 可折叠子树    | 高   | ⭐⭐⭐⭐  | 折叠复杂子树减少视觉复杂度        |
  | 6. 保存位置     | 中   | ⭐⭐⭐   | 允许手动拖拽并持久化位置         |

  ---
  推荐路径

  快速优化（1-2小时）：
  - 方案 1：集成 @dagrejs/dagre 库

  中期优化：
  - 方案 3 + 4：NPC 分组 + 自适应间距

  长期优化：
  - 方案 2 + 5 + 6：完整的专业图布局




 基于 Supabase 的特性，以下是可以简化的部分：

  高优先级 (立即可用)

  1. PostgREST 替代标准 CRUD

  当前每个实体都有手写的分页/过滤代码，可用 Supabase Client 直接查询：
  // 之前: 手写 FastAPI 端点 + 前端 API 调用
  // 之后: 直接用 Supabase
  const { data, count } = await supabase
    .from('scripts')
    .select('*', { count: 'exact' })
    .is('deleted_at', null)
    .ilike('title', `%${search}%`)
    .range(0, 19)
  可删除: scripts/npcs/clues/templates/llm_configs 的基础 CRUD 端点 (~500 行)

  2. RLS 策略替代软删除过滤

  当前每个查询都要加 .where(deleted_at.is_(None))：
  -- 数据库层面统一过滤
  CREATE POLICY "hide_deleted" ON scripts
    FOR SELECT USING (deleted_at IS NULL);
  可删除: 所有端点中重复的软删除过滤逻辑

  3. Realtime 替代轮询

  DialogueLogs 页面可用实时订阅：
  supabase
    .channel('logs')
    .on('postgres_changes',
      { event: 'INSERT', table: 'dialogue_logs' },
      (payload) => setLogs(prev => [payload.new, ...prev])
    )
    .subscribe()

  中优先级

  | 功能   | 当前实现                 | Supabase 替代                  |
  |------|----------------------|------------------------------|
  | 审计日志 | 手写 DebugAuditLog API | PostgreSQL Trigger + pgAudit |
  | 会话跟踪 | UUID + localStorage  | Supabase Presence            |
  | 文件存储 | JSON 导入导出            | Supabase Storage             |

  保留 FastAPI 的部分

  以下复杂业务逻辑建议保留在 FastAPI：
  - /simulate/dialogue - 向量匹配 + LLM 调用
  - /templates/render - 模板渲染引擎
  - /scripts/{id}/copy - 复杂的深拷贝逻辑

  建议的简化路径

  1. Phase 1: 前端直接用 @supabase/supabase-js 查询简单实体 (llm_configs, templates)
  2. Phase 2: 添加 RLS 策略，移除后端软删除过滤
  3. Phase 3: 添加 Realtime 订阅到 dialogue_logs





# Future



# 命令行工具
快速加载数据


# 模拟对话页面

## 实时匹配预览（打字时）

只适用于后期线索全部加载的测试环境。现在每次都要清理 vector 数据库，重新插入，不太合适

  当用户输入时，实时显示可能匹配的线索预览（debounced）：

  ┌──────────────────────────────────────┐
  │ 输入: "我想知道案发当晚..."           │
  ├──────────────────────────────────────┤
  │ 📍 可能触发:                          │
  │   • 案发时间线 (相似度 0.82)          │
  │   • 不在场证明 (相似度 0.65)          │
  └──────────────────────────────────────┘

  


