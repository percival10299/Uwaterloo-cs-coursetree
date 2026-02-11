import json
import os
from sqlalchemy.orm import Session
from database import SessionLocal, engine
from models import Base, Course

# Create tables if they don't exist
Base.metadata.create_all(bind=engine)

def seed_data():
    db = SessionLocal()
    
    # 1. Clear existing data
    try:
        deleted = db.query(Course).delete()
        db.commit()
        print(f"Cleared {deleted} old courses from the database.")
    except Exception as e:
        print(f"Warning: Could not clear table (might not exist yet): {e}")
        db.rollback()

    # 2. Load the JSON data using a ROBUST path
    # This finds the directory where seed.py lives, then looks for the json file there.
    base_dir = os.path.dirname(os.path.abspath(__file__))
    json_path = os.path.join(base_dir, "courses_parsed.json")

    try:
        print(f"Looking for data at: {json_path}")
        with open(json_path, "r") as f:
            data = json.load(f)
            
        print(f"Found {len(data)} courses in JSON. Starting import...")
        
        count = 0
        for item in data:
            raw_code = item.get("code")
            if not raw_code:
                continue 
            
            # Map JSON to DB
            course = Course(
                code=raw_code.upper(),
                name=item.get("name"),
                description=item.get("description", ""),
                prerequisites=item.get("prereqs", {}) 
            )
            
            db.add(course)
            count += 1
        
        db.commit()
        print(f"Success! Imported {count} courses.")
        
    except FileNotFoundError:
        print(f"CRITICAL ERROR: Could not find file at {json_path}")
        exit(1) # Force the CI pipeline to fail if file is missing
    except Exception as e:
        print(f"Error: {e}")
        db.rollback()
        exit(1)
    finally:
        db.close()

if __name__ == "__main__":
    seed_data()