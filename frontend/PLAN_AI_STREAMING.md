# AI Enhancement Streaming Implementation Plan

## Problem
Current AI enhancement API uses REST with synchronous responses, which can timeout for long-running LLM operations (especially clue chain analysis). The axios client has a 30s timeout, while LLM calls can take 60-120+ seconds.

## Solution
Implement Server-Sent Events (SSE) streaming for AI enhancement endpoints to:
1. Avoid timeout issues
2. Show real-time progress to users
3. Provide better UX with streaming text output

## Implementation Steps

### 1. Backend: Add Streaming LLM Call Method
**File:** `backend/app/services/ai_enhancement.py`

Add a new method `_call_llm_stream` that:
- Uses `httpx` with `stream=True` parameter
- Yields chunks as they arrive from LLM API
- Handles SSE format from OpenAI-compatible APIs

```python
async def _call_llm_stream(
    self,
    config: LLMConfig,
    system_prompt: str,
    user_prompt: str,
) -> AsyncGenerator[str, None]:
    """Call LLM and stream text response."""
    async with httpx.AsyncClient(timeout=None) as client:
        async with client.stream(
            "POST",
            f"{config.base_url}/chat/completions",
            headers={"Authorization": f"Bearer {config.api_key}"},
            json={
                "model": config.model,
                "messages": [...],
                "stream": True,
            },
        ) as response:
            async for line in response.aiter_lines():
                if line.startswith("data: "):
                    data = line[6:]
                    if data == "[DONE]":
                        break
                    chunk = json.loads(data)
                    content = chunk["choices"][0]["delta"].get("content", "")
                    if content:
                        yield content
```

### 2. Backend: Add Streaming Service Methods
**File:** `backend/app/services/ai_enhancement.py`

Add streaming versions of AI methods:
- `polish_clue_detail_stream()`
- `generate_semantic_summary_stream()`
- `polish_npc_description_stream()`

These return `AsyncGenerator[str, None]` instead of `str`.

### 3. Backend: Add SSE Endpoints
**File:** `backend/app/api/ai_enhancement.py`

Add streaming endpoints using FastAPI's `StreamingResponse`:

```python
from fastapi.responses import StreamingResponse

@router.post("/polish-clue/stream")
async def polish_clue_stream(
    request: PolishClueRequest,
    db: AsyncSession = Depends(get_db),
) -> StreamingResponse:
    """Stream polish clue response."""
    service = AIEnhancementService(db)

    async def generate():
        async for chunk in service.polish_clue_detail_stream(...):
            yield f"data: {json.dumps({'chunk': chunk})}\n\n"
        yield "data: [DONE]\n\n"

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        },
    )
```

### 4. Frontend: Add Streaming API Client
**File:** `frontend/src/api/aiEnhancement.ts`

Add streaming API methods using `fetch` with `ReadableStream`:

```typescript
polishClueStream: async (
  request: PolishClueRequest,
  onChunk: (chunk: string) => void,
  onComplete: () => void,
  onError: (error: Error) => void,
) => {
  const response = await fetch('/api/ai-enhance/polish-clue/stream', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });

  const reader = response.body?.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const text = decoder.decode(value);
    const lines = text.split('\n');

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = line.slice(6);
        if (data === '[DONE]') {
          onComplete();
          return;
        }
        const { chunk } = JSON.parse(data);
        onChunk(chunk);
      }
    }
  }
}
```

### 5. Frontend: Update UI Components
**File:** `frontend/src/pages/clues/ClueDetail.tsx`

Update handlers to use streaming:

```typescript
const handlePolishDetail = async () => {
  // ...validation...

  setPolishing(true);
  let streamedContent = '';

  await aiEnhancementApi.polishClueStream(
    { clue_name: name, clue_detail: detail },
    (chunk) => {
      streamedContent += chunk;
      form.setFieldValue('detail', streamedContent);
    },
    () => {
      setPolishHistory({ field: 'detail', original: detail, polished: streamedContent });
      message.success(t('clue.aiEnhance.polishSuccess'));
      setPolishing(false);
    },
    (error) => {
      message.error(t('clue.aiEnhance.polishFailed'));
      setPolishing(false);
    }
  );
};
```

### 6. Frontend: Add Abort Controller Support
Allow users to cancel long-running AI operations:

```typescript
const abortControllerRef = useRef<AbortController | null>(null);

const handlePolishDetail = async () => {
  abortControllerRef.current = new AbortController();

  await aiEnhancementApi.polishClueStream(
    request,
    onChunk,
    onComplete,
    onError,
    abortControllerRef.current.signal,
  );
};

const handleCancelAI = () => {
  abortControllerRef.current?.abort();
  setPolishing(false);
};
```

## Files to Modify

### Backend
1. `backend/app/services/ai_enhancement.py`
   - Add `_call_llm_stream()` method
   - Add streaming versions of enhancement methods

2. `backend/app/api/ai_enhancement.py`
   - Add streaming endpoints (`/polish-clue/stream`, etc.)

### Frontend
3. `frontend/src/api/aiEnhancement.ts`
   - Add streaming API methods with callback support

4. `frontend/src/pages/clues/ClueDetail.tsx`
   - Update handlers to use streaming
   - Add cancel button during streaming

5. `frontend/src/pages/clues/ClueTree.tsx`
   - Update clue chain analysis to use streaming (for summary)

6. `frontend/src/locales/en.json` & `zh.json`
   - Add translation keys for cancel button

## Endpoints Summary

| Current Endpoint | Streaming Endpoint |
|-----------------|-------------------|
| POST /polish-clue | POST /polish-clue/stream |
| POST /suggest-keywords | (keep non-stream, short response) |
| POST /generate-semantic-summary | POST /generate-semantic-summary/stream |
| POST /polish-npc | POST /polish-npc/stream |
| POST /analyze-clue-chain | POST /analyze-clue-chain/stream |

## Notes
- Keep non-streaming endpoints for backward compatibility and short operations
- `suggest-keywords` returns JSON array, streaming less beneficial
- Consider adding a progress indicator during streaming
- SSE reconnection not needed (one-shot request)
