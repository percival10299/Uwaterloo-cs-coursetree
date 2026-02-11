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
        print(f"Warning: Could not clear table: {e}")
        db.rollback()

    # 2. Resolve Path
    base_dir = os.path.dirname(os.path.abspath(__file__))
    json_path = os.path.join(base_dir, "courses_parsed.json")

    # 3. Import Data
    try:
        print(f"Looking for data at: {json_path}")
        with open(json_path, "r") as f:
            data = json.load(f)
            
        print(f"Found {len(data)} courses. Starting import...")
        
        for item in data:
            raw_code = item.get("code")
            if not raw_code: continue 
            
            course = Course(
                code=raw_code.upper(),
                name=item.get("name"),
                description=item.get("description", ""),
                prerequisites=item.get("prereqs", {}),
                postrequisites=item.get("postrequisites", [])
            )
            db.add(course)
        
        db.commit()
        print(f"Success! Database is now populated.")
        
    except FileNotFoundError:
        print(f"CRITICAL: Could not find {json_path}")
        exit(1)
    except Exception as e:
        print(f"Error: {e}")
        db.rollback()
        exit(1)
    finally:
        db.close()

if __name__ == "__main__":
    seed_data()