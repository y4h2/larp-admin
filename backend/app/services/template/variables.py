"""Template variable definitions.

Defines all available variables that can be used in prompt templates.
"""

from app.schemas.prompt_template import (
    AvailableVariablesResponse,
    VariableCategory,
    VariableInfo,
)


def get_available_variables() -> AvailableVariablesResponse:
    """
    Get all available template variables organized by category.

    These variables can be used in templates with jsonpath-style access.

    Returns:
        AvailableVariablesResponse with all variable categories.
    """
    categories = [
        VariableCategory(
            name="clue",
            description="Clue object fields - use {{clue.field_name}}",
            variables=[
                VariableInfo(
                    name="clue.id",
                    description="Clue ID",
                    type="string",
                    example="clue-123",
                ),
                VariableInfo(
                    name="clue.name",
                    description="Clue name",
                    type="string",
                    example="Murder Weapon",
                ),
                VariableInfo(
                    name="clue.type",
                    description="Clue type (text/image)",
                    type="string",
                    example="text",
                ),
                VariableInfo(
                    name="clue.detail",
                    description="Clue detail content",
                    type="string",
                    example="A bloody knife was found under the bed...",
                ),
                VariableInfo(
                    name="clue.detail_for_npc",
                    description="Guidance for NPC on how to reveal this clue",
                    type="string",
                    example="Nervously mention finding something sharp...",
                ),
                VariableInfo(
                    name="clue.trigger_keywords",
                    description="Keywords that trigger this clue (list, numbered by default, use {{var|comma}} for comma-separated)",
                    type="list",
                    example="1. knife\n2. weapon\n3. murder",
                ),
                VariableInfo(
                    name="clue.trigger_semantic_summary",
                    description="Semantic summary for matching",
                    type="string",
                    example="Player asks about the murder weapon",
                ),
            ],
        ),
        VariableCategory(
            name="npc",
            description="NPC object fields - use {{npc.field_name}}",
            variables=[
                VariableInfo(
                    name="npc.id",
                    description="NPC ID",
                    type="string",
                    example="npc-123",
                ),
                VariableInfo(
                    name="npc.name",
                    description="NPC name",
                    type="string",
                    example="John Smith",
                ),
                VariableInfo(
                    name="npc.age",
                    description="NPC age",
                    type="number",
                    example="45",
                ),
                VariableInfo(
                    name="npc.background",
                    description="NPC background story",
                    type="string",
                    example="A former butler who worked at the mansion...",
                ),
                VariableInfo(
                    name="npc.personality",
                    description="NPC personality description",
                    type="string",
                    example="Nervous and secretive, tends to avoid eye contact",
                ),
                VariableInfo(
                    name="npc.knowledge_scope.knows",
                    description="Things the NPC knows (list, numbered by default, use {{var|comma}} for comma-separated)",
                    type="list",
                    example="1. saw the victim at 10pm\n2. heard a scream",
                ),
                VariableInfo(
                    name="npc.knowledge_scope.does_not_know",
                    description="Things the NPC doesn't know (list, numbered by default, use {{var|comma}} for comma-separated)",
                    type="list",
                    example="1. who the murderer is\n2. where the weapon is",
                ),
                VariableInfo(
                    name="npc.knowledge_scope.world_model_limits",
                    description="Limits of NPC's world knowledge (list, numbered by default, use {{var|comma}} for comma-separated)",
                    type="list",
                    example="1. doesn't know about modern technology",
                ),
            ],
        ),
        VariableCategory(
            name="script",
            description="Script object fields - use {{script.field_name}}",
            variables=[
                VariableInfo(
                    name="script.id",
                    description="Script ID",
                    type="string",
                    example="script-123",
                ),
                VariableInfo(
                    name="script.title",
                    description="Script title",
                    type="string",
                    example="Murder at the Manor",
                ),
                VariableInfo(
                    name="script.summary",
                    description="Script summary",
                    type="string",
                    example="A thrilling murder mystery set in Victorian England...",
                ),
                VariableInfo(
                    name="script.background",
                    description="Script background setting",
                    type="string",
                    example="The year is 1888, in a wealthy London mansion...",
                ),
                VariableInfo(
                    name="script.difficulty",
                    description="Script difficulty level",
                    type="string",
                    example="medium",
                ),
                VariableInfo(
                    name="script.truth.murderer",
                    description="The murderer (from truth object)",
                    type="string",
                    example="John Smith",
                ),
                VariableInfo(
                    name="script.truth.weapon",
                    description="The murder weapon (from truth object)",
                    type="string",
                    example="A kitchen knife",
                ),
                VariableInfo(
                    name="script.truth.motive",
                    description="The motive (from truth object)",
                    type="string",
                    example="Revenge for past betrayal",
                ),
                VariableInfo(
                    name="script.truth.crime_method",
                    description="How the crime was committed (from truth object)",
                    type="string",
                    example="Stabbed in the study at midnight",
                ),
            ],
        ),
        VariableCategory(
            name="context",
            description="Context variables - use {{variable_name}}",
            variables=[
                VariableInfo(
                    name="player_input",
                    description="Current player input message",
                    type="string",
                    example="What happened last night?",
                ),
                VariableInfo(
                    name="now",
                    description="Current timestamp",
                    type="string",
                    example="2024-01-15 10:30:00",
                ),
                VariableInfo(
                    name="unlocked_clues",
                    description="List of already unlocked clue names (numbered by default, use {{var|comma}} for comma-separated)",
                    type="list",
                    example="1. Murder Weapon\n2. Alibi Letter\n3. Blood Stain",
                ),
            ],
        ),
    ]

    return AvailableVariablesResponse(categories=categories)
