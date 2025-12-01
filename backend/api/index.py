"""Vercel serverless entry point."""

from app.main import app

# Vercel requires the app to be named 'app' or 'handler'
handler = app
