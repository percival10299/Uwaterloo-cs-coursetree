from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from database import get_db
from services import build_prereq_tree  # We will create this next
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"], # Your React URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def health_check():
    return {"status": "Course Planning Intelligence Engine is Online!"}

@app.get("/api/tree/{course_code}")
def get_course_tree(course_code: str, db: Session = Depends(get_db)):
    """
    The core endpoint: Resolves a recursive tree of prerequisites.
    """
    # Normalize input for robust searching
    clean_code = course_code.replace(" ", "").upper()
    
    # Start the recursive engine
    # We pass the db session and the starting code
    tree = build_prereq_tree(db, clean_code)
    
    if not tree:
        raise HTTPException(status_code=404, detail=f"Course {course_code} not found")

    return tree