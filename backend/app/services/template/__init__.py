"""
Template Rendering Module

This module provides template rendering capabilities for prompt templates:
- Variable substitution with jsonpath-style access
- List formatting (numbered, comma, bullet, dash, newline)
- Variable extraction and validation

Usage:
    from app.services.template import template_renderer, TemplateRenderer

    # Use singleton
    result = template_renderer.render(template, context)

    # Or create instance
    renderer = TemplateRenderer()
    result = renderer.render(template, context)
"""

from .formatters import format_list, format_value
from .renderer import TemplateRenderer, template_renderer
from .variables import get_available_variables

__all__ = [
    # Main class and singleton
    "TemplateRenderer",
    "template_renderer",
    # Utilities
    "format_value",
    "format_list",
    "get_available_variables",
]
