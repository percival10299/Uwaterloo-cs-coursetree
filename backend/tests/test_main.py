from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

def test_read_root():
    """Test the root endpoint returns 200 and welcome message."""
    response = client.get("/")
    assert response.status_code == 200
    assert response.json() == {"message": "Course Planning Intelligence Engine is Online!"}

def test_resolve_cs240():
    """Test that resolving CS240 returns the correct structure."""
    response = client.get("/resolve/CS240")
    assert response.status_code == 200
    data = response.json()
    
    # Verify we got the right course
    assert data["course"] == "CS240"
    
    # Verify the graph logic exists (the "one_of" we saw earlier)
    logic = data["prerequisites_logic"]
    assert "all" in logic
    assert len(logic["all"]) >= 3  # CS240 has 3 main requirements groups