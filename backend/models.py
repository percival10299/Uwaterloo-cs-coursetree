from sqlalchemy import Column, Integer, String, ForeignKey, JSON
from sqlalchemy.orm import relationship
from database import Base

class Course(Base):
    __tablename__ = "courses"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String, unique=True, index=True)  # e.g., "CS 341"
    name = Column(String)                           # e.g., "Algorithms"
    description = Column(String)
    
    # We use JSON for prerequisites because logic like "(CS136 or CS146) AND MATH135" 
    # is extremely hard to model in pure relational rows without massive complexity.
    # Storing the logic tree in JSONB is the industry standard for this.
    prerequisites = Column(JSON)