# LARP Admin Backend

Admin backend API for managing clues, NPCs, and matching algorithms for an AI-powered murder mystery game.

## Features

- **Script Management**: Create, update, and manage murder mystery scripts
- **Scene Management**: Organize scripts into scenes/chapters
- **NPC Management**: Define characters with personalities, backgrounds, and LLM prompts
- **Clue Management**: Create clues with complex unlock conditions
- **Clue Tree**: Visualize and validate clue dependency relationships
- **Algorithm Strategies**: Configure and switch matching algorithms
- **Dialogue Simulation**: Test clue matching with simulated player messages

## Tech Stack

- **Python 3.11+**
- **FastAPI** - Modern async web framework
- **SQLAlchemy 2.0** - Async ORM with PostgreSQL
- **Pydantic v2** - Data validation
- **Alembic** - Database migrations
- **PostgreSQL** - Database with JSONB support

## Project Structure

```
backend/
├── app/
│   ├── __init__.py
│   ├── main.py          # FastAPI application
│   ├── config.py        # Application settings
│   ├── database.py      # Database configuration
│   ├── models/          # SQLAlchemy models
│   │   ├── script.py
│   │   ├── scene.py
│   │   ├── npc.py
│   │   ├── clue.py
│   │   ├── algorithm.py
│   │   └── log.py
│   ├── schemas/         # Pydantic schemas
│   │   ├── script.py
│   │   ├── scene.py
│   │   ├── npc.py
│   │   ├── clue.py
│   │   ├── algorithm.py
│   │   └── simulate.py
│   ├── api/             # API routes
│   │   ├── scripts.py
│   │   ├── scenes.py
│   │   ├── npcs.py
│   │   ├── clues.py
│   │   ├── algorithms.py
│   │   ├── simulate.py
│   │   └── logs.py
│   └── services/        # Business logic
│       ├── clue_tree.py
│       └── matching.py
├── alembic/             # Database migrations
├── requirements.txt
├── pyproject.toml
└── alembic.ini
```

## Setup

### Prerequisites

- Python 3.11+
- PostgreSQL 14+

### Installation

1. Create a virtual environment:
```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

2. Install dependencies:
```bash
pip install -r requirements.txt
```

3. Configure environment:
```bash
cp .env.example .env
# Edit .env with your database credentials
```

4. Create the database:
```bash
createdb larp_admin
```

5. Run migrations:
```bash
alembic upgrade head
```

6. Start the server:
```bash
uvicorn app.main:app --reload
```

The API will be available at http://localhost:8000

## API Documentation

Once running, visit:
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## API Endpoints

### Scripts
- `GET /api/scripts` - List scripts (paginated)
- `POST /api/scripts` - Create script
- `GET /api/scripts/{id}` - Get script
- `PUT /api/scripts/{id}` - Update script
- `DELETE /api/scripts/{id}` - Soft delete script
- `POST /api/scripts/{id}/copy` - Copy script

### Scenes
- `GET /api/scripts/{script_id}/scenes` - List scenes
- `POST /api/scripts/{script_id}/scenes` - Create scene
- `PUT /api/scenes/{id}` - Update scene
- `DELETE /api/scenes/{id}` - Delete scene
- `PUT /api/scripts/{script_id}/scenes/reorder` - Reorder scenes

### NPCs
- `GET /api/npcs` - List NPCs (paginated)
- `POST /api/npcs` - Create NPC
- `GET /api/npcs/{id}` - Get NPC
- `PUT /api/npcs/{id}` - Update NPC
- `DELETE /api/npcs/{id}` - Delete NPC

### Clues
- `GET /api/clues` - List clues (paginated)
- `POST /api/clues` - Create clue
- `GET /api/clues/{id}` - Get clue
- `PUT /api/clues/{id}` - Update clue
- `DELETE /api/clues/{id}` - Delete clue
- `GET /api/clues/{id}/history` - Get version history

### Clue Tree
- `GET /api/scripts/{script_id}/clue-tree` - Get clue tree
- `GET /api/scripts/{script_id}/clue-tree/validate` - Validate tree
- `POST /api/clue-relations` - Create relation
- `DELETE /api/clue-relations/{id}` - Delete relation

### Algorithms
- `GET /api/algorithms` - List implementations (read-only)
- `GET /api/strategies` - List strategies
- `POST /api/strategies` - Create strategy
- `GET /api/strategies/{id}` - Get strategy
- `PUT /api/strategies/{id}` - Update strategy
- `DELETE /api/strategies/{id}` - Delete strategy
- `PUT /api/strategies/{id}/publish` - Publish strategy
- `GET /api/global-config` - Get global config
- `PUT /api/global-config` - Update global config

### Simulation
- `POST /api/simulate` - Simulate dialogue matching

### Logs
- `GET /api/logs` - Get dialogue logs (paginated)

## Development

### Running Tests
```bash
pytest
```

### Linting
```bash
ruff check .
```

### Type Checking
```bash
mypy app
```

### Creating Migrations
```bash
alembic revision --autogenerate -m "description"
```

## License

MIT
