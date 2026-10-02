// The iOS Simulator can reach services running on your Mac through localhost.
export const SERVER_URL = 'http://localhost:4000';

export const fetchBackendData = async (endpoint = '/api/your-endpoint') => {
  try {
    const response = await fetch(`${SERVER_URL}${endpoint}`);
    
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('API Error:', error);
    throw error;
  }
};