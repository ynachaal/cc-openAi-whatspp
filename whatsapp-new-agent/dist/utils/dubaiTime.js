"use strict";
/**
 * Utility functions for handling Dubai time formatting
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatDubaiTime = formatDubaiTime;
exports.getDubaiDate = getDubaiDate;
exports.formatDubaiTimeISO = formatDubaiTimeISO;
/**
 * Converts a timestamp to Dubai time and formats it in a readable format
 * @param timestamp - The timestamp to convert (can be in seconds or milliseconds)
 * @returns Formatted Dubai time string like "09 Jan 2025, 2:20 PM (Dubai Time)"
 */
function formatDubaiTime(timestamp) {
    try {
        // Convert timestamp to milliseconds if it's in seconds
        const timestampMs = timestamp.toString().length === 10 ? timestamp * 1000 : timestamp;
        const date = new Date(timestampMs);
        // Validate the date
        if (isNaN(date.getTime()) || date.getFullYear() < 1970 || date.getFullYear() > 2100) {
            console.error(`❌ Invalid timestamp: ${timestamp}, using current time as fallback`);
            return formatDubaiTime(Date.now());
        }
        // Format the date in Dubai time (UTC+4)
        const dubaiDate = new Date(date.getTime() + (4 * 60 * 60 * 1000)); // Add 4 hours for Dubai time
        // Format: DD MMM YYYY, HH:MM AM/PM (Dubai Time)
        const day = dubaiDate.getUTCDate().toString().padStart(2, '0');
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const month = monthNames[dubaiDate.getUTCMonth()];
        const year = dubaiDate.getUTCFullYear();
        // Convert to 12-hour format with AM/PM
        let hours = dubaiDate.getUTCHours();
        const minutes = dubaiDate.getUTCMinutes().toString().padStart(2, '0');
        const ampm = hours >= 12 ? 'PM' : 'AM';
        hours = hours % 12;
        hours = hours ? hours : 12; // 0 should be 12
        const hoursStr = hours.toString().padStart(2, '0');
        return `${day} ${month} ${year}, ${hoursStr}:${minutes} ${ampm} (Dubai Time)`;
    }
    catch (error) {
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
function getDubaiDate(timestamp) {
    const timestampMs = timestamp.toString().length === 10 ? timestamp * 1000 : timestamp;
    const date = new Date(timestampMs);
    // Add 4 hours for Dubai time (UTC+4)
    return new Date(date.getTime() + (4 * 60 * 60 * 1000));
}
/**
 * Converts a timestamp to Dubai time and formats it as ISO string
 * @param timestamp - The timestamp to convert (can be in seconds or milliseconds)
 * @returns ISO string in Dubai time
 */
function formatDubaiTimeISO(timestamp) {
    try {
        const timestampMs = timestamp.toString().length === 10 ? timestamp * 1000 : timestamp;
        const date = new Date(timestampMs);
        // Validate the date
        if (isNaN(date.getTime()) || date.getFullYear() < 1970 || date.getFullYear() > 2100) {
            console.error(`❌ Invalid timestamp: ${timestamp}, using current time as fallback`);
            return formatDubaiTimeISO(Date.now());
        }
        // Convert to Dubai time (UTC+4)
        const dubaiDate = new Date(date.getTime() + (4 * 60 * 60 * 1000));
        return dubaiDate.toISOString();
    }
    catch (error) {
        console.error('Error formatting Dubai time ISO:', error);
        // Fallback to current time
        return formatDubaiTimeISO(Date.now());
    }
}
//# sourceMappingURL=dubaiTime.js.map