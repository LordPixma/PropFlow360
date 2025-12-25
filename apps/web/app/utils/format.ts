/**
 * Formatting utilities
 */

export function formatCurrency(amount: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(amount);
}

export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(new Date(date));
}

export function formatDateTime(date: string | Date): string {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
  }).format(new Date(date));
}

export function formatPercentage(value: number, decimals = 1): string {
  return `${value.toFixed(decimals)}%`;
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-US').format(value);
}

export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    // Booking statuses
    pending: 'yellow',
    confirmed: 'green',
    checked_in: 'blue',
    checked_out: 'gray',
    cancelled: 'red',

    // Payment statuses
    paid: 'green',
    partial: 'orange',
    unpaid: 'red',
    refunded: 'purple',

    // Maintenance statuses
    open: 'blue',
    in_progress: 'yellow',
    resolved: 'green',
    closed: 'gray',

    // Priority levels
    low: 'gray',
    medium: 'yellow',
    high: 'orange',
    urgent: 'red',
  };

  return colors[status] || 'gray';
}

export function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export function truncate(str: string, length: number): string {
  if (str.length <= length) return str;
  return str.slice(0, length) + '...';
}
