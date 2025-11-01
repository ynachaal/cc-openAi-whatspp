/**
 * Utility functions for handling Dubai time formatting
 */
/**
 * Converts a timestamp to Dubai time and formats it in a readable format
 * @param timestamp - The timestamp to convert (can be in seconds or milliseconds)
 * @returns Formatted Dubai time string like "09 Jan 2025, 2:20 PM (Dubai Time)"
 */
export declare function formatDubaiTime(timestamp: number): string;
/**
 * Converts a timestamp to Dubai time and returns it as a Date object
 * @param timestamp - The timestamp to convert (can be in seconds or milliseconds)
 * @returns Date object in Dubai time
 */
export declare function getDubaiDate(timestamp: number): Date;
/**
 * Converts a timestamp to Dubai time and formats it as ISO string
 * @param timestamp - The timestamp to convert (can be in seconds or milliseconds)
 * @returns ISO string in Dubai time
 */
export declare function formatDubaiTimeISO(timestamp: number): string;
//# sourceMappingURL=dubaiTime.d.ts.map