import json
from sqlalchemy.orm import Session
from database import SessionLocal, engine
from models import Base, Course

# Create tables if they don't exist
Base.metadata.create_all(bind=engine)

def seed_data():
    db = SessionLocal()
    
    # 1. Clear existing data so we don't have duplicates or empty rows
    deleted = db.query(Course).delete()
    db.commit()
    print(f"Cleared {deleted} old courses from the database.")

    # 2. Load the JSON data
    try:
        with open("courses_parsed.json", "r") as f:
            data = json.load(f)
            
        print(f"Found {len(data)} courses in JSON. Starting import...")
        
        count = 0
        for item in data:
            # 3. Handle the specific structure: "code": "cs240"
            raw_code = item.get("code")
            if not raw_code:
                continue 
            
            # 4. Map the JSON keys to our Database Columns
            # KEY FIX: "prereqs" (JSON) -> "prerequisites" (Database)
            course = Course(
                code=raw_code.upper(), # Store as "CS240"
                name=item.get("name"),
                description=item.get("description", ""),
                prerequisites=item.get("prereqs", {}) # Store the logic tree
            )
            
            db.add(course)
            count += 1
        
        db.commit()
        print(f"Success! Imported {count} courses with full prerequisite trees.")
        
    except Exception as e:
        print(f"Error: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    seed_data()