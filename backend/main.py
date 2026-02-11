from fastapi import FastAPI, Depends, HTTPException
from sqlalchemy.orm import Session
import models
import database

# Initialize the database tables
models.Base.metadata.create_all(bind=database.engine)

app = FastAPI()

# Dependency to get the database session
def get_db():
    db = database.SessionLocal()
    try:
        yield db
    finally:
        db.close()

@app.get("/")
def read_root():
    return {"message": "Course Planning Intelligence Engine is Online!"}

@app.get("/courses")
def get_courses(db: Session = Depends(get_db)):
    """Fetch all available courses."""
    return db.query(models.Course).all()

from sqlalchemy import func

@app.get("/resolve/{course_code}")
def resolve_prerequisites(course_code: str, db: Session = Depends(get_db)):
    """
    Smart Resolution:
    1. Removes spaces from input (e.g., "CS 240" -> "CS240")
    2. Removes spaces from database column for comparison
    3. Ignores case (e.g., "cs240" matches "CS 240")
    """
    # Normalize input: remove spaces and uppercase
    clean_code = course_code.replace(" ", "").upper()
    
    # Query: Normalize database column on the fly to match input
    course = db.query(models.Course).filter(
        func.replace(models.Course.code, " ", "").ilike(clean_code)
    ).first()

    if not course:
        raise HTTPException(status_code=404, detail=f"Course '{course_code}' not found. Try checking /courses for exact code.")

    return {
        "course": course.code,
        "title": course.name,
        "prerequisites_logic": course.prerequisites, 
        "is_recursive_ready": True 
    }