"""Clue enhancement operations."""

import logging
from collections.abc import AsyncGenerator

from .llm_base import LLMBase

logger = logging.getLogger(__name__)


class ClueEnhancer(LLMBase):
    """Enhances clue content including polishing, keywords, and semantic summaries."""

    async def polish_detail(
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

    async def polish_detail_stream(
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
