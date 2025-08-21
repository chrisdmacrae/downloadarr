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

/**
 * Generate title variations for directory matching
 * Handles common transformations that might occur during file organization
 */
export function generateTitleVariations(title: string): string[] {
  const sanitizedTitle = sanitizeTitleForFilesystem(title);
  
  const variations = [
    title,
    sanitizedTitle,
    // Handle plural/singular variations (e.g., "Aliens" -> "Alien")
    title.replace(/s$/, ''),
    sanitizedTitle.replace(/s$/, ''),
    // Handle "The" prefix removal
    title.replace(/^The\s+/, ''),
    sanitizedTitle.replace(/^The\s+/, ''),
  ];
  
  // Remove duplicates and empty strings
  return [...new Set(variations)].filter(v => v.length > 0);
}

/**
 * Generate directory name variations with optional year
 */
export function generateDirectoryNameVariations(title: string, year?: number): string[] {
  const titleVariations = generateTitleVariations(title);
  const directoryNames = [];
  
  for (const titleVariation of titleVariations) {
    directoryNames.push(titleVariation);
    if (year) {
      directoryNames.push(`${titleVariation} (${year})`);
    }
  }
  
  return [...new Set(directoryNames)];
}
