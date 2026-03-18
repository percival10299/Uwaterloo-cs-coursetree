from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import os

# Your URL is fine, it defaults to the Docker network but can be overridden
# In database.py
DATABASE_URL = "postgresql://haronwang@localhost:5432/course_planner"

# create_engine is lazy; it will NOT connect immediately
engine = create_engine(DATABASE_URL)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# This is the Dependency Injection function for your FastAPI endpoints
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()