import axios from 'axios';

// CRITICAL: This must match the port in docker-compose.yml (8001)
const API_URL = 'http://localhost:8001';

export const resolveCourse = async (code) => {
  try {
    console.log(`Fetching ${code} from ${API_URL}...`); // Debug log
    const response = await axios.get(`${API_URL}/resolve/${code}`);
    return response.data;
  } catch (error) {
    console.error("API Error:", error);
    return null;
  }
};