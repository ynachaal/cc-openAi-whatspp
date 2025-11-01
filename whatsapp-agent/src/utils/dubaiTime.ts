/**
 * Utility functions for handling Dubai time formatting
 */

/**
 * Converts a timestamp to Dubai time and formats it in a readable format
 * @param timestamp - The timestamp to convert (can be in seconds or milliseconds)
 * @returns Formatted Dubai time string like "09/01/2025 14:20 Emirates time/ Dubai time"
 */
export function formatDubaiTime(timestamp: number): string {
  try {
    // Convert timestamp to milliseconds if it's in seconds
    const timestampMs = timestamp.toString().length === 10 ? timestamp * 1000 : timestamp;
    
    // Create date object
    const date = new Date(timestampMs);
    
    // Validate the date
    if (isNaN(date.getTime()) || date.getFullYear() < 1970 || date.getFullYear() > 2100) {
      console.error(`❌ Invalid timestamp: ${timestamp}, using current time as fallback`);
      return formatDubaiTime(Date.now());
    }
    
    // Format the date in Dubai time (UTC+4)
    const dubaiDate = new Date(date.getTime() + (4 * 60 * 60 * 1000)); // Add 4 hours for Dubai time
    
    // Format: DD/MM/YYYY HH:MM
    const day = dubaiDate.getUTCDate().toString().padStart(2, '0');
    const month = (dubaiDate.getUTCMonth() + 1).toString().padStart(2, '0');
    const year = dubaiDate.getUTCFullYear();
    const hours = dubaiDate.getUTCHours().toString().padStart(2, '0');
    const minutes = dubaiDate.getUTCMinutes().toString().padStart(2, '0');
    
    return `${day}/${month}/${year} ${hours}:${minutes} Emirates time/ Dubai time`;
  } catch (error) {
    console.error('Error formatting Dubai time:', error);
    // Fallback to current time
    return formatDubaiTime(Date.now());
  }
}

/**
 * Converts a timestamp to Dubai time and returns it as a Date object
 * @param timestamp - The timestamp to convert (can be in seconds or milliseconds)
 * @returns Date object in Dubai time
 */
export function getDubaiDate(timestamp: number): Date {
  const timestampMs = timestamp.toString().length === 10 ? timestamp * 1000 : timestamp;
  const date = new Date(timestampMs);
  
  // Add 4 hours for Dubai time (UTC+4)
  return new Date(date.getTime() + (4 * 60 * 60 * 1000));
}

/**
 * Validates if a timestamp is valid
 * @param timestamp - The timestamp to validate
 * @returns boolean indicating if the timestamp is valid
 */
export function isValidTimestamp(timestamp: number): boolean {
  const timestampMs = timestamp.toString().length === 10 ? timestamp * 1000 : timestamp;
  const date = new Date(timestampMs);
  
  return !isNaN(date.getTime()) && 
         date.getFullYear() >= 1970 && 
         date.getFullYear() <= 2100;
}


