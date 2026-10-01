/**
 * Shared filesystem utilities for consistent file and directory naming
 */

/**
 * Sanitize title for filesystem by replacing problematic characters
 * This ensures consistent naming between organization and scanning services
 */
export function sanitizeTitleForFilesystem(title: string): string {
  return title
    .replace(/:/g, '_')           // Colon to underscore
    .replace(/;/g, '')            // Remove semicolons
    .replace(/\?/g, '')           // Remove question marks
    .replace(/"/g, '')            // Remove quotes
    .replace(/</g, '')            // Remove less than
    .replace(/>/g, '')            // Remove greater than
    .replace(/\|/g, '')           // Remove pipe
    .replace(/\*/g, '')           // Remove asterisk
    .replace(/\//g, '-')          // Forward slash to dash
    .replace(/\\/g, '-')          // Backslash to dash
    .replace(/\s+/g, ' ')         // Multiple spaces to single space
    .trim();
}
