/**
 * API error handling utilities with request ID support for troubleshooting.
 */

import { message, notification } from 'antd';
import type { AxiosError } from 'axios';

interface ApiErrorResponse {
  detail?: string;
  message?: string;
}

/**
 * Extract request ID from Axios error response headers.
 */
export function getRequestIdFromError(error: AxiosError): string | null {
  return error.response?.headers?.['x-request-id'] || null;
}

/**
 * Format error message with request ID for troubleshooting.
 */
export function formatErrorWithRequestId(
  errorMessage: string,
  requestId: string | null
): string {
  if (requestId) {
    return `${errorMessage} (Request ID: ${requestId})`;
  }
  return errorMessage;
}

/**
 * Extract error message from Axios error.
 */
export function getErrorMessage(error: AxiosError<ApiErrorResponse>): string {
  if (error.response?.data) {
    return error.response.data.detail || error.response.data.message || 'Unknown error';
  }
  if (error.message) {
    return error.message;
  }
  return 'Network error';
}

/**
 * Show error message with request ID using Ant Design message component.
 * Use this for simple, brief error notifications.
 */
export function showApiError(
  error: AxiosError<ApiErrorResponse>,
  fallbackMessage = 'Operation failed'
): void {
  const requestId = getRequestIdFromError(error);
  const errorMsg = getErrorMessage(error) || fallbackMessage;
  const fullMessage = formatErrorWithRequestId(errorMsg, requestId);

  message.error(fullMessage);
}

/**
 * Show detailed error notification with request ID using Ant Design notification.
 * Use this for important errors that need more visibility.
 */
export function showApiErrorNotification(
  error: AxiosError<ApiErrorResponse>,
  title = 'Error',
  fallbackMessage = 'Operation failed'
): void {
  const requestId = getRequestIdFromError(error);
  const errorMsg = getErrorMessage(error) || fallbackMessage;
  const description = requestId
    ? `${errorMsg}\n\nRequest ID: ${requestId}`
    : errorMsg;

  notification.error({
    message: title,
    description,
    duration: 6,
  });
}

/**
 * Copy request ID to clipboard for easy sharing.
 */
export async function copyRequestIdToClipboard(requestId: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(requestId);
    message.success('Request ID copied to clipboard');
    return true;
  } catch {
    message.error('Failed to copy request ID');
    return false;
  }
}
