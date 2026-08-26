const API_BASE_URL = '/api';

async function request(endpoint, options = {}) {
  const token = localStorage.getItem('bellcorp_auction_token');
  
  const headers = {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
    ...options.headers
  };

  const config = {
    ...options,
    headers
  };

  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, config);
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      const error = new Error(data.message || 'An error occurred with the request.');
      error.status = response.status;
      error.errorCode = data.error || 'SERVER_ERROR';
      error.details = data.details || null;
      throw error;
    }

    return data;
  } catch (error) {
    if (error.status) throw error;
    const networkError = new Error('Unable to connect to server. Please check your network connection.');
    networkError.status = 503;
    networkError.errorCode = 'NETWORK_ERROR';
    throw networkError;
  }
}

export const api = {
  auth: {
    register: (userData) => request('/auth/register', {
      method: 'POST',
      body: JSON.stringify(userData)
    }),
    login: (credentials) => request('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials)
    }),
    getMe: () => request('/auth/me')
  },

  auction: {
    get: (auctionId) => request(auctionId ? `/auction/${auctionId}` : '/auction'),
    getStatus: (auctionId) => request(auctionId ? `/auction/${auctionId}/status` : '/auction/status'),
    placeBid: (auctionId, amount) => request(`/auction/${auctionId}/bids`, {
      method: 'POST',
      body: JSON.stringify({ amount })
    }),
    getBids: (auctionId, page = 1, limit = 20) => request(`/auction/${auctionId}/bids?page=${page}&limit=${limit}`)
  }
};
