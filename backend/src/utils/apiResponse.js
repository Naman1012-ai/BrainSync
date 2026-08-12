/**
 * Standardized BrainSync API Response Helper.
 * Ensures consistent JSON structure across all Express backend endpoints.
 */

/**
 * Standard Success Response Handler
 * Format: { success: true, data: { ... } }
 */
export function successResponse(res, data = {}, statusCode = 200) {
  return res.status(statusCode).json({
    success: true,
    data,
  });
}

/**
 * Standard Error Response Handler
 * Format: { success: false, error: { code: 'ERROR_CODE', message: 'Human-readable message' } }
 */
export function errorResponse(res, code = 'INTERNAL_ERROR', message = 'An unexpected error occurred.', statusCode = 400) {
  return res.status(statusCode).json({
    success: false,
    error: {
      code,
      message,
    },
  });
}
