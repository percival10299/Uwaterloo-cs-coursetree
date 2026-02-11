from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware # <--- 1. IMPORT THIS
from sqlalchemy.orm import Session
from sqlalchemy import func, text
import models
import database

# Initialize database
models.Base.metadata.create_all(bind=database.engine)

app = FastAPI()

# <--- 2. ADD THIS BLOCK --->
# Allow the frontend (running on localhost:3000) to talk to this API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # For development, allow all origins. In production, change to ["http://localhost:3000"]
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
# <------------------------->

# Dependency
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
    # ... (keep the existing cleanup logic) ...
    clean_code = course_code.replace(" ", "").upper()
    
    course = db.query(models.Course).filter(
        func.replace(models.Course.code, " ", "").ilike(clean_code)
    ).first()

    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    return {
        "course": course.code,
        "title": course.name,
        "description": course.description,
        "prerequisites_logic": course.prerequisites, 
        "postrequisites": course.postrequisites,  # <--- ADD THIS LINE
        "is_recursive_ready": True 
    }