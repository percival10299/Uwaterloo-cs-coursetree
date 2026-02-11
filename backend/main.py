from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware  # <--- IMPORT THIS
from sqlalchemy.orm import Session
from sqlalchemy import func, text
import models
import database

# Initialize database
models.Base.metadata.create_all(bind=database.engine)

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # This is the "handshake" your browser is looking for
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
# <-------------------------------------------->

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
    return db.query(models.Course).all()

@app.get("/resolve/{course_code}")
def resolve_prerequisites(course_code: str, db: Session = Depends(get_db)):
    # Normalize input: remove spaces and uppercase
    clean_code = course_code.replace(" ", "").upper()
    
    # Query: Normalize database column on the fly to match input
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
        "postrequisites": course.postrequisites,
        "is_recursive_ready": True 
    }