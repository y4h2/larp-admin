"""NPC response generation service."""

import logging

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.llm_config import LLMConfig
from app.models.log import DialogueLog
from app.models.npc import NPC
from app.models.prompt_template import PromptTemplate
from app.models.script import Script
from app.schemas.simulate import ChatOptionsOverride
from app.services.common import LLMClient, LLMConfigManager
from app.services.template import template_renderer

from .models import LLMMetrics, MatchContext, MatchResult, NpcResponseResult, PromptSegment

logger = logging.getLogger(__name__)


class NpcResponseGenerator:
    """Generates NPC responses using LLM with dialogue history."""

    def __init__(self, db: AsyncSession) -> None:
        """Initialize the generator with a database session."""
        self.db = db

    async def generate(
        self,
        context: MatchContext,
        triggered_clues: list[MatchResult],
        player_message: str,
    ) -> NpcResponseResult:
        """
        Generate NPC response using LLM with dialogue history.

        Args:
            context: Match context with template and config IDs
            triggered_clues: List of triggered clue results
            player_message: Original player message

        Returns:
            NpcResponseResult with response and prompt info
        """
        try:
            logger.info(f"Generating NPC response for NPC={context.npc_id}")

            # Get chat config
            chat_config = await self._get_llm_config_by_id(context.npc_chat_config_id)
            if not chat_config:
                logger.warning(f"NPC chat config not found: {context.npc_chat_config_id}")
                return NpcResponseResult()

            logger.info(f"Using chat config: {chat_config.name} ({chat_config.model})")

            # Load NPC and Script data
            npc = await self._get_npc(context.npc_id)
            script = await self._get_script(context.script_id)
            if not npc:
                logger.warning(f"NPC not found: {context.npc_id}")
                return NpcResponseResult()

            # Determine if we have triggered clues with actual guidance
            has_clue_guidance = False
            clue_guides = []
            if triggered_clues:
                for r in triggered_clues:
                    if r.clue.detail_for_npc:
                        clue_guides.append(r.clue.detail_for_npc)
                has_clue_guidance = len(clue_guides) > 0

            # Select appropriate template
            template_id = self._select_template(context, has_clue_guidance)

            # Load system template
            system_template = await self._load_template_content(template_id)

            # Build template context
            template_context = {
                "npc": {
                    "id": npc.id,
                    "name": npc.name,
                    "age": npc.age,
                    "personality": npc.personality,
                    "background": npc.background,
                    "knowledge_scope": npc.knowledge_scope or {},
                },
                "script": {
                    "id": script.id if script else "",
                    "title": script.title if script else "",
                    "background": script.background if script else "",
                } if script else {},
                "clue_guides": clue_guides,
                "has_clue": has_clue_guidance,
            }

            # Render system prompt
            system_prompt_segments: list[PromptSegment] | None = None
            if system_template:
                render_result = template_renderer.render(system_template, template_context)
                system_prompt = render_result.rendered_content
                # Convert Pydantic segments to dataclass segments
                if render_result.segments:
                    system_prompt_segments = [
                        PromptSegment(
                            type=seg.type,
                            content=seg.content,
                            variable_name=seg.variable_name,
                        )
                        for seg in render_result.segments
                    ]
            else:
                system_prompt = f"你是{npc.name}。性格：{npc.personality or '友善'}。背景：{npc.background or '无'}。"

            # Get dialogue history
            history_messages = await self._get_dialogue_history(
                context.session_id, limit=settings.dialogue_history_limit
            )

            # Build messages array
            messages = [{"role": "system", "content": system_prompt}]

            for log in history_messages:
                messages.append({"role": "user", "content": log.player_message})
                if log.npc_response:
                    messages.append({"role": "assistant", "content": log.npc_response})

            # Build user message with guide instruction
            user_prompt_segments: list[PromptSegment] = []
            if has_clue_guidance:
                guide_prefix = (
                    f"【指引】请在接下来的回答中，自然地透露以下信息的一部分，"
                    f"用{npc.name}的语气说出来，不要一次性讲完所有细节，"
                    f"不要提到'线索'、'卡牌'、'ID'等元信息：\n"
                )
                clue_guides_text = "\n".join(clue_guides)
                guide = guide_prefix + clue_guides_text
                # Build segments for user prompt
                user_prompt_segments.append(PromptSegment(type="system", content=guide_prefix))
                user_prompt_segments.append(PromptSegment(type="variable", content=clue_guides_text, variable_name="clue_guides"))
            else:
                guide = (
                    f"【指引】这一次你不需要提供新的关键情报，"
                    f"只需根据对话和人设，自然回应对方。"
                )
                user_prompt_segments.append(PromptSegment(type="system", content=guide))

            user_prompt_segments.append(PromptSegment(type="system", content="\n玩家刚才的话是："))
            user_prompt_segments.append(PromptSegment(type="variable", content=player_message, variable_name="player_message"))
            user_content = f"{guide}\n玩家刚才的话是：{player_message}"
            messages.append({"role": "user", "content": user_content})

            # Call LLM
            logger.info(f"Calling LLM with {len(messages)} messages")
            response, metrics = await self._call_llm_with_messages(
                chat_config, messages, context.chat_options_override
            )
            logger.info(f"NPC response generated: {len(response)} chars")

            return NpcResponseResult(
                response=response,
                system_prompt=system_prompt,
                user_prompt=user_content,
                messages=messages,
                has_clue=has_clue_guidance,
                system_prompt_segments=system_prompt_segments,
                user_prompt_segments=user_prompt_segments if user_prompt_segments else None,
                metrics=metrics,
            )

        except Exception as e:
            logger.error(f"Failed to generate NPC response: {e}", exc_info=True)
            return NpcResponseResult()

    def _select_template(
        self, context: MatchContext, has_clue_guidance: bool
    ) -> str | None:
        """Select appropriate template based on clue guidance."""
        if has_clue_guidance and context.npc_clue_template_id:
            logger.info(f"Using clue template: {context.npc_clue_template_id}")
            return context.npc_clue_template_id
        elif context.npc_no_clue_template_id:
            logger.info(f"Using no-clue template: {context.npc_no_clue_template_id}")
            return context.npc_no_clue_template_id
        elif context.npc_clue_template_id:
            logger.info(f"Fallback to clue template: {context.npc_clue_template_id}")
            return context.npc_clue_template_id
        else:
            logger.info("No template configured, using default prompt")
            return None

    async def _get_llm_config_by_id(self, config_id: str | None) -> LLMConfig | None:
        """Get LLM config by ID."""
        if not config_id:
            return None
        return await LLMConfigManager.get_config_by_id(self.db, config_id)

    async def _get_npc(self, npc_id: str) -> NPC | None:
        """Get NPC by ID."""
        query = select(NPC).where(NPC.id == npc_id)
        result = await self.db.execute(query)
        return result.scalars().first()

    async def _get_script(self, script_id: str) -> Script | None:
        """Get Script by ID."""
        query = select(Script).where(
            Script.id == script_id,
            Script.deleted_at.is_(None),
        )
        result = await self.db.execute(query)
        return result.scalars().first()

    async def _load_template_content(self, template_id: str | None) -> str | None:
        """Load template content by ID."""
        if not template_id:
            return None
        query = select(PromptTemplate).where(
            PromptTemplate.id == template_id,
            PromptTemplate.deleted_at.is_(None),
        )
        result = await self.db.execute(query)
        template = result.scalars().first()
        return template.content if template else None

    async def _get_dialogue_history(
        self, session_id: str | None, limit: int = 10
    ) -> list[DialogueLog]:
        """Get dialogue history for a session."""
        if not session_id:
            return []

        query = (
            select(DialogueLog)
            .where(DialogueLog.session_id == session_id)
            .order_by(DialogueLog.created_at.asc())
            .limit(limit)
        )
        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def _call_llm_with_messages(
        self,
        config: LLMConfig,
        messages: list[dict],
        chat_override: ChatOptionsOverride | None = None,
    ) -> tuple[str, LLMMetrics]:
        """Call LLM with a full messages array.

        Returns:
            Tuple of (response content, LLM metrics)
        """
        temperature = 0.7
        max_tokens = None

        if chat_override:
            if chat_override.temperature is not None:
                temperature = chat_override.temperature
                logger.info(f"Using override temperature: {temperature}")
            if chat_override.max_tokens is not None:
                max_tokens = chat_override.max_tokens
                logger.info(f"Using override max_tokens: {max_tokens}")
        elif config.options:
            config_temp = config.options.get("temperature")
            if config_temp is not None:
                temperature = config_temp
            config_max_tokens = config.options.get("max_tokens")
            if config_max_tokens is not None:
                max_tokens = config_max_tokens

        logger.debug(f"LLM model: {config.model}, temp: {temperature}")

        llm_response = await LLMClient.call_with_messages_with_usage(
            config, messages, temperature, max_tokens
        )

        metrics = LLMMetrics(
            prompt_tokens=llm_response.usage.prompt_tokens,
            completion_tokens=llm_response.usage.completion_tokens,
            total_tokens=llm_response.usage.total_tokens,
            latency_ms=llm_response.latency_ms,
            model=config.model,
        )

        return llm_response.content, metrics
