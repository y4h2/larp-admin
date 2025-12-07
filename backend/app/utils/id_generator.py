"""Prefixed NanoID generator for human-readable IDs."""

from enum import Enum
from nanoid import generate

# Use URL-safe alphabet without ambiguous characters (0/O, 1/l/I)
ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz"
DEFAULT_SIZE = 12  # 12 chars gives ~10^21 combinations, plenty for our use case


class IDPrefix(str, Enum):
    """ID prefixes for different entity types."""

    SCRIPT = "scr"
    NPC = "npc"
    CLUE = "clu"
    PROMPT_TEMPLATE = "tpl"
    LLM_CONFIG = "llm"
    DIALOGUE_LOG = "dlg"
    USER = "usr"


def generate_id(prefix: IDPrefix, size: int = DEFAULT_SIZE) -> str:
    """
    Generate a prefixed NanoID.

    Args:
        prefix: The entity type prefix
        size: Length of the random part (default 12)

    Returns:
        A prefixed ID like 'scr_K4x8JqNm2Fpw'
    """
    random_part = generate(ALPHABET, size)
    return f"{prefix.value}_{random_part}"


def generate_script_id() -> str:
    """Generate a Script ID."""
    return generate_id(IDPrefix.SCRIPT)


def generate_npc_id() -> str:
    """Generate an NPC ID."""
    return generate_id(IDPrefix.NPC)


def generate_clue_id() -> str:
    """Generate a Clue ID."""
    return generate_id(IDPrefix.CLUE)


def generate_template_id() -> str:
    """Generate a PromptTemplate ID."""
    return generate_id(IDPrefix.PROMPT_TEMPLATE)


def generate_llm_config_id() -> str:
    """Generate an LLMConfig ID."""
    return generate_id(IDPrefix.LLM_CONFIG)


def generate_dialogue_log_id() -> str:
    """Generate a DialogueLog ID."""
    return generate_id(IDPrefix.DIALOGUE_LOG)


def generate_user_id() -> str:
    """Generate a User ID."""
    return generate_id(IDPrefix.USER)
