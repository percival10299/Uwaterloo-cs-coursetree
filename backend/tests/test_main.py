from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from main import app
from database import get_db, Base
from models import Course  # Import your SQLAlchemy model to insert fake data
from sqlalchemy.pool import StaticPool

# 1. Setup the Mock Database (SQLite in memory)
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, 
    connect_args={"check_same_thread": False},
    poolclass=StaticPool  # <--- THIS IS THE FIX
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Create the tables in the mock database
Base.metadata.create_all(bind=engine)

# 2. Define the Override Function
def override_get_db():
    try:
        db = TestingSessionLocal()
        yield db
    finally:
        db.close()

# 3. Apply the Override to the FastAPI app
app.dependency_overrides[get_db] = override_get_db

# 4. Create the TestClient AFTER applying overrides
client = TestClient(app)

def test_resolve_cs240():
    """Test that resolving CS240 returns the correct structure."""
    
    # 5. Insert Fake Data into the Mock Database before requesting it
    # 5. Insert Fake Data into the Mock Database before requesting it
    db = TestingSessionLocal()
    
    fake_course = Course(
        code="CS240",
        name="Data Structures and Data Management",
        prerequisites={"all": [{"one_of": ["CS246", "CS246E"]}, {"one_of": ["STAT230", "STAT240"]}, {"one_of": ["MATH239", "MATH249"]}]}
    )
    
    db.add(fake_course)
    db.commit()
    db.close()
    # 6. ACT
    response = client.get("/resolve/CS240")
    
    # 7. ASSERT
    assert response.status_code == 200
    data = response.json()
    
    assert data["course"] == "CS240"
    logic = data["prerequisites_logic"]
    assert "all" in logic
    assert len(logic["all"]) >= 3