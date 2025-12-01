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

## Deployment

### VPS Deployment

#### 1. Prerequisites

- Ubuntu 20.04+ or similar Linux distribution
- Python 3.11+
- Node.js 18+
- Nginx (optional, for reverse proxy)

#### 2. Clone and Setup

```bash
# Clone repository
git clone https://github.com/y4h2/larp-admin.git
cd larp-admin

# Setup backend
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env with your database credentials and other settings
```

#### 3. Build Frontend

```bash
cd backend
./build.sh
```

This will build the frontend and copy it to `backend/static/`.

#### 4. Run with Gunicorn (Production)

```bash
pip install gunicorn

# Run with 4 workers
gunicorn app.main:app -w 4 -k uvicorn.workers.UvicornWorker -b 0.0.0.0:8001
```

#### 5. Setup Systemd Service

Create `/etc/systemd/system/larp-admin.service`:

```ini
[Unit]
Description=LARP Admin API
After=network.target

[Service]
User=www-data
Group=www-data
WorkingDirectory=/path/to/larp-admin/backend
Environment="PATH=/path/to/larp-admin/backend/venv/bin"
EnvironmentFile=/path/to/larp-admin/backend/.env
ExecStart=/path/to/larp-admin/backend/venv/bin/gunicorn app.main:app -w 4 -k uvicorn.workers.UvicornWorker -b 127.0.0.1:8001
Restart=always

[Install]
WantedBy=multi-user.target
```

Enable and start the service:

```bash
sudo systemctl daemon-reload
sudo systemctl enable larp-admin
sudo systemctl start larp-admin
```

#### 6. Nginx Reverse Proxy (Optional)

Create `/etc/nginx/sites-available/larp-admin`:

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://127.0.0.1:8001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Enable the site:

```bash
sudo ln -s /etc/nginx/sites-available/larp-admin /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

#### 7. SSL with Certbot (Optional)

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

### Docker Deployment

```bash
# Build and run with Docker Compose
cd larp-admin
docker-compose up -d --build
```

## License

Private - Internal Use Only




