"""Clue chain analysis operations."""

import logging

from .llm_base import LLMBase

logger = logging.getLogger(__name__)


class ChainAnalyzer(LLMBase):
    """Analyzes clue chains for logic, completeness, and improvement suggestions."""

    async def analyze(
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
