from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import declarative_base, sessionmaker

from .config import settings

engine = create_engine(settings.database_url, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def ensure_schema() -> None:
    inspector = inspect(engine)
    if "productions" not in inspector.get_table_names():
        return
    existing = {col["name"] for col in inspector.get_columns("productions")}
    statements = []
    if "deleted_at" not in existing:
        statements.append("ALTER TABLE productions ADD COLUMN deleted_at TIMESTAMP NULL")
    if "exported_at" not in existing:
        statements.append("ALTER TABLE productions ADD COLUMN exported_at TIMESTAMP NULL")
    if "exported_pg_id" not in existing:
        statements.append("ALTER TABLE productions ADD COLUMN exported_pg_id BIGINT NULL")
    if not statements:
        return
    with engine.begin() as conn:
        for stmt in statements:
            conn.execute(text(stmt))
