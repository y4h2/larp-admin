"""AI Enhancement Service for polishing and improving content."""

import json
from collections.abc import AsyncGenerator

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.llm_config import LLMConfig, LLMConfigType


class AIEnhancementService:
    """AI-powered content enhancement service."""

    def __init__(self, db: AsyncSession) -> None:
        """Initialize with database session."""
        self.db = db

    async def polish_clue_detail(
        self,
        clue_name: str,
        clue_detail: str,
        context: str | None = None,
        llm_config_id: str | None = None,
    ) -> str:
        """
        Polish and improve clue detail text.

        Args:
            clue_name: Name of the clue
            clue_detail: Current clue detail text
            context: Optional context (story background, etc.)
            llm_config_id: Optional LLM config ID

        Returns:
            Polished clue detail text
        """
        config = await self._get_chat_config(llm_config_id)
        if not config:
            raise ValueError("No chat LLM configuration available")

        system_prompt = """你是一位专业的剧本杀编剧助手。你的任务是润色和改进线索描述，使其：
1. 更加生动、有画面感
2. 保持神秘感，不直接透露答案
3. 语言流畅，符合故事背景
4. 保留原有的关键信息

请直接返回润色后的线索描述，不要添加任何解释或前缀。"""

        user_prompt = f"""请润色以下线索描述：

线索名称：{clue_name}
当前描述：{clue_detail}
"""
        if context:
            user_prompt += f"\n故事背景：{context}"

        result = await self._call_llm_text(config, system_prompt, user_prompt)
        return result.strip()

    async def polish_clue_detail_stream(
        self,
        clue_name: str,
        clue_detail: str,
        context: str | None = None,
        llm_config_id: str | None = None,
    ) -> AsyncGenerator[str, None]:
        """Stream polish clue detail text."""
        config = await self._get_chat_config(llm_config_id)
        if not config:
            raise ValueError("No chat LLM configuration available")

        system_prompt = """你是一位专业的剧本杀编剧助手。你的任务是润色和改进线索描述，使其：
1. 更加生动、有画面感
2. 保持神秘感，不直接透露答案
3. 语言流畅，符合故事背景
4. 保留原有的关键信息

请直接返回润色后的线索描述，不要添加任何解释或前缀。"""

        user_prompt = f"""请润色以下线索描述：

线索名称：{clue_name}
当前描述：{clue_detail}
"""
        if context:
            user_prompt += f"\n故事背景：{context}"

        async for chunk in self._call_llm_stream(config, system_prompt, user_prompt):
            yield chunk

    async def suggest_trigger_keywords(
        self,
        clue_name: str,
        clue_detail: str,
        existing_keywords: list[str] | None = None,
        llm_config_id: str | None = None,
    ) -> list[str]:
        """
        Suggest trigger keywords for a clue.

        Args:
            clue_name: Name of the clue
            clue_detail: Clue detail text
            existing_keywords: Already defined keywords
            llm_config_id: Optional LLM config ID

        Returns:
            List of suggested keywords
        """
        config = await self._get_chat_config(llm_config_id)
        if not config:
            raise ValueError("No chat LLM configuration available")

        system_prompt = """你是一位专业的剧本杀编剧助手。你的任务是为线索生成触发关键词。
这些关键词是玩家可能会询问的词汇，用于触发NPC透露这条线索。

请返回JSON格式：{"keywords": ["关键词1", "关键词2", ...]}

要求：
1. 关键词应该自然、符合玩家询问习惯
2. 包含直接相关的关键词和间接相关的关键词
3. 建议5-10个关键词
4. 避免太宽泛的词汇"""

        user_prompt = f"""请为以下线索生成触发关键词：

线索名称：{clue_name}
线索描述：{clue_detail}
"""
        if existing_keywords:
            user_prompt += f"\n已有关键词（可参考但不要重复）：{', '.join(existing_keywords)}"

        result = await self._call_llm_json(config, system_prompt, user_prompt)
        return result.get("keywords", [])

    async def generate_semantic_summary(
        self,
        clue_name: str,
        clue_detail: str,
        llm_config_id: str | None = None,
    ) -> str:
        """
        Generate semantic summary for clue matching via embedding similarity.

        Args:
            clue_name: Name of the clue
            clue_detail: Clue detail text
            llm_config_id: Optional LLM config ID

        Returns:
            Semantic summary text optimized for embedding matching
        """
        config = await self._get_chat_config(llm_config_id)
        if not config:
            raise ValueError("No chat LLM configuration available")

        system_prompt = """你是一位专业的语义向量优化专家。你的任务是为线索生成用于向量嵌入(Embedding)匹配的语义摘要。

这个摘要会被转换为向量，与玩家的提问进行余弦相似度匹配。当相似度足够高时，这条线索会被触发。

请生成一个优化的语义摘要，要求：

1. **核心语义提取**：用简洁的语言概括线索的核心信息和关键事实
2. **问题形式覆盖**：包含玩家可能会问的问题形式，例如：
   - "关于XXX的情况是什么？"
   - "谁做了XXX？"
   - "XXX发生了什么？"
3. **同义词扩展**：包含关键概念的同义词或近义词，提高匹配率
4. **场景描述**：简要描述什么场景/话题下玩家会询问到这条线索

格式要求：
- 直接返回摘要文本，不要有解释或前缀
- 控制在50-150字之间
- 使用自然语言，不要用列表格式"""

        user_prompt = f"""请为以下线索生成向量匹配优化的语义摘要：

线索名称：{clue_name}
线索详情：{clue_detail}"""

        result = await self._call_llm_text(config, system_prompt, user_prompt)
        return result.strip()

    async def generate_semantic_summary_stream(
        self,
        clue_name: str,
        clue_detail: str,
        llm_config_id: str | None = None,
    ) -> AsyncGenerator[str, None]:
        """Stream semantic summary generation for embedding matching."""
        config = await self._get_chat_config(llm_config_id)
        if not config:
            raise ValueError("No chat LLM configuration available")

        system_prompt = """你是一位专业的语义向量优化专家。你的任务是为线索生成用于向量嵌入(Embedding)匹配的语义摘要。

这个摘要会被转换为向量，与玩家的提问进行余弦相似度匹配。当相似度足够高时，这条线索会被触发。

请生成一个优化的语义摘要，要求：

1. **核心语义提取**：用简洁的语言概括线索的核心信息和关键事实
2. **问题形式覆盖**：包含玩家可能会问的问题形式，例如：
   - "关于XXX的情况是什么？"
   - "谁做了XXX？"
   - "XXX发生了什么？"
3. **同义词扩展**：包含关键概念的同义词或近义词，提高匹配率
4. **场景描述**：简要描述什么场景/话题下玩家会询问到这条线索

格式要求：
- 直接返回摘要文本，不要有解释或前缀
- 控制在50-150字之间
- 使用自然语言，不要用列表格式"""

        user_prompt = f"""请为以下线索生成向量匹配优化的语义摘要：

线索名称：{clue_name}
线索详情：{clue_detail}"""

        async for chunk in self._call_llm_stream(config, system_prompt, user_prompt):
            yield chunk

    async def polish_npc_description(
        self,
        npc_name: str,
        field: str,
        content: str,
        context: str | None = None,
        llm_config_id: str | None = None,
    ) -> str:
        """
        Polish NPC description fields.

        Args:
            npc_name: Name of the NPC
            field: Field name (background, personality, etc.)
            content: Current content
            context: Optional context
            llm_config_id: Optional LLM config ID

        Returns:
            Polished content
        """
        config = await self._get_chat_config(llm_config_id)
        if not config:
            raise ValueError("No chat LLM configuration available")

        field_prompts = {
            "background": "背景故事，使其更加丰富、有层次感",
            "personality": "性格描述，使其更加鲜明、立体",
            "system_prompt": "系统提示词，使其更加清晰、有效",
        }

        field_desc = field_prompts.get(field, "描述")

        system_prompt = f"""你是一位专业的剧本杀编剧助手。你的任务是润色NPC的{field_desc}。

请直接返回润色后的内容，不要添加任何解释或前缀。"""

        user_prompt = f"""请润色以下NPC的{field_desc}：

NPC名称：{npc_name}
当前内容：{content}
"""
        if context:
            user_prompt += f"\n故事背景：{context}"

        result = await self._call_llm_text(config, system_prompt, user_prompt)
        return result.strip()

    async def polish_npc_description_stream(
        self,
        npc_name: str,
        field: str,
        content: str,
        context: str | None = None,
        llm_config_id: str | None = None,
    ) -> AsyncGenerator[str, None]:
        """Stream polish NPC description."""
        config = await self._get_chat_config(llm_config_id)
        if not config:
            raise ValueError("No chat LLM configuration available")

        field_prompts = {
            "background": "背景故事，使其更加丰富、有层次感",
            "personality": "性格描述，使其更加鲜明、立体",
            "system_prompt": "系统提示词，使其更加清晰、有效",
        }

        field_desc = field_prompts.get(field, "描述")

        system_prompt = f"""你是一位专业的剧本杀编剧助手。你的任务是润色NPC的{field_desc}。

请直接返回润色后的内容，不要添加任何解释或前缀。"""

        user_prompt = f"""请润色以下NPC的{field_desc}：

NPC名称：{npc_name}
当前内容：{content}
"""
        if context:
            user_prompt += f"\n故事背景：{context}"

        async for chunk in self._call_llm_stream(config, system_prompt, user_prompt):
            yield chunk

    async def _get_chat_config(self, config_id: str | None = None) -> LLMConfig | None:
        """Get chat LLM configuration."""
        if config_id:
            result = await self.db.execute(
                select(LLMConfig).where(
                    LLMConfig.id == config_id,
                    LLMConfig.type == LLMConfigType.CHAT,
                    LLMConfig.deleted_at.is_(None),
                )
            )
            config = result.scalar_one_or_none()
            if config:
                return config

        # Try to get default chat config first
        result = await self.db.execute(
            select(LLMConfig).where(
                LLMConfig.type == LLMConfigType.CHAT,
                LLMConfig.is_default.is_(True),
                LLMConfig.deleted_at.is_(None),
            )
        )
        config = result.scalar_one_or_none()
        if config:
            return config

        # Fallback: get any available chat config
        result = await self.db.execute(
            select(LLMConfig).where(
                LLMConfig.type == LLMConfigType.CHAT,
                LLMConfig.deleted_at.is_(None),
            ).limit(1)
        )
        return result.scalar_one_or_none()

    async def _call_llm_text(
        self,
        config: LLMConfig,
        system_prompt: str,
        user_prompt: str,
    ) -> str:
        """Call LLM and return text response."""
        async with httpx.AsyncClient(timeout=settings.llm_timeout) as client:
            response = await client.post(
                f"{config.base_url}/chat/completions",
                headers={"Authorization": f"Bearer {config.api_key}"},
                json={
                    "model": config.model,
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_prompt},
                    ],
                    "temperature": 0.7,
                },
            )
            response.raise_for_status()
            data = response.json()
            return data["choices"][0]["message"]["content"]

    async def _call_llm_stream(
        self,
        config: LLMConfig,
        system_prompt: str,
        user_prompt: str,
    ) -> AsyncGenerator[str, None]:
        """Call LLM and stream text response."""
        async with httpx.AsyncClient(timeout=httpx.Timeout(None)) as client:
            async with client.stream(
                "POST",
                f"{config.base_url}/chat/completions",
                headers={"Authorization": f"Bearer {config.api_key}"},
                json={
                    "model": config.model,
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_prompt},
                    ],
                    "temperature": 0.7,
                    "stream": True,
                },
            ) as response:
                response.raise_for_status()
                async for line in response.aiter_lines():
                    if not line:
                        continue
                    if line.startswith("data: "):
                        data = line[6:]
                        if data == "[DONE]":
                            break
                        try:
                            chunk = json.loads(data)
                            content = chunk.get("choices", [{}])[0].get("delta", {}).get("content", "")
                            if content:
                                yield content
                        except json.JSONDecodeError:
                            continue

    async def analyze_clue_chain(
        self,
        clues: list[dict],
        script_background: str | None = None,
        llm_config_id: str | None = None,
    ) -> dict:
        """
        Analyze clue chain logic and provide improvement suggestions.

        Args:
            clues: List of clue dictionaries with id, name, detail, prereq_clue_ids
            script_background: Optional script background for context
            llm_config_id: Optional LLM config ID

        Returns:
            Analysis result with issues and suggestions
        """
        config = await self._get_chat_config(llm_config_id)
        if not config:
            raise ValueError("No chat LLM configuration available")

        system_prompt = """你是一位专业的剧本杀推理顾问。你的任务是分析线索链的逻辑性，找出问题并提供改进建议。

请从以下角度分析：
1. 推理路径完整性：玩家能否通过这些线索推导出真相？
2. 难度平衡：线索的难度分布是否合理？
3. 冗余检测：是否有重复或可删除的线索？
4. 逻辑漏洞：线索之间是否存在矛盾？
5. 关键线索识别：哪些是破案必需的核心线索？

请返回JSON格式：
{
  "overall_score": 1-10的评分,
  "summary": "整体评价摘要",
  "issues": [
    {"type": "问题类型", "severity": "high/medium/low", "description": "问题描述", "affected_clues": ["线索ID"]}
  ],
  "suggestions": [
    {"type": "建议类型", "description": "建议描述", "priority": "high/medium/low"}
  ],
  "key_clues": ["核心线索ID列表"],
  "reasoning_paths": ["推理路径描述"]
}"""

        # Build clue chain description
        clue_descriptions = []
        for clue in clues:
            prereqs = clue.get("prereq_clue_ids", [])
            prereq_names = []
            for prereq_id in prereqs:
                prereq_clue = next((c for c in clues if c["id"] == prereq_id), None)
                if prereq_clue:
                    prereq_names.append(prereq_clue["name"])

            clue_desc = f"- {clue['name']} (ID: {clue['id']})"
            if prereq_names:
                clue_desc += f"\n  前置线索: {', '.join(prereq_names)}"
            if clue.get("detail"):
                detail_preview = clue["detail"][:100] + "..." if len(clue["detail"]) > 100 else clue["detail"]
                clue_desc += f"\n  内容: {detail_preview}"
            clue_descriptions.append(clue_desc)

        user_prompt = f"""请分析以下线索链的逻辑性：

线索列表（共{len(clues)}条）：
{chr(10).join(clue_descriptions)}
"""
        if script_background:
            user_prompt += f"\n故事背景：{script_background}"

        result = await self._call_llm_json(config, system_prompt, user_prompt)
        return result

    async def _call_llm_json(
        self,
        config: LLMConfig,
        system_prompt: str,
        user_prompt: str,
    ) -> dict:
        """Call LLM and parse JSON response."""
        async with httpx.AsyncClient(timeout=settings.llm_long_timeout) as client:
            response = await client.post(
                f"{config.base_url}/chat/completions",
                headers={"Authorization": f"Bearer {config.api_key}"},
                json={
                    "model": config.model,
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_prompt},
                    ],
                    "temperature": 0.7,
                    "response_format": {"type": "json_object"},
                },
            )
            response.raise_for_status()
            data = response.json()
            content = data["choices"][0]["message"]["content"]
            return json.loads(content)
