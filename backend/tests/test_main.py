from fastapi.testclient import TestClient
from main import app  # Import your FastAPI instance

client = TestClient(app)

def test_get_prerequisites():
    # Replace 'CS136' with a valid course code from your DB
    response = client.get("/courses/CS136/prerequisites")
    assert response.status_code == 200
    assert "CS135" in response.json()["prereqs"]  # Example logic check
