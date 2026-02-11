import axios from 'axios';

const API_URL = 'http://localhost:8001';

export const resolveCourse = async (code) => {
  try {
    const response = await axios.get(`${API_URL}/resolve/${code}`);
    return response.data;
  } catch (error) {
    console.error("Error fetching course:", error);
    return null;
  }
};