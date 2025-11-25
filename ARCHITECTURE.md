# LARP Admin 系统架构文档

> AI 驱动的剧本杀游戏管理后台

## 目录

- [项目概述](#项目概述)
- [技术栈](#技术栈)
- [系统架构](#系统架构)
- [后端结构](#后端结构)
- [前端结构](#前端结构)
- [核心功能](#核心功能)
- [数据模型](#数据模型)
- [API 接口](#api-接口)
- [线索匹配系统](#线索匹配系统)
- [NPC 对话系统](#npc-对话系统)
- [TODO 功能](#todo-功能)

---

## 项目概述

LARP Admin 是一个用于管理 AI 驱动剧本杀游戏的后台系统。系统支持：
- 剧本、NPC、线索的 CRUD 管理
- 多种线索匹配策略（关键词、向量嵌入、LLM）
- NPC 智能对话生成
- 提示词模板管理
- 对话日志记录与分析

---

## 技术栈

### 后端
| 技术 | 用途 |
|------|------|
| FastAPI | Web 框架 |
| SQLAlchemy | ORM |
| PostgreSQL | 数据库 |
| Alembic | 数据库迁移 |
| Pydantic | 数据验证 |
| LangChain | LLM 集成 |
| Chroma | 向量数据库 |

### 前端
| 技术 | 用途 |
|------|------|
| React 18 | UI 框架 |
| TypeScript | 类型安全 |
| Vite | 构建工具 |
| Ant Design | UI 组件库 |
| React Router | 路由 |
| i18next | 国际化 |
| React Flow | 线索树可视化 |

---

## 系统架构

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend                              │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐           │
│  │ Scripts │ │  NPCs   │ │  Clues  │ │ Debug   │           │
│  └────┬────┘ └────┬────┘ └────┬────┘ └────┬────┘           │
│       └───────────┴───────────┴───────────┘                 │
│                        │ API Calls                          │
└────────────────────────┼────────────────────────────────────┘
                         │
┌────────────────────────┼────────────────────────────────────┐
│                   Backend (FastAPI)                          │
│  ┌─────────────────────┴─────────────────────┐              │
│  │              API Router                    │              │
│  │  /scripts  /npcs  /clues  /simulate       │              │
│  │  /logs  /templates  /llm-configs          │              │
│  └─────────────────────┬─────────────────────┘              │
│                        │                                     │
│  ┌─────────────────────┴─────────────────────┐              │
│  │              Services                      │              │
│  │  MatchingService  TemplateRenderer         │              │
│  │  VectorClueRetriever  ClueTreeService      │              │
│  └─────────────────────┬─────────────────────┘              │
│                        │                                     │
│  ┌─────────────────────┴─────────────────────┐              │
│  │              Models (SQLAlchemy)           │              │
│  │  Script  NPC  Clue  DialogueLog            │              │
│  │  PromptTemplate  LLMConfig                 │              │
│  └─────────────────────┬─────────────────────┘              │
└────────────────────────┼────────────────────────────────────┘
                         │
┌────────────────────────┼────────────────────────────────────┐
│                   PostgreSQL                                 │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌──────────────┐      │
│  │ scripts │ │  npcs   │ │  clues  │ │dialogue_logs │      │
│  └─────────┘ └─────────┘ └─────────┘ └──────────────┘      │
│  ┌──────────────────┐ ┌─────────────┐                       │
│  │ prompt_templates │ │ llm_configs │                       │
│  └──────────────────┘ └─────────────┘                       │
└─────────────────────────────────────────────────────────────┘
```

---

## 后端结构

```
backend/
├── alembic/                    # 数据库迁移
│   └── versions/               # 迁移版本文件
├── app/
│   ├── api/                    # API 路由
│   │   ├── __init__.py         # 路由注册
│   │   ├── scripts.py          # 剧本 API
│   │   ├── npcs.py             # NPC API
│   │   ├── clues.py            # 线索 API
│   │   ├── simulate.py         # 对话模拟 API
│   │   ├── logs.py             # 对话日志 API
│   │   ├── templates.py        # 提示词模板 API
│   │   └── llm_configs.py      # LLM 配置 API
│   ├── models/                 # 数据模型
│   │   ├── script.py           # 剧本模型
│   │   ├── npc.py              # NPC 模型
│   │   ├── clue.py             # 线索模型
│   │   ├── log.py              # 对话日志模型
│   │   ├── prompt_template.py  # 提示词模板模型
│   │   └── llm_config.py       # LLM 配置模型
│   ├── schemas/                # Pydantic schemas
│   │   ├── script.py
│   │   ├── npc.py
│   │   ├── clue.py
│   │   ├── simulate.py         # 模拟请求/响应
│   │   └── ...
│   ├── services/               # 业务逻辑
│   │   ├── matching.py         # 线索匹配服务
│   │   ├── vector_matching.py  # 向量匹配服务
│   │   ├── template_renderer.py# 模板渲染服务
│   │   └── clue_tree.py        # 线索树服务
│   ├── config.py               # 配置
│   ├── database.py             # 数据库连接
│   └── main.py                 # 应用入口
├── tests/                      # 测试
└── seed_data.py                # 种子数据脚本
```

---

## 前端结构

```
frontend/src/
├── api/                        # API 客户端
│   ├── client.ts               # Axios 实例
│   ├── scripts.ts              # 剧本 API
│   ├── npcs.ts                 # NPC API
│   ├── clues.ts                # 线索 API
│   ├── simulation.ts           # 模拟 API
│   ├── templates.ts            # 模板 API
│   └── llmConfigs.ts           # LLM 配置 API
├── components/
│   ├── common/                 # 通用组件
│   │   ├── PageHeader.tsx
│   │   ├── ClueTypeTag.tsx
│   │   └── ResizableTable.tsx
│   ├── layout/                 # 布局组件
│   │   └── MainLayout.tsx
│   └── templates/              # 模板相关组件
│       ├── TemplateEditor.tsx
│       ├── TemplatePreview.tsx
│       └── VariablePanel.tsx
├── hooks/                      # 自定义 Hooks
│   ├── useScripts.ts
│   ├── useNpcs.ts
│   ├── useClues.ts
│   └── useTemplates.ts
├── pages/
│   ├── scripts/                # 剧本管理
│   │   ├── ScriptList.tsx
│   │   └── ScriptDetail.tsx
│   ├── npcs/                   # NPC 管理
│   │   ├── NpcList.tsx
│   │   └── NpcDetail.tsx
│   ├── clues/                  # 线索管理
│   │   ├── ClueList.tsx
│   │   ├── ClueDetail.tsx
│   │   └── ClueTree.tsx        # 线索树可视化
│   ├── debug/                  # 调试工具
│   │   └── DialogueSimulation.tsx
│   ├── experiments/
│   │   └── DialogueLogs.tsx    # 对话日志
│   ├── templates/              # 提示词模板
│   │   ├── TemplateList.tsx
│   │   └── TemplateDetail.tsx
│   ├── llm-configs/            # LLM 配置
│   │   └── LLMConfigList.tsx
│   └── settings/
│       └── GlobalSettings.tsx
├── locales/                    # 国际化
│   ├── en.json
│   └── zh.json
├── router/                     # 路由配置
├── types/                      # TypeScript 类型
└── App.tsx
```

---

## 核心功能

### 1. 剧本管理 (Scripts)
- 创建、编辑、删除剧本
- 剧本基本信息：标题、摘要、背景、难度
- 真相信息：凶手、凶器、动机、作案手法

### 2. NPC 管理 (NPCs)
- 创建、编辑、删除 NPC
- NPC 属性：姓名、年龄、背景、性格
- 知识范围配置：知道的事、不知道的事、世界观限制

### 3. 线索管理 (Clues)
- 创建、编辑、删除线索
- 线索类型：文本、图片
- 触发条件：关键词、语义摘要
- 前置线索依赖
- NPC 透露指引 (detail_for_npc)

### 4. 线索树可视化 (Clue Tree)
- React Flow 实现的可视化依赖图
- 拖拽添加/删除依赖关系
- 循环依赖检测
- 质量问题检测（死线索、孤立线索）

### 5. 对话模拟 (Dialogue Simulation)
- 选择剧本、NPC、已解锁线索
- 三种匹配策略选择
- NPC 回复开关
- 匹配结果展示
- 聊天界面

### 6. 提示词模板 (Prompt Templates)
- 模板类型：线索嵌入、NPC 系统提示、线索揭示、自定义
- 变量支持：`{npc.name}`, `{clue.detail}` 等
- 模板渲染预览
- 默认模板设置

### 7. LLM 配置 (LLM Configs)
- 嵌入模型配置（用于向量匹配）
- 对话模型配置（用于 NPC 对话）
- 支持自定义 base_url、api_key、model

---

## 数据模型

### Script (剧本)
```python
class Script:
    id: UUID
    title: str
    summary: str | None
    background: str | None
    difficulty: Difficulty  # easy, medium, hard
    truth: dict  # {murderer, weapon, motive, crime_method}
    created_at: datetime
    updated_at: datetime
    deleted_at: datetime | None  # 软删除
```

### NPC
```python
class NPC:
    id: UUID
    script_id: UUID  # 所属剧本
    name: str
    age: int | None
    background: str | None
    personality: str | None
    knowledge_scope: dict  # {knows, does_not_know, world_model_limits}
    created_at: datetime
    updated_at: datetime
```

### Clue (线索)
```python
class Clue:
    id: UUID
    script_id: UUID
    npc_id: UUID  # 持有此线索的 NPC
    name: str
    type: ClueType  # text, image
    detail: str  # 线索内容
    detail_for_npc: str  # NPC 透露指引
    trigger_keywords: list[str]  # 触发关键词
    trigger_semantic_summary: str  # 语义摘要
    prereq_clue_ids: list[UUID]  # 前置线索
    created_at: datetime
    updated_at: datetime
```

### DialogueLog (对话日志)
```python
class DialogueLog:
    id: UUID
    session_id: str  # 会话 ID
    script_id: UUID
    npc_id: UUID
    player_message: str
    npc_response: str | None
    context: dict  # 匹配策略、模板 ID 等
    matched_clues: list[dict]
    triggered_clues: list[str]
    created_at: datetime
```

### PromptTemplate (提示词模板)
```python
class PromptTemplate:
    id: UUID
    name: str
    description: str | None
    type: TemplateType  # clue_embedding, npc_system_prompt, clue_reveal, custom
    content: str  # 模板内容，支持 {var.path} 占位符
    is_default: bool
    variables: list[str]  # 自动提取的变量
    created_at: datetime
    updated_at: datetime
    deleted_at: datetime | None
```

### LLMConfig (LLM 配置)
```python
class LLMConfig:
    id: UUID
    name: str
    type: LLMConfigType  # embedding, chat
    model: str
    base_url: str
    api_key: str  # 加密存储
    is_default: bool
    # Embedding 特有
    similarity_threshold: float | None
    dimensions: int | None
    # Chat 特有
    temperature: float | None
    max_tokens: int | None
    top_p: float | None
    created_at: datetime
    updated_at: datetime
```

---

## API 接口

### 剧本 API
| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/api/scripts` | 获取剧本列表 |
| POST | `/api/scripts` | 创建剧本 |
| GET | `/api/scripts/{id}` | 获取剧本详情 |
| PUT | `/api/scripts/{id}` | 更新剧本 |
| DELETE | `/api/scripts/{id}` | 删除剧本 |

### NPC API
| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/api/npcs` | 获取 NPC 列表 |
| POST | `/api/npcs` | 创建 NPC |
| GET | `/api/npcs/{id}` | 获取 NPC 详情 |
| PUT | `/api/npcs/{id}` | 更新 NPC |
| DELETE | `/api/npcs/{id}` | 删除 NPC |

### 线索 API
| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/api/clues` | 获取线索列表 |
| POST | `/api/clues` | 创建线索 |
| GET | `/api/clues/{id}` | 获取线索详情 |
| PUT | `/api/clues/{id}` | 更新线索 |
| DELETE | `/api/clues/{id}` | 删除线索 |
| GET | `/api/clues/tree` | 获取线索树结构 |
| PUT | `/api/clues/tree` | 批量更新线索依赖 |

### 模拟 API
| 方法 | 路径 | 描述 |
|------|------|------|
| POST | `/api/simulate` | 运行对话模拟 |

### 日志 API
| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/api/logs` | 获取对话日志列表 |
| GET | `/api/logs/{id}` | 获取日志详情 |
| GET | `/api/logs/session/{session_id}` | 获取会话日志 |

### 模板 API
| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/api/templates` | 获取模板列表 |
| POST | `/api/templates` | 创建模板 |
| GET | `/api/templates/{id}` | 获取模板详情 |
| PUT | `/api/templates/{id}` | 更新模板 |
| DELETE | `/api/templates/{id}` | 删除模板 |
| POST | `/api/templates/render` | 渲染模板 |
| GET | `/api/templates/variables` | 获取可用变量 |
| POST | `/api/templates/{id}/set-default` | 设为默认 |

### LLM 配置 API
| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/api/llm-configs` | 获取配置列表 |
| POST | `/api/llm-configs` | 创建配置 |
| GET | `/api/llm-configs/{id}` | 获取配置详情 |
| PUT | `/api/llm-configs/{id}` | 更新配置 |
| DELETE | `/api/llm-configs/{id}` | 删除配置 |
| POST | `/api/llm-configs/{id}/set-default` | 设为默认 |

---

## 线索匹配系统

### 匹配策略

#### 1. 关键词匹配 (Keyword)
- 最简单的匹配方式
- 检查玩家消息是否包含线索的 `trigger_keywords`
- 分数 = 匹配关键词数 / 总关键词数

```python
def _check_keywords(trigger_keywords, message):
    matches = [kw for kw in trigger_keywords if kw.lower() in message.lower()]
    score = len(matches) / len(trigger_keywords)
    return score, matches
```

#### 2. 向量嵌入匹配 (Embedding)
- 使用 LangChain + Chroma 实现
- 使用管理员配置的嵌入模型
- 使用模板渲染线索内容后再嵌入
- 基于余弦相似度匹配

```python
# 流程
1. 加载 embedding 配置和模板
2. 过滤满足前置条件的线索
3. 使用模板渲染每个线索内容
4. 构建 Chroma 向量数据库
5. 对玩家消息进行相似度搜索
6. 返回相似度分数
7. 清理 Chroma collection
```

#### 3. LLM 匹配 (LLM)
- 将所有候选线索提供给 LLM
- LLM 判断哪些线索与玩家消息相关
- 返回 JSON 格式的匹配结果

```python
# LLM 返回格式
{"matches": [{"id": "clue-id", "score": 0.8, "reason": "why matched"}]}
```

### 前置线索检查
- 每个线索可配置 `prereq_clue_ids`
- 只有当所有前置线索已解锁时，该线索才参与匹配
- 实现环检测，防止循环依赖

### 匹配流程
```
玩家消息 → 获取候选线索 → 过滤前置条件 → 应用匹配策略 → 计算分数 → 排序 → 触发判定(>0.5)
```

---

## NPC 对话系统

### 对话生成流程

基于 `data/sample/clue.py` 中的 `npc_reply_with_clue` 模式实现：

```
┌─────────────────────────────────────────────────────────────┐
│                    对话生成流程                              │
├─────────────────────────────────────────────────────────────┤
│  1. 加载配置                                                 │
│     - Chat LLM 配置 (npc_chat_config_id)                    │
│     - System Prompt 模板 (npc_system_template_id)           │
│     - NPC 数据、Script 数据                                  │
├─────────────────────────────────────────────────────────────┤
│  2. 构建 System Prompt                                       │
│     - 使用模板渲染，支持变量：                                │
│       {npc.name}, {npc.personality}, {npc.background}       │
│       {script.title}, {script.background}                   │
│     - 或使用默认提示词                                       │
├─────────────────────────────────────────────────────────────┤
│  3. 加载对话历史                                             │
│     - 从 DialogueLog 获取最近 4 轮对话                       │
│     - 按 session_id 分组                                    │
├─────────────────────────────────────────────────────────────┤
│  4. 构建指引消息                                             │
│     有触发线索时：                                           │
│     "【指引】请自然地透露以下信息..."                         │
│     + 线索的 detail_for_npc 内容                            │
│                                                             │
│     无触发线索时：                                           │
│     "【指引】不需要提供新情报，自然回应对方"                    │
├─────────────────────────────────────────────────────────────┤
│  5. 组装消息数组                                             │
│     [system_prompt]                                         │
│     [history_user_1]                                        │
│     [history_assistant_1]                                   │
│     ...                                                     │
│     [指引 + 玩家消息]                                        │
├─────────────────────────────────────────────────────────────┤
│  6. 调用 LLM                                                │
│     - 使用管理员配置的 Chat 模型                             │
│     - temperature: 0.7                                      │
├─────────────────────────────────────────────────────────────┤
│  7. 返回 NPC 回复                                           │
└─────────────────────────────────────────────────────────────┘
```

### System Prompt 模板示例

```
你是{npc.name}，{npc.age}岁。

背景故事：
{npc.background}

性格特点：
{npc.personality}

你知道以下事情：
{npc.knowledge_scope.knows}

你不知道以下事情：
{npc.knowledge_scope.does_not_know}

请始终保持角色，用第一人称回答玩家的问题。
```

---

## TODO 功能

### 高优先级

- [ ] **用户认证系统**
  - 登录/注册
  - 角色权限（管理员、编辑者、查看者）
  - API Token 管理

- [ ] **场景管理 (Scenes)**
  - 剧本可以包含多个场景
  - 场景切换逻辑
  - 场景特有的 NPC 和线索

- [ ] **游戏运行时 API**
  - 面向游戏客户端的 API
  - 实时会话管理
  - 进度保存/恢复

### 中优先级

- [ ] **线索图片上传**
  - 支持图片类型线索的实际图片
  - 图片存储（本地/OSS）
  - 图片预览

- [ ] **批量导入/导出**
  - YAML/JSON 格式导入剧本数据
  - 导出完整剧本包

- [ ] **模板变量扩展**
  - 支持更多变量类型
  - 条件渲染
  - 循环渲染

- [ ] **匹配策略组合**
  - 支持多策略组合
  - 权重配置
  - 阈值调优

### 低优先级

- [ ] **数据分析仪表盘**
  - 对话统计
  - 线索解锁率分析
  - 玩家行为分析

- [ ] **A/B 测试**
  - 不同提示词模板的效果对比
  - 不同匹配策略的效果对比

- [ ] **多语言线索**
  - 同一线索的多语言版本
  - 根据玩家语言自动切换

- [ ] **实时协作**
  - 多人同时编辑
  - 变更历史记录
  - 版本管理

### 技术债务

- [ ] 完善单元测试覆盖率
- [ ] 添加集成测试
- [ ] API 文档完善（Swagger/OpenAPI）
- [ ] 错误处理和日志优化
- [ ] 性能优化（缓存、索引）
- [ ] Docker 部署配置
- [ ] CI/CD 流水线

---

## 开发指南

### 本地开发

```bash
# 后端
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
alembic upgrade head
python seed_data.py  # 可选：导入测试数据
uvicorn app.main:app --reload

# 前端
cd frontend
npm install
npm run dev
```

### 环境变量

```bash
# backend/.env
DATABASE_URL=postgresql+asyncpg://user:pass@localhost:5432/larp_admin
DEBUG=true
CORS_ORIGINS=["http://localhost:5173"]
```

### 数据库迁移

```bash
# 创建迁移
alembic revision --autogenerate -m "description"

# 应用迁移
alembic upgrade head

# 回滚
alembic downgrade -1
```

---

*文档最后更新：2024-11*
