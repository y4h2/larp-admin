# LARP Admin - AI Murder Mystery Game Management Backend

A management dashboard for single-player AI murder mystery games. Allows designers/writers to manage clues, NPCs, and matching algorithms through a visual interface.

## Features

- **Script & Scene Management** - Create and organize game scripts with scenes
- **NPC Management** - Define characters with personalities, backstories, and LLM prompts
- **Clue Management** - Visual clue editor with complex unlock conditions
- **Clue Tree Visualization** - Interactive DAG view of clue dependencies
- **Algorithm Strategy Management** - Configure and switch matching algorithms
- **Dialogue Simulation** - Test clue matching in real-time
- **Experiment & Evaluation** - A/B testing and offline evaluation tools

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 19, TypeScript, Ant Design 5, React Flow |
| Backend | Python 3.11+, FastAPI, SQLAlchemy, Pydantic |
| Database | PostgreSQL 16 |
| Infrastructure | Docker Compose |

## Quick Start

### 1. Start PostgreSQL

```bash
cd infra
docker-compose up -d
```

### 2. Setup Backend

```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env

# Run database migrations
alembic upgrade head

# Start server
uvicorn app.main:app --reload
```

Backend API available at:
- API: http://localhost:8000
- Swagger Docs: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

### 3. Setup Frontend

```bash
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev
```

Frontend available at: http://localhost:5173

## Project Structure

```
larp-admin/
├── frontend/                 # React admin dashboard
│   ├── src/
│   │   ├── api/              # API client modules
│   │   ├── components/       # Reusable components
│   │   ├── pages/            # Page components
│   │   ├── hooks/            # Custom React hooks
│   │   ├── store/            # Zustand state management
│   │   └── types/            # TypeScript interfaces
│   └── package.json
├── backend/                  # FastAPI server
│   ├── app/
│   │   ├── api/              # Route handlers
│   │   ├── models/           # SQLAlchemy models
│   │   ├── schemas/          # Pydantic schemas
│   │   └── services/         # Business logic
│   ├── alembic/              # Database migrations
│   └── requirements.txt
├── infra/                    # Infrastructure
│   └── docker-compose.yml    # PostgreSQL setup
└── spec/                     # Documentation
    └── idea.md               # PRD document
```

## Configuration

### Backend Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql+asyncpg://postgres:postgres@localhost:5432/larp_admin` |
| `DEBUG` | Enable debug mode | `false` |
| `CORS_ORIGINS` | Allowed CORS origins | `["http://localhost:3000", "http://localhost:5173"]` |

### Frontend Environment Variables

Create `frontend/.env.local` if needed:

```env
VITE_API_BASE_URL=http://localhost:8000
```

## API Endpoints

### Scripts
- `GET /api/scripts` - List scripts
- `POST /api/scripts` - Create script
- `GET /api/scripts/{id}` - Get script
- `PUT /api/scripts/{id}` - Update script
- `DELETE /api/scripts/{id}` - Delete script
- `POST /api/scripts/{id}/copy` - Copy script

### NPCs
- `GET /api/npcs` - List NPCs
- `POST /api/npcs` - Create NPC
- `GET /api/npcs/{id}` - Get NPC
- `PUT /api/npcs/{id}` - Update NPC
- `DELETE /api/npcs/{id}` - Delete NPC

### Clues
- `GET /api/clues` - List clues
- `POST /api/clues` - Create clue
- `GET /api/clues/{id}` - Get clue
- `PUT /api/clues/{id}` - Update clue
- `DELETE /api/clues/{id}` - Delete clue
- `GET /api/scripts/{id}/clue-tree` - Get clue tree
- `GET /api/scripts/{id}/clue-tree/validate` - Validate clue tree

### Algorithms
- `GET /api/algorithms` - List algorithm implementations
- `GET /api/strategies` - List strategies
- `POST /api/strategies` - Create strategy
- `PUT /api/strategies/{id}` - Update strategy
- `POST /api/simulate` - Run dialogue simulation

## Development

### Running Tests

```bash
cd backend
pytest
```

### Database Migrations

```bash
cd backend

# Create new migration
alembic revision --autogenerate -m "description"

# Apply migrations
alembic upgrade head

# Rollback one version
alembic downgrade -1
```

### Building for Production

```bash
# Frontend
cd frontend
npm run build

# Output in frontend/dist/
```

## License

Private - Internal Use Only
