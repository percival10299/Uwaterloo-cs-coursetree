from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from database import get_db, engine
from services import build_prereq_tree
import models

# This creates tables if they don't exist (safe to keep)
models.Base.metadata.create_all(bind=engine)

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # For debugging, allow everything temporarily
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def health_check():
    return {"status": "Course Planning Intelligence Engine is Online!"}

@app.get("/api/tree/{course_code}")
def get_course_tree(course_code: str, db: Session = Depends(get_db)):
    clean_code = course_code.replace(" ", "").lower()  # ← change upper() to lower()
    tree = build_prereq_tree(db, clean_code)
    if not tree:
        raise HTTPException(status_code=404, detail=f"Course {course_code} not found")
    return tree