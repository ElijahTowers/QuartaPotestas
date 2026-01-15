# Quarta Potestas

A local-first, satirical newspaper simulation game that uses real-time RSS feeds to generate gameplay content via a local LLM (Ollama).

## Tech Stack

- **Backend**: Python 3.11+, FastAPI, SQLAlchemy (Async), Alembic
- **Database**: PostgreSQL (Docker)
- **Scheduler**: APScheduler
- **AI/LLM**: Ollama (local)
- **Frontend**: Next.js (App Router), Tailwind CSS, Framer Motion, Leaflet

## Setup

### Database

Start PostgreSQL with Docker Compose:

```bash
docker-compose up -d
```

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload
```

## Project Structure

```
.
├── backend/
│   ├── app/
│   │   ├── models/
│   │   ├── api/
│   │   ├── services/
│   │   ├── database.py
│   │   └── main.py
│   ├── alembic/
│   └── requirements.txt
├── frontend/
└── docker-compose.yml
```

