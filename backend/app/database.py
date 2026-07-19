import os

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from .models import Base

# Overridable for tests and production deploys (e.g. postgres in the cloud).
DATABASE_URL = os.environ.get("MALSCAN_DB_URL", "sqlite:///./malscan.db")

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def init_db():
    Base.metadata.create_all(bind=engine)
    # create_all does not ALTER an existing table, so ensure the status index
    # exists on pre-existing scan_jobs tables too. Idempotent and harmless.
    try:
        with engine.connect() as conn:
            conn.exec_driver_sql(
                "CREATE INDEX IF NOT EXISTS ix_scan_jobs_status ON scan_jobs (status)"
            )
            conn.commit()
    except Exception:
        pass