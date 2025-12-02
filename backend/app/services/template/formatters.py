"""Value and list formatting utilities for templates."""

from dataclasses import asdict
from typing import Any


def format_value(value: Any, list_format: str | None = None) -> str:
    """
    Format a value for template output.

    Args:
        value: Value to format (can be primitive, dict, list).
        list_format: For lists, the format type (list/comma/bullet/dash/newline).

    Returns:
        Formatted string representation.
    """
    if value is None:
        return ""

    if isinstance(value, list):
        return format_list(value, list_format or "list")

    if isinstance(value, dict):
        # For dict, try to format nicely
        items = [f"{k}: {v}" for k, v in value.items() if v is not None]
        return ", ".join(items) if items else ""

    if hasattr(value, "__dataclass_fields__"):
        # Handle dataclass objects
        return format_value(asdict(value), list_format)

    return str(value)


def format_list(items: list, format_type: str) -> str:
    """
    Format a list according to the specified format type.

    Args:
        items: List of items to format.
        format_type: One of 'list', 'comma', 'bullet', 'dash', 'newline'.

    Returns:
        Formatted string.

    Format types:
    - list: Numbered list (default) "1. item1\\n2. item2"
    - comma: Comma-separated "item1, item2, item3"
    - bullet: Bullet points "• item1\\n• item2"
    - dash: Dashed list "- item1\\n- item2"
    - newline: Newline-separated "item1\\nitem2"
    """
    if not items:
        return ""

    # Convert items to strings
    str_items = [str(item) for item in items if item is not None]

    if not str_items:
        return ""

    if format_type == "comma":
        return ", ".join(str_items)
    elif format_type == "bullet":
        return "\n".join(f"• {item}" for item in str_items)
    elif format_type == "dash":
        return "\n".join(f"- {item}" for item in str_items)
    elif format_type == "newline":
        return "\n".join(str_items)
    else:  # default: numbered list
        return "\n".join(f"{i + 1}. {item}" for i, item in enumerate(str_items))
