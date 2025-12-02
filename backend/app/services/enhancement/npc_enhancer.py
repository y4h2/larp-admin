"""NPC enhancement operations."""

import logging
from collections.abc import AsyncGenerator

from .llm_base import LLMBase

logger = logging.getLogger(__name__)


class NPCEnhancer(LLMBase):
    """Enhances NPC descriptions including background and personality."""

    async def polish_description(
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

    async def polish_description_stream(
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
