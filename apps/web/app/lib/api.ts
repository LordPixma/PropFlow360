/**
 * API Client for Browser
 * Client-side API calls with automatic auth handling
 */

const API_URL = typeof window !== 'undefined'
  ? window.ENV?.API_URL || 'http://localhost:8787'
  : 'http://localhost:8787';

class ApiError extends Error {
  constructor(public status: number, message: string, public data?: any) {
    super(message);
    this.name = 'ApiError';
  }
}

async function fetchApi<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = localStorage.getItem('auth_token');

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new ApiError(response.status, error.error || 'Request failed', error);
  }

  return response.json();
}

// Auth
export const auth = {
  login: (email: string, password: string) =>
    fetchApi<{ token: string; user: any }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  register: (data: { email: string; password: string; firstName: string; lastName: string }) =>
    fetchApi<{ token: string; user: any }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  me: () => fetchApi<{ user: any }>('/auth/me'),
};

// Properties
export const properties = {
  list: () => fetchApi<{ properties: any[] }>('/properties'),
  get: (id: string) => fetchApi<{ property: any }>(`/properties/${id}`),
  create: (data: any) => fetchApi<{ property: any }>('/properties', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  update: (id: string, data: any) => fetchApi<{ property: any }>(`/properties/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  }),
  delete: (id: string) => fetchApi<{ success: boolean }>(`/properties/${id}`, {
    method: 'DELETE',
  }),
};

// Units
export const units = {
  list: (propertyId?: string) => {
    const query = propertyId ? `?property_id=${propertyId}` : '';
    return fetchApi<{ units: any[] }>(`/units${query}`);
  },
  get: (id: string) => fetchApi<{ unit: any }>(`/units/${id}`),
  create: (data: any) => fetchApi<{ unit: any }>('/units', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  update: (id: string, data: any) => fetchApi<{ unit: any }>(`/units/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  }),
  delete: (id: string) => fetchApi<{ success: boolean }>(`/units/${id}`, {
    method: 'DELETE',
  }),
};

// Bookings
export const bookings = {
  list: (params?: any) => {
    const query = new URLSearchParams(params).toString();
    return fetchApi<{ bookings: any[] }>(`/bookings${query ? `?${query}` : ''}`);
  },
  get: (id: string) => fetchApi<{ booking: any }>(`/bookings/${id}`),
  create: (data: any) => fetchApi<{ booking: any }>('/bookings', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  update: (id: string, data: any) => fetchApi<{ booking: any }>(`/bookings/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  }),
  confirm: (id: string) => fetchApi<{ success: boolean }>(`/bookings/${id}/confirm`, {
    method: 'POST',
  }),
  cancel: (id: string, reason: string) => fetchApi<{ success: boolean }>(`/bookings/${id}/cancel`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  }),
};

// Calendar
export const calendar = {
  getAvailability: (unitId: string, startDate: string, endDate: string) =>
    fetchApi<{ blocks: any[] }>(`/calendar/availability?unit_id=${unitId}&start_date=${startDate}&end_date=${endDate}`),

  createBlock: (data: any) => fetchApi<{ block: any }>('/calendar/blocks', {
    method: 'POST',
    body: JSON.stringify(data),
  }),

  deleteBlock: (id: string) => fetchApi<{ success: boolean }>(`/calendar/blocks/${id}`, {
    method: 'DELETE',
  }),

  holdUnit: (unitId: string, startDate: string, endDate: string) =>
    fetchApi<{ holdToken: string }>('/calendar/hold', {
      method: 'POST',
      body: JSON.stringify({ unitId, startDate, endDate }),
    }),
};

// Payments
export const payments = {
  listInvoices: (params?: any) => {
    const query = new URLSearchParams(params).toString();
    return fetchApi<{ invoices: any[] }>(`/payments/invoices${query ? `?${query}` : ''}`);
  },

  getInvoice: (id: string) => fetchApi<{ invoice: any }>(`/payments/invoices/${id}`),

  createInvoice: (data: any) => fetchApi<{ invoice: any }>('/payments/invoices', {
    method: 'POST',
    body: JSON.stringify(data),
  }),

  createPaymentIntent: (invoiceId: string) =>
    fetchApi<{ clientSecret: string }>('/payments/intents', {
      method: 'POST',
      body: JSON.stringify({ invoiceId }),
    }),
};

// Analytics
export const analytics = {
  getDashboard: (period = 'last_30_days') =>
    fetchApi<any>(`/analytics/dashboard/overview?period=${period}`),

  getRevenue: (period = 'last_30_days') =>
    fetchApi<any>(`/analytics/dashboard/revenue?period=${period}`),

  getOccupancy: (period = 'last_30_days', propertyId?: string) => {
    const query = propertyId ? `&property_id=${propertyId}` : '';
    return fetchApi<any>(`/analytics/dashboard/occupancy?period=${period}${query}`);
  },

  getBookings: (period = 'last_30_days') =>
    fetchApi<any>(`/analytics/dashboard/bookings?period=${period}`),

  getMonthlyComparison: (months = 12) =>
    fetchApi<any>(`/analytics/dashboard/monthly-comparison?months=${months}`),
};

// Admin
export const admin = {
  getSettings: () => fetchApi<{ settings: any }>('/admin/settings'),

  updateSettings: (data: any) => fetchApi<{ settings: any }>('/admin/settings', {
    method: 'PATCH',
    body: JSON.stringify(data),
  }),

  getAuditLogs: (params?: any) => {
    const query = new URLSearchParams(params).toString();
    return fetchApi<{ logs: any[] }>(`/admin/audit${query ? `?${query}` : ''}`);
  },
};

export const api = {
  auth,
  properties,
  units,
  bookings,
  calendar,
  payments,
  analytics,
  admin,
};

export { ApiError };
