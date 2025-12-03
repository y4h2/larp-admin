"""LLM-based matching strategy."""

import json
import logging

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.clue import Clue
from app.models.llm_config import LLMConfig
from app.models.prompt_template import PromptTemplate
from app.services.common import LLMClient, LLMConfigManager
from app.services.template import template_renderer

from ..models import LLMMatchPrompts, LLMMatchResponse, MatchContext, MatchResult, PromptSegment
from .base import BaseStrategy
from .keyword import KeywordStrategy

logger = logging.getLogger(__name__)


class LLMStrategy(BaseStrategy):
    """LLM-based clue matching strategy."""

    def __init__(self, db: AsyncSession) -> None:
        super().__init__(db)
        self._keyword_fallback = KeywordStrategy(db)

    async def match(
        self,
        candidates: list[Clue],
        context: MatchContext,
    ) -> tuple[list[MatchResult], LLMMatchPrompts | None]:
        """
        Match clues using LLM.

        Args:
            candidates: List of candidate clues
            context: Match context with player message

        Returns:
            Tuple of (match results, LLM prompts for debug info)
        """
        results = []
        llm_prompts = None

        # Get chat config
        chat_config = await self._get_llm_config_for_chat(context.llm_config_id)
        if not chat_config:
            logger.warning("No chat LLM config found, falling back to keyword matching")
            return await self._keyword_fallback.match(candidates, context)

        if not candidates:
            return results, None

        # Build system prompt with segments
        system_prompt, system_segments = await self._build_llm_matching_prompt(
            context.template_id, candidates, context.llm_return_all_scores
        )

        # Store prompts for debug info
        llm_prompts = LLMMatchPrompts(
            system_prompt=system_prompt,
            user_message=context.player_message,
            system_prompt_segments=system_segments,
            user_message_segments=None,  # User message is plain text
        )

        # Call LLM
        try:
            llm_response = await self._call_llm_for_matching(
                chat_config,
                system_prompt,
                context.player_message,
            )

            # Build results
            score_reason_map = {m.id: (m.score, m.reason) for m in llm_response.matches}

            if context.llm_return_all_scores:
                for clue in candidates:
                    score, reason = score_reason_map.get(clue.id, (0.0, "未匹配"))
                    result = MatchResult(
                        clue=clue,
                        score=score,
                        match_reasons=[f"LLM: {reason}"],
                    )
                    results.append(result)
                logger.info(f"LLM matching: returning all {len(results)} clues' analysis")
            else:
                for clue in candidates:
                    if clue.id in score_reason_map:
                        score, reason = score_reason_map[clue.id]
                        if score > 0:
                            result = MatchResult(
                                clue=clue,
                                score=score,
                                match_reasons=[f"LLM: {reason}"],
                            )
                            results.append(result)
                logger.info(f"LLM matching: returning {len(results)} matched clues")

        except Exception as e:
            logger.error(f"Failed to match with LLM: {e}", exc_info=True)

        return results, llm_prompts

    async def _get_llm_config_for_chat(
        self, llm_config_id: str | None
    ) -> LLMConfig | None:
        """Get chat config - prefer specified ID, otherwise use default."""
        return await LLMConfigManager.get_chat_config(self.db, llm_config_id)

    async def _build_llm_matching_prompt(
        self,
        template_id: str | None,
        clues: list[Clue],
        return_all_scores: bool = False,
    ) -> tuple[str, list[PromptSegment]]:
        """Build the system prompt for LLM matching.

        Returns:
            Tuple of (prompt string, list of segments for UI rendering)
        """
        segments: list[PromptSegment] = []

        # Build clue list
        clue_list = []
        for i, clue in enumerate(clues, 1):
            clue_info = {
                "id": clue.id,
                "name": clue.name,
                "trigger_keywords": clue.trigger_keywords or [],
                "trigger_semantic_summary": clue.trigger_semantic_summary or "",
            }
            clue_list.append(f"{i}. {json.dumps(clue_info, ensure_ascii=False)}")

        clues_text = "\n".join(clue_list)

        # Load matching strategy from template
        matching_strategy = None
        matching_strategy_is_template = False
        if template_id:
            query = select(PromptTemplate).where(
                PromptTemplate.id == template_id,
                PromptTemplate.deleted_at.is_(None),
            )
            result = await self.db.execute(query)
            template = result.scalars().first()

            if template:
                render_result = template_renderer.render(
                    template.content,
                    {"clues": clues_text},
                )
                matching_strategy = render_result.rendered_content
                matching_strategy_is_template = True

        # Default matching strategy
        if not matching_strategy:
            matching_strategy = """分析玩家消息的意图，判断是否与线索相关。
对比每条线索的触发关键词和语义摘要，只有高度相关时才匹配。"""

        # Output requirements
        if return_all_scores:
            output_requirements = """- 为【所有线索】提供置信度分数(score: 0.0-1.0)和匹配原因(reason)
- 即使线索不匹配，也要返回其评分（不匹配的线索 score 应接近 0）
- 确保返回的线索数量与输入的线索数量一致"""
        else:
            output_requirements = """- 只返回匹配的线索，提供置信度分数(score: 0.0-1.0)和匹配原因(reason)
- 如果没有匹配的线索，返回空数组"""

        # Build segments for UI rendering
        segments.append(PromptSegment(
            type="system",
            content="你是一个剧本杀线索匹配助手。根据玩家的对话内容，判断哪些线索应该被触发。\n\n## 可用线索列表\n"
        ))
        segments.append(PromptSegment(
            type="variable",
            content=clues_text,
            variable_name="clues"
        ))
        segments.append(PromptSegment(
            type="system",
            content="\n\n## 匹配策略\n"
        ))
        segments.append(PromptSegment(
            type="template" if matching_strategy_is_template else "system",
            content=matching_strategy
        ))
        segments.append(PromptSegment(
            type="system",
            content="\n\n## 输出要求\n" + output_requirements
        ))

        # Build full prompt
        full_prompt = f"""你是一个剧本杀线索匹配助手。根据玩家的对话内容，判断哪些线索应该被触发。

## 可用线索列表
{clues_text}

## 匹配策略
{matching_strategy}

## 输出要求
{output_requirements}"""

        return full_prompt, segments

    async def _call_llm_for_matching(
        self, config: LLMConfig, system_prompt: str, user_message: str
    ) -> LLMMatchResponse:
        """Call LLM for clue matching with structured JSON output."""
        response_schema = {
            "type": "json_schema",
            "json_schema": {
                "name": "clue_match_response",
                "strict": True,
                "schema": {
                    "type": "object",
                    "properties": {
                        "matches": {
                            "type": "array",
                            "items": {
                                "type": "object",
                                "properties": {
                                    "id": {
                                        "type": "string",
                                        "description": "The clue ID",
                                    },
                                    "score": {
                                        "type": "number",
                                        "description": "Match confidence score (0.0-1.0)",
                                    },
                                    "reason": {
                                        "type": "string",
                                        "description": "Reason for the match",
                                    },
                                },
                                "required": ["id", "score", "reason"],
                                "additionalProperties": False,
                            },
                            "description": "List of matched clues",
                        },
                    },
                    "required": ["matches"],
                    "additionalProperties": False,
                },
            },
        }

        result = await LLMClient.call_structured(
            config,
            system_prompt,
            user_message,
            response_schema,
            temperature=settings.llm_matching_temperature,
        )
        return LLMMatchResponse.model_validate(result)
