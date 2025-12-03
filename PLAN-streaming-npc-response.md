# 对话模拟页面 NPC 回复流式化实现计划

## 目标
在对话模拟页面中，NPC 回复能够逐字/逐 token 流式显示，提升用户体验。

## 实现策略
**新建流式端点** `POST /simulate/stream`，保持现有 `POST /simulate` 不变，确保向后兼容。

## SSE 事件格式设计
```
event: match_result
data: {"matched_clues": [...], "triggered_clues": [...], "debug_info": {...}}

event: npc_chunk
data: {"chunk": "文本片段"}

event: complete
data: {"npc_response": "完整回复", "llm_usage": {...}, "log_id": "..."}

event: error
data: {"error": "错误信息", "code": "ERROR_CODE"}
```

---

## 实现步骤

### 后端改动 (4 个文件)

#### 1. `backend/app/services/common/llm_client.py`
添加 `call_stream_with_messages` 方法，支持完整消息数组的流式调用：
```python
@classmethod
async def call_stream_with_messages(
    cls,
    config: LLMConfig,
    messages: list[dict],
    temperature: float = 0.7,
    max_tokens: int | None = None,
) -> AsyncGenerator[str, None]:
    # 复用 get_stream_client()，添加 messages 支持
```

#### 2. `backend/app/services/matching/npc_response.py`
在 `NpcResponseGenerator` 类中添加 `generate_stream` 方法：
```python
async def generate_stream(
    self,
    context: MatchContext,
    triggered_clues: list[MatchResult],
    player_message: str,
) -> AsyncGenerator[tuple[str, NpcResponseResult | None], None]:
    # 复用 generate() 的设置逻辑
    # 使用 call_stream_with_messages 流式调用
    # yield (chunk, None) 直到完成
    # yield ("", final_result) 返回最终结果
```

#### 3. `backend/app/services/matching/service.py`
在 `MatchingService` 类中添加 `simulate_stream` 方法：
```python
async def simulate_stream(self, request: SimulateRequest) -> AsyncGenerator[dict, None]:
    # 1. 执行线索匹配（非流式，通常很快）
    # 2. yield match_result 事件
    # 3. 如果启用 NPC 回复，流式生成
    #    - yield npc_chunk 事件（逐 token）
    # 4. yield complete 事件
```

#### 4. `backend/app/api/simulate.py`
添加新端点：
```python
@router.post("/stream")
async def simulate_dialogue_stream(
    db: DBSession,
    request: SimulateRequest,
) -> StreamingResponse:
    # 调用 service.simulate_stream()
    # 包装为 SSE 格式
    # 保存 dialogue log
    # 处理错误
```

---

### 前端改动 (4 个文件)

#### 1. `frontend/src/api/simulation.ts`
添加 `runStream` 方法：
```typescript
runStream: async (
  request: SimulationRequest,
  handlers: {
    onMatchResult?: (data) => void;
    onNpcChunk?: (chunk: string) => void;
    onComplete?: (data) => void;
    onError?: (error) => void;
  },
  signal?: AbortSignal,
) => Promise<void>
```
- 使用 fetch + ReadableStream 解析 SSE
- 支持 AbortController 取消请求

#### 2. `frontend/src/pages/debug/DialogueSimulation/hooks/useDialogueSimulation.ts`
修改内容：
- 添加状态：`streamingNpcResponse: string`
- 添加 `abortControllerRef` 用于取消请求
- 添加 `handleAbort` 方法
- 修改 `handleSend`：调用 `simulationApi.runStream`，处理各类事件
- 返回新增：`streamingNpcResponse`, `handleAbort`

#### 3. `frontend/src/pages/debug/DialogueSimulation/components/ChatPanel.tsx`
修改内容：
- 新增 props：`streamingNpcResponse`, `onAbort`
- 添加停止按钮（loading 时显示）
- 添加流式消息显示区域（带闪烁光标）

#### 4. `frontend/src/pages/debug/DialogueSimulation/index.tsx`
传递新 props 给 ChatPanel：
- `streamingNpcResponse={simulation.streamingNpcResponse}`
- `onAbort={simulation.handleAbort}`

---

## 边界情况处理

| 场景 | 处理方式 |
|-----|---------|
| 用户取消 | AbortController 取消 fetch，清理流式状态 |
| LLM 超时 | 后端捕获 TimeoutException，返回 error 事件 |
| 网络断开 | 前端 catch error，显示错误提示 |
| NPC 回复未启用 | 跳过流式，直接返回 complete |
| 空响应 | 不显示 NPC 消息 |

---

## 实现顺序

1. 后端：LLMClient.call_stream_with_messages
2. 后端：NpcResponseGenerator.generate_stream
3. 后端：MatchingService.simulate_stream
4. 后端：/simulate/stream 端点
5. 前端：simulationApi.runStream
6. 前端：useDialogueSimulation hook 改造
7. 前端：ChatPanel 流式 UI
8. 前端：index.tsx 传递 props
9. 端到端测试
