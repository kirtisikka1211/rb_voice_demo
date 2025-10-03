from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
import os
from dotenv import load_dotenv

load_dotenv()

# Example local connection string (override with env)
# Adjust username, password, host, port, dbname if not using env
# DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:password@localhost:5432/rbvoice_new")
DATABASE_URL = "postgresql://postgres:kirtisikkarbVoice@db.ceywatgfpiyfdhrqfbip.supabase.co:5432/postgres"

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

# Dependency for FastAPI routes
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
