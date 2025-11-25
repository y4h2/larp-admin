"""Clue matching service for dialogue simulation."""

import json
import logging
from dataclasses import dataclass, field

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.clue import Clue
from app.models.llm_config import LLMConfig, LLMConfigType
from app.models.log import DialogueLog
from app.models.npc import NPC
from app.models.prompt_template import PromptTemplate
from app.models.script import Script
from app.schemas.simulate import (
    ChatOptionsOverride,
    EmbeddingOptionsOverride,
    MatchedClue,
    MatchingStrategy,
    SimulateRequest,
    SimulateResponse,
)
from app.services.template_renderer import template_renderer
from app.services.vector_matching import VectorClueRetriever

logger = logging.getLogger(__name__)


@dataclass
class MatchContext:
    """Context for clue matching."""

    player_message: str
    unlocked_clue_ids: set[str]
    npc_id: str
    script_id: str
    matching_strategy: MatchingStrategy = MatchingStrategy.KEYWORD
    template_id: str | None = None
    llm_config_id: str | None = None
    # NPC reply configuration
    npc_clue_template_id: str | None = None  # Template when clues triggered
    npc_no_clue_template_id: str | None = None  # Template when no clues triggered
    npc_chat_config_id: str | None = None
    session_id: str | None = None
    # Runtime options override
    embedding_options_override: EmbeddingOptionsOverride | None = None
    chat_options_override: ChatOptionsOverride | None = None


@dataclass
class MatchResult:
    """Result of matching a single clue."""

    clue: Clue
    score: float = 0.0
    match_reasons: list[str] = field(default_factory=list)
    keyword_matches: list[str] = field(default_factory=list)
    embedding_similarity: float | None = None
    is_triggered: bool = False


class MatchingService:
    """
    Service for matching player messages to clues.

    Implements a keyword-based matching engine based on:
    - trigger_keywords: Keywords for matching
    - trigger_semantic_summary: Semantic summary for matching
    - prereq_clue_ids: Prerequisite clue checking
    """

    def __init__(self, db: AsyncSession) -> None:
        """Initialize the service with a database session."""
        self.db = db

    async def simulate(self, request: SimulateRequest) -> SimulateResponse:
        """
        Simulate dialogue matching for a player message.

        Args:
            request: The simulation request with context and message.

        Returns:
            SimulateResponse with matched and triggered clues.
        """
        # Build match context
        context = MatchContext(
            player_message=request.player_message.lower(),
            unlocked_clue_ids=set(request.unlocked_clue_ids),
            npc_id=request.npc_id,
            script_id=request.script_id,
            matching_strategy=request.matching_strategy,
            template_id=request.template_id,
            llm_config_id=request.llm_config_id,
            npc_clue_template_id=request.npc_clue_template_id,
            npc_no_clue_template_id=request.npc_no_clue_template_id,
            npc_chat_config_id=request.npc_chat_config_id,
            session_id=request.session_id,
            embedding_options_override=request.embedding_options_override,
            chat_options_override=request.chat_options_override,
        )

        # Get candidate clues for this NPC
        candidates = await self._get_candidate_clues(
            script_id=request.script_id,
            npc_id=request.npc_id,
        )

        # Match clues based on strategy
        if request.matching_strategy == MatchingStrategy.LLM:
            results = await self._match_with_llm(candidates, context)
        elif request.matching_strategy == MatchingStrategy.EMBEDDING:
            results = await self._match_with_embedding(candidates, context)
        else:
            # Default keyword-based matching
            results = []
            for clue in candidates:
                result = self._match_clue(clue, context)
                if result.score > 0:
                    results.append(result)

        # Sort by score
        results.sort(key=lambda r: r.score, reverse=True)

        # Determine threshold - use override > config > default
        threshold = 0.5  # Default
        if request.matching_strategy == MatchingStrategy.EMBEDDING:
            # Try override first
            if (
                context.embedding_options_override
                and context.embedding_options_override.similarity_threshold is not None
            ):
                threshold = context.embedding_options_override.similarity_threshold
                logger.info(f"Using override similarity_threshold: {threshold}")
            else:
                # Try to get from config
                embedding_config = await self._get_llm_config_for_embedding(context.llm_config_id)
                if embedding_config and embedding_config.options:
                    config_threshold = embedding_config.options.get("similarity_threshold")
                    if config_threshold is not None:
                        threshold = config_threshold
                        logger.info(f"Using config similarity_threshold: {threshold}")

        # Determine triggered clues (score >= threshold)
        triggered = [r for r in results if r.score >= threshold]
        for r in triggered:
            r.is_triggered = True

        # Build response
        matched_clues = [self._result_to_schema(r) for r in results]
        triggered_clues = [self._result_to_schema(r) for r in triggered]

        # Generate NPC response if templates are provided
        npc_response = None
        has_clue_template = context.npc_clue_template_id is not None
        has_no_clue_template = context.npc_no_clue_template_id is not None
        has_chat_config = context.npc_chat_config_id is not None

        if has_clue_template or has_no_clue_template or has_chat_config:
            # Log which params are provided
            logger.info(
                f"NPC reply params: clue_template_id={context.npc_clue_template_id}, "
                f"no_clue_template_id={context.npc_no_clue_template_id}, "
                f"chat_config_id={context.npc_chat_config_id}"
            )
            # Need at least one template and chat config
            if (has_clue_template or has_no_clue_template) and has_chat_config:
                npc_response = await self._generate_npc_response(
                    context=context,
                    triggered_clues=triggered,
                    player_message=request.player_message,
                )
            else:
                logger.warning(
                    "NPC reply skipped: at least one template and chat_config_id are required"
                )

        return SimulateResponse(
            matched_clues=matched_clues,
            triggered_clues=triggered_clues,
            npc_response=npc_response,
            debug_info={
                "total_candidates": len(candidates),
                "total_matched": len(results),
                "total_triggered": len(triggered),
                "threshold": threshold,
                "strategy": request.matching_strategy.value,
            },
        )

    async def _get_candidate_clues(
        self,
        script_id: str,
        npc_id: str,
    ) -> list[Clue]:
        """Get candidate clues for matching."""
        query = (
            select(Clue)
            .where(Clue.script_id == script_id)
            .where(Clue.npc_id == npc_id)
        )

        result = await self.db.execute(query)
        return list(result.scalars().all())

    def _match_clue(
        self,
        clue: Clue,
        context: MatchContext,
    ) -> MatchResult:
        """Match a single clue against the context."""
        result = MatchResult(clue=clue)

        # Check prerequisite clues
        if not self._check_prerequisites(clue, context):
            return result

        # Check keyword matching
        keyword_score, keyword_matches, keyword_reasons = self._check_keywords(
            clue.trigger_keywords, context.player_message
        )

        if keyword_score > 0:
            result.score = keyword_score
            result.keyword_matches = keyword_matches
            result.match_reasons = keyword_reasons

        return result

    def _check_prerequisites(
        self,
        clue: Clue,
        context: MatchContext,
    ) -> bool:
        """Check if prerequisite clues are unlocked."""
        prereq_ids = clue.prereq_clue_ids or []
        for prereq_id in prereq_ids:
            if prereq_id not in context.unlocked_clue_ids:
                return False
        return True

    def _check_keywords(
        self,
        trigger_keywords: list[str],
        message: str,
    ) -> tuple[float, list[str], list[str]]:
        """
        Check keyword matching and return score.

        Returns:
            Tuple of (score, matched_keywords, reasons)
        """
        if not trigger_keywords:
            return 0.0, [], ["No trigger keywords defined"]

        matches: list[str] = []
        reasons: list[str] = []

        # Check each keyword
        for keyword in trigger_keywords:
            if keyword.lower() in message.lower():
                matches.append(keyword)

        if not matches:
            return 0.0, [], ["No keywords matched"]

        # Calculate score based on match ratio
        score = len(matches) / len(trigger_keywords)
        reasons.append(f"Matched {len(matches)}/{len(trigger_keywords)} keywords: {matches}")

        return score, matches, reasons

    def _result_to_schema(self, result: MatchResult) -> MatchedClue:
        """Convert internal result to schema."""
        return MatchedClue(
            clue_id=result.clue.id,
            name=result.clue.name,
            clue_type=result.clue.type.value,
            score=result.score,
            match_reasons=result.match_reasons,
            keyword_matches=result.keyword_matches,
            embedding_similarity=result.embedding_similarity,
            is_triggered=result.is_triggered,
        )

    async def _match_with_embedding(
        self,
        candidates: list[Clue],
        context: MatchContext,
    ) -> list[MatchResult]:
        """
        Match clues using embedding similarity with LangChain and Chroma.

        Based on VectorClueRetrievalStrategy from data/sample/clue.py:
        - Uses OpenAIEmbeddings and Chroma vector store
        - Renders clue content using template before embedding
        - Uses similarity search for matching
        """
        results = []

        # Get embedding config - prefer specified config, otherwise use default
        embedding_config = await self._get_llm_config_for_embedding(context.llm_config_id)
        if not embedding_config:
            logger.warning("No embedding config found, falling back to keyword matching")
            for clue in candidates:
                result = self._match_clue(clue, context)
                if result.score > 0:
                    results.append(result)
            return results

        # Load template if specified
        template_content: str | None = None
        if context.template_id:
            template_content = await self._load_template_content(context.template_id)
            if template_content:
                logger.info(f"Using template {context.template_id} for embedding")

        # Filter candidates by prerequisites
        eligible_clues = [
            c for c in candidates if self._check_prerequisites(c, context)
        ]

        if not eligible_clues:
            return results

        # Create vector retriever
        retriever = VectorClueRetriever(embedding_config)

        try:
            # Build embedding database with eligible (unlocked) clues
            retriever.build_embedding_db(eligible_clues, template_content)

            # Search for matching clues
            vector_results = retriever.retrieve_clues(
                context.player_message,
                k=len(eligible_clues),  # Get all results
                score_threshold=0.0,
            )

            # Convert to MatchResult
            for vr in vector_results:
                clue = retriever.get_clue(vr.clue_id)
                if clue:
                    result = MatchResult(
                        clue=clue,
                        score=vr.score,
                        embedding_similarity=vr.score,
                        match_reasons=[
                            f"Embedding similarity: {vr.score:.3f}",
                        ],
                    )
                    if template_content:
                        result.match_reasons.append("Matched using template rendering")
                    results.append(result)

            logger.info(f"Vector matching found {len(results)} results")

        except Exception as e:
            logger.error(f"Vector matching failed: {e}", exc_info=True)
            # Fallback to keyword matching
            for clue in eligible_clues:
                result = self._match_clue(clue, context)
                if result.score > 0:
                    results.append(result)

        finally:
            # Always cleanup the Chroma collection after use
            retriever.cleanup()

        return results

    async def _get_llm_config_for_embedding(
        self, llm_config_id: str | None
    ) -> LLMConfig | None:
        """Get embedding config - prefer specified ID, otherwise use default."""
        if llm_config_id:
            query = select(LLMConfig).where(
                LLMConfig.id == llm_config_id,
                LLMConfig.type == LLMConfigType.EMBEDDING,
            )
            result = await self.db.execute(query)
            config = result.scalars().first()
            if config:
                return config
            logger.warning(
                f"Specified embedding config {llm_config_id} not found, using default"
            )

        return await self._get_default_llm_config(LLMConfigType.EMBEDDING)

    async def _load_template_content(self, template_id: str) -> str | None:
        """Load template content by ID."""
        query = select(PromptTemplate).where(
            PromptTemplate.id == template_id,
            PromptTemplate.deleted_at.is_(None),
        )
        result = await self.db.execute(query)
        template = result.scalars().first()
        return template.content if template else None

    async def _match_with_llm(
        self,
        candidates: list[Clue],
        context: MatchContext,
    ) -> list[MatchResult]:
        """
        Match clues using LLM.

        Provides all candidate clues to the LLM and asks it to identify
        which clues are relevant to the player message.
        """
        results = []

        # Get chat config
        chat_config = await self._get_default_llm_config(LLMConfigType.CHAT)
        if not chat_config:
            logger.warning("No chat LLM config found, falling back to keyword matching")
            for clue in candidates:
                result = self._match_clue(clue, context)
                if result.score > 0:
                    results.append(result)
            return results

        # Filter candidates by prerequisites
        eligible_clues = [
            c for c in candidates if self._check_prerequisites(c, context)
        ]

        if not eligible_clues:
            return results

        # Get template if specified
        system_prompt = await self._build_llm_matching_prompt(
            context.template_id, eligible_clues
        )

        # Call LLM
        try:
            llm_response = await self._call_llm(
                chat_config,
                system_prompt,
                context.player_message,
            )

            # Parse LLM response to extract matched clue IDs
            matched_ids = self._parse_llm_response(llm_response, eligible_clues)

            # Build results
            for clue in eligible_clues:
                if clue.id in matched_ids:
                    result = MatchResult(
                        clue=clue,
                        score=matched_ids[clue.id],
                        match_reasons=[f"LLM identified as relevant"],
                    )
                    results.append(result)

        except Exception as e:
            logger.error(f"Failed to match with LLM: {e}")

        return results

    async def _get_default_llm_config(
        self, config_type: LLMConfigType
    ) -> LLMConfig | None:
        """Get default LLM config of given type."""
        query = select(LLMConfig).where(
            LLMConfig.type == config_type,
            LLMConfig.is_default.is_(True),
        )
        result = await self.db.execute(query)
        return result.scalars().first()

    async def _build_llm_matching_prompt(
        self, template_id: str | None, clues: list[Clue]
    ) -> str:
        """Build the system prompt for LLM matching."""
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

        # Use template if provided
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
                return render_result.rendered_content

        # Default prompt
        return f"""You are a clue matching assistant. Given a player message, identify which clues are relevant.

Available clues:
{clues_text}

Instructions:
1. Analyze the player message to understand what they're asking about
2. Compare with each clue's trigger keywords and semantic summary
3. Return a JSON array of relevant clue IDs with confidence scores (0.0-1.0)

Response format:
{{"matches": [{{"id": "clue-id", "score": 0.8, "reason": "why matched"}}]}}

Only return the JSON object, no other text."""

    async def _call_llm(
        self, config: LLMConfig, system_prompt: str, user_message: str
    ) -> str:
        """Call LLM with system prompt and user message."""
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                f"{config.base_url}/chat/completions",
                headers={"Authorization": f"Bearer {config.api_key}"},
                json={
                    "model": config.model,
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_message},
                    ],
                    "temperature": 0.1,  # Low temperature for more consistent results
                },
            )
            response.raise_for_status()
            data = response.json()
            return data["choices"][0]["message"]["content"]

    def _parse_llm_response(
        self, response: str, clues: list[Clue]
    ) -> dict[str, float]:
        """Parse LLM response to extract matched clue IDs and scores."""
        matched_ids: dict[str, float] = {}

        try:
            # Try to parse as JSON
            # Extract JSON from response (it might have extra text)
            json_start = response.find("{")
            json_end = response.rfind("}") + 1
            if json_start >= 0 and json_end > json_start:
                json_str = response[json_start:json_end]
                data = json.loads(json_str)

                matches = data.get("matches", [])
                valid_ids = {c.id for c in clues}

                for match in matches:
                    clue_id = match.get("id", "")
                    score = float(match.get("score", 0.5))
                    if clue_id in valid_ids:
                        matched_ids[clue_id] = min(1.0, max(0.0, score))

        except (json.JSONDecodeError, ValueError, KeyError) as e:
            logger.warning(f"Failed to parse LLM response: {e}, response: {response}")

        return matched_ids

    async def _generate_npc_response(
        self,
        context: MatchContext,
        triggered_clues: list[MatchResult],
        player_message: str,
    ) -> str | None:
        """
        Generate NPC response using LLM with dialogue history.

        Based on npc_reply_with_clue pattern from data/sample/clue.py:
        1. Uses system prompt template for NPC role, personality, background
        2. Adds conversation history (last N messages)
        3. Creates user message with guide instruction and player message:
           - If clues triggered: instructs NPC to naturally reveal clue info
           - If no clues: instructs NPC to respond naturally without new info

        Args:
            context: Match context with template and config IDs
            triggered_clues: List of triggered clue results
            player_message: Original player message

        Returns:
            NPC response string or None if generation fails
        """
        try:
            logger.info(f"Generating NPC response for NPC={context.npc_id}")

            # Get chat config
            chat_config = await self._get_llm_config_by_id(context.npc_chat_config_id)
            if not chat_config:
                logger.warning(f"NPC chat config not found: {context.npc_chat_config_id}")
                return None

            logger.info(f"Using chat config: {chat_config.name} ({chat_config.model})")

            # Load NPC and Script data
            npc = await self._get_npc(context.npc_id)
            script = await self._get_script(context.script_id)
            if not npc:
                logger.warning(f"NPC not found: {context.npc_id}")
                return None

            # Determine if we have triggered clues with actual guidance
            has_clue_guidance = False
            clue_guides = []
            if triggered_clues:
                for r in triggered_clues:
                    if r.clue.detail_for_npc:
                        clue_guides.append(r.clue.detail_for_npc)
                has_clue_guidance = len(clue_guides) > 0

            # Select appropriate template based on whether clues were triggered
            if has_clue_guidance and context.npc_clue_template_id:
                template_id = context.npc_clue_template_id
                logger.info(f"Using clue template: {template_id}")
            elif context.npc_no_clue_template_id:
                template_id = context.npc_no_clue_template_id
                logger.info(f"Using no-clue template: {template_id}")
            elif context.npc_clue_template_id:
                # Fallback to clue template if no-clue template not set
                template_id = context.npc_clue_template_id
                logger.info(f"Fallback to clue template: {template_id}")
            else:
                template_id = None
                logger.info("No template configured, using default prompt")

            # Load system template
            system_template = await self._load_template_content(template_id)

            # Build template context for system prompt
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
                # Add clue guides to template context for clue template
                "clue_guides": clue_guides,
                "has_clue": has_clue_guidance,
            }

            # Render system prompt
            system_prompt = ""
            if system_template:
                render_result = template_renderer.render(system_template, template_context)
                system_prompt = render_result.rendered_content
            else:
                # Default system prompt
                system_prompt = f"你是{npc.name}。性格：{npc.personality or '友善'}。背景：{npc.background or '无'}。"

            # Get dialogue history (last 4 rounds like in sample)
            history_messages = await self._get_dialogue_history(context.session_id, limit=4)

            # Build messages array
            messages = [{"role": "system", "content": system_prompt}]

            # Add dialogue history
            for log in history_messages:
                messages.append({"role": "user", "content": log.player_message})
                if log.npc_response:
                    messages.append({"role": "assistant", "content": log.npc_response})

            # Build user message with guide instruction (like npc_reply_with_clue)
            if has_clue_guidance:
                guide = (
                    f"【指引】请在接下来的回答中，自然地透露以下信息的一部分，"
                    f"用{npc.name}的语气说出来，不要一次性讲完所有细节，"
                    f"不要提到'线索'、'卡牌'、'ID'等元信息：\n"
                    + "\n".join(clue_guides)
                )
            else:
                guide = (
                    f"【指引】这一次你不需要提供新的关键情报，"
                    f"只需根据对话和人设，自然回应对方。"
                )

            user_content = f"{guide}\n玩家刚才的话是：{player_message}"
            messages.append({"role": "user", "content": user_content})

            # Call LLM
            logger.info(f"Calling LLM with {len(messages)} messages")
            response = await self._call_llm_with_messages(
                chat_config, messages, context.chat_options_override
            )
            logger.info(f"NPC response generated: {len(response)} chars")
            return response

        except Exception as e:
            logger.error(f"Failed to generate NPC response: {e}", exc_info=True)
            return None

    async def _get_llm_config_by_id(self, config_id: str | None) -> LLMConfig | None:
        """Get LLM config by ID."""
        if not config_id:
            return None
        query = select(LLMConfig).where(LLMConfig.id == config_id)
        result = await self.db.execute(query)
        return result.scalars().first()

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
    ) -> str:
        """Call LLM with a full messages array."""
        # Normalize base_url to avoid double slashes
        base_url = config.base_url.rstrip("/")
        url = f"{base_url}/chat/completions"

        # Determine temperature: override > config > default
        temperature = 0.7  # Default
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

        logger.debug(f"LLM API URL: {url}, model: {config.model}, temp: {temperature}")

        request_body = {
            "model": config.model,
            "messages": messages,
            "temperature": temperature,
        }
        if max_tokens is not None:
            request_body["max_tokens"] = max_tokens

        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                url,
                headers={"Authorization": f"Bearer {config.api_key}"},
                json=request_body,
            )
            response.raise_for_status()
            data = response.json()
            return data["choices"][0]["message"]["content"]
