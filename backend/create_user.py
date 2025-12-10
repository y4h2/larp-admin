"""Script to create a new user."""

import argparse
import asyncio

from app.database import async_session_maker
from app.services.auth import create_user, get_user_by_email


async def main(email: str, password: str):
    async with async_session_maker() as session:
        existing = await get_user_by_email(session, email)
        if existing:
            print(f"User {email} already exists")
            return

        user = await create_user(session, email, password)
        await session.commit()
        print(f"Created user: {user.email}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Create a new user")
    parser.add_argument("email", help="User email")
    parser.add_argument("password", help="User password")
    args = parser.parse_args()

    asyncio.run(main(args.email, args.password))
