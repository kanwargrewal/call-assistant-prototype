import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// Create axios instance
const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Types
export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
}

export interface User {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  role: 'admin' | 'business_owner';
  is_active: boolean;
  created_at: string;
}

export interface Business {
  id: number;
  name: string;
  description?: string;
  owner_phone: string;
  owner_id: number;
  is_active: boolean;
  created_at: string;
  owner: User;
}

export interface PhoneNumber {
  id: number;
  phone_number: string;
  twilio_sid: string;
  area_code: string;
  country: string;
  business_id: number;
  status: 'active' | 'inactive' | 'suspended';
  monthly_cost: number;
  locality?: string;
  region?: string;
  created_at: string;
}

export interface Call {
  id: number;
  twilio_call_sid: string;
  business_id: number;
  phone_number_id: number;
  caller_number: string;
  call_type: 'human' | 'ai';
  status: 'ringing' | 'in_progress' | 'completed' | 'failed' | 'no_answer';
  start_time: string;
  end_time?: string;
  duration_seconds?: number;
  call_summary?: string;
  recording_url?: string;
  cost?: number;
}

export interface ApiConfiguration {
  id: number;
  business_id: number;
  openai_api_key: string;
  custom_instructions?: string;
  is_active: boolean;
  created_at: string;
}

export interface Settings {
  id: number;
  business_id: number;
  dashboard_layout: 'grid' | 'list' | 'compact';
  theme: 'light' | 'dark' | 'auto';
  dashboard_refresh_interval: number;
  call_recording_enabled: boolean;
  call_forwarding_timeout: number;
  ai_takeover_delay: number;
  email_notifications: boolean;
  sms_notifications: boolean;
  notification_email?: string;
  notification_phone?: string;
  business_hours?: string;
  timezone: string;
  custom_greeting?: string;
  holiday_message?: string;
  after_hours_message?: string;
  webhook_url?: string;
  webhook_secret?: string;
  is_active: boolean;
  created_at: string;
}

export interface DashboardData {
  call_summary: {
    total_calls: number;
    human_calls: number;
    ai_calls: number;
    average_duration: number;
    total_cost: number;
  };
  recent_calls: Call[];
  business: Business;
}

// Auth API
export const authAPI = {
  login: async (data: LoginRequest) => {
    const response = await api.post('/api/auth/login-json', data);
    return response.data;
  },

  register: async (data: RegisterRequest, inviteToken?: string) => {
    const url = inviteToken ? `/api/auth/register?invite_token=${inviteToken}` : '/api/auth/register';
    const response = await api.post(url, data);
    return response.data;
  },

  getMe: async (): Promise<User> => {
    const response = await api.get('/api/auth/me');
    return response.data;
  },
};

// Business API
export const businessAPI = {
  create: async (data: { name: string; description?: string; owner_phone: string }) => {
    const response = await api.post('/api/me/business', data);
    return response.data;
  },

  getMy: async (businessId?: number): Promise<Business> => {
    const params = businessId ? { business_id: businessId } : {};
    const response = await api.get('/api/me/business', { params });
    return response.data;
  },

  update: async (id: number, data: Partial<Business>, businessId?: number) => {
    const params = businessId ? { business_id: businessId } : {};
    const response = await api.put('/api/me/business', data, { params });
    return response.data;
  },

  getDashboard: async (businessId?: number): Promise<DashboardData> => {
    const params = businessId ? { business_id: businessId } : {};
    const response = await api.get('/api/me/dashboard', { params });
    return response.data;
  },

  list: async (): Promise<Business[]> => {
    const response = await api.get('/api/businesses/');
    return response.data;
  },

  // Admin-specific: List all businesses
  listAll: async (): Promise<Business[]> => {
    const response = await api.get('/api/me/businesses');
    return response.data;
  },
};

// Phone Numbers API
export const phoneAPI = {
  search: async (areaCode: string, country: string = 'US') => {
    const response = await api.get(`/api/phone-numbers/search?area_code=${areaCode}&country=${country}`);
    return response.data;
  },

  purchase: async (phoneNumber: string, areaCode: string, country: string) => {
    const response = await api.post(`/api/me/phone-numbers?phone_number=${encodeURIComponent(phoneNumber)}&area_code=${areaCode}&country=${country}`);
    return response.data;
  },

  list: async (businessId?: number): Promise<PhoneNumber[]> => {
    const params = businessId ? { business_id: businessId } : {};
    const response = await api.get('/api/me/phone-numbers', { params });
    return response.data;
  },

  release: async (id: number) => {
    const response = await api.delete(`/api/me/phone-numbers/${id}`);
    return response.data;
  },
};

// Admin API
export const adminAPI = {
  inviteUser: async (email: string, role: string = 'business_owner') => {
    const response = await api.post('/api/admin/invite', null, {
      params: { email, role }
    });
    return response.data;
  },

  getInvites: async () => {
    const response = await api.get('/api/admin/invites');
    return response.data;
  },

  cancelInvite: async (inviteId: number) => {
    const response = await api.delete(`/api/admin/invites/${inviteId}`);
    return response.data;
  },

  getStatistics: async () => {
    const response = await api.get('/api/admin/statistics');
    return response.data;
  },

  validateInvite: async (token: string) => {
    const response = await api.get(`/api/admin/validate-invite/${token}`);
    return response.data;
  },
};

// API Configuration API
export const apiConfigAPI = {
  create: async (data: { openai_api_key: string; custom_instructions?: string }, businessId?: number): Promise<ApiConfiguration> => {
    const params = businessId ? { business_id: businessId } : {};
    const response = await api.post('/api/me/config', data, { params });
    return response.data;
  },

  getMy: async (businessId?: number): Promise<ApiConfiguration> => {
    const params = businessId ? { business_id: businessId } : {};
    const response = await api.get('/api/me/config', { params });
    return response.data;
  },

  update: async (data: { openai_api_key?: string; custom_instructions?: string }, businessId?: number): Promise<ApiConfiguration> => {
    const params = businessId ? { business_id: businessId } : {};
    const response = await api.put('/api/me/config', data, { params });
    return response.data;
  },
};

// Settings API
export const settingsAPI = {
  create: async (data: Partial<Settings>, businessId?: number): Promise<Settings> => {
    const params = businessId ? { business_id: businessId } : {};
    const response = await api.post('/api/me/settings', data, { params });
    return response.data;
  },

  getMy: async (businessId?: number): Promise<Settings> => {
    const params = businessId ? { business_id: businessId } : {};
    const response = await api.get('/api/me/settings', { params });
    return response.data;
  },

  update: async (data: Partial<Settings>, businessId?: number): Promise<Settings> => {
    const params = businessId ? { business_id: businessId } : {};
    const response = await api.put('/api/me/settings', data, { params });
    return response.data;
  },
};

export default api; 