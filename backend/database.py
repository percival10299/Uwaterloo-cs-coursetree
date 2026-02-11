from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import os
import time
from sqlalchemy.exc import OperationalError

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://user:password@db:5432/course_planner")

# Retry logic to wait for Postgres to be ready
engine = create_engine(DATABASE_URL)
while True:
    try:
        engine.connect()
        print("Connected to PostgreSQL successfully!")
        break
    except OperationalError:
        print("Database not ready yet, retrying in 2 seconds...")
        time.sleep(2)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()