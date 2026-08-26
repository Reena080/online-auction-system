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
    getAll: (params = {}) => {
      const query = new URLSearchParams();
      if (params.status) query.append('status', params.status);
      if (params.search) query.append('search', params.search);
      const qs = query.toString();
      return request(`/auctions${qs ? `?${qs}` : ''}`);
    },
    get: (auctionId) => request(auctionId ? `/auctions/${auctionId}` : '/auctions'),
    getStatus: (auctionId) => request(auctionId ? `/auctions/${auctionId}/status` : '/auctions/status'),
    getResult: (auctionId) => request(`/auctions/${auctionId}/result`),
    placeBid: (auctionId, amount) => request(`/auctions/${auctionId}/bid`, {
      method: 'POST',
      body: JSON.stringify({ amount })
    }),
    getBids: (auctionId, page = 1, limit = 20) => request(`/auctions/${auctionId}/bids?page=${page}&limit=${limit}`),
    reset: () => request('/auctions/reset', { method: 'POST' })
  }
};
