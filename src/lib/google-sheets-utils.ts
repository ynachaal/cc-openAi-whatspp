/**
 * Utility functions for Google Sheets operations
 */

/**
 * Extracts the Google Sheet ID from a full Google Sheets URL
 * @param url - Full Google Sheets URL or just the ID
 * @returns The extracted Sheet ID or the original string if it's already an ID
 */
export function extractGoogleSheetId(url: string): string {
  if (!url) return '';
  
  // If it's already just an ID (no slashes), return as is
  if (!url.includes('/')) {
    return url.trim();
  }
  
  // Handle different Google Sheets URL formats
  const patterns = [
    // Standard format: https://docs.google.com/spreadsheets/d/{ID}/edit#gid=0
    /\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/,
    // Alternative format: https://docs.google.com/spreadsheets/d/{ID}
    /docs\.google\.com\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/,
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }
  
  // If no pattern matches, return the original string trimmed
  return url.trim();
}

/**
 * Validates if a string is a valid Google Sheet ID
 * @param id - The ID to validate
 * @returns true if valid, false otherwise
 */
export function isValidGoogleSheetId(id: string): boolean {
  if (!id) return false;
  
  // Google Sheet IDs are typically 44 characters long and contain letters, numbers, hyphens, and underscores
  const idPattern = /^[a-zA-Z0-9-_]{10,}$/;
  return idPattern.test(id.trim());
}

/**
 * Generates a Google Sheets URL from a Sheet ID
 * @param id - The Google Sheet ID
 * @returns Full Google Sheets URL
 */
export function generateGoogleSheetsUrl(id: string): string {
  if (!id) return '';
  return `https://docs.google.com/spreadsheets/d/${id}/edit`;
}

/**
 * Validates and extracts Google Sheet ID from input
 * @param input - User input (URL or ID)
 * @returns Object with extracted ID and validation result
 */
export function validateAndExtractSheetId(input: string): {
  id: string;
  isValid: boolean;
  error?: string;
} {
  if (!input) {
    return {
      id: '',
      isValid: false,
      error: 'Google Sheet URL or ID is required'
    };
  }
  
  const extractedId = extractGoogleSheetId(input);
  const isValid = isValidGoogleSheetId(extractedId);
  
  return {
    id: extractedId,
    isValid,
    error: isValid ? undefined : 'Invalid Google Sheet URL or ID format'
  };
}
