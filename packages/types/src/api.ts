export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: ApiError;
  meta?: ApiMeta;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface ApiMeta {
  page?: number;
  pageSize?: number;
  total?: number;
  totalPages?: number;
}

export interface PaginationParams {
  page?: number;
  pageSize?: number;
}

export type SortDirection = 'asc' | 'desc';

export interface SortParams {
  sortBy?: string;
  sortDirection?: SortDirection;
}
