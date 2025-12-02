"""Truth generation for murder mystery stories."""

import logging

from app.schemas.ai_assistant import (
    GenerateTruthRequest,
    TruthOptionsResponse,
)

from .llm_base import LLMBase

logger = logging.getLogger(__name__)


class TruthGenerator(LLMBase):
    """Generates truth options for murder mystery stories."""

    async def generate_options(
        self,
        request: GenerateTruthRequest,
    ) -> TruthOptionsResponse:
        """
        Generate multiple truth options based on story setting.

        Args:
            request: Contains story setting and optional hints.

        Returns:
            Multiple truth options for user to choose from.
        """
        config = await self._get_chat_config(request.llm_config_id)
        if not config:
            raise ValueError("No chat LLM configuration available")

        # Build hints text
        hints_text = ""
        if request.hints:
            if request.hints.murderer_hint:
                hints_text += f"- Murderer hint: {request.hints.murderer_hint}\n"
            if request.hints.motive_hint:
                hints_text += f"- Motive hint: {request.hints.motive_hint}\n"
            if request.hints.method_hint:
                hints_text += f"- Method hint: {request.hints.method_hint}\n"

        system_prompt = """You are an expert mystery story designer. Generate creative and logical murder mystery plots.

Your response must be valid JSON matching this structure:
{
  "options": [
    {
      "murderer": "Who is the murderer (role/identity)",
      "motive": "Why they committed the crime",
      "method": "How they did it (weapon/method)",
      "twist": "Optional surprising twist (can be null)",
      "summary": "Brief 1-2 sentence summary"
    }
  ],
  "recommendation_index": 0,
  "recommendation_reason": "Why this option is recommended"
}

Generate 3 distinct options that:
1. Fit the setting and atmosphere
2. Have logical and believable motives
3. Support interesting investigation gameplay
4. Allow for multiple clue discovery paths"""

        user_prompt = f"""Create 3 murder mystery truth options for this setting:

Genre: {request.setting.genre.value}
Era: {request.setting.era}
Location: {request.setting.location}
Atmosphere: {request.setting.atmosphere or 'Not specified'}
NPC Count: {request.setting.npc_count}
{f'Additional Notes: {request.setting.additional_notes}' if request.setting.additional_notes else ''}

{f'User Hints:\n{hints_text}' if hints_text else ''}

Generate 3 creative and distinct truth options."""

        response = await self._call_llm_json(config, system_prompt, user_prompt)
        return TruthOptionsResponse.model_validate(response)
