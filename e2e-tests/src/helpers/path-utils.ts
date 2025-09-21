import * as path from 'path';

/**
 * Utility functions for handling file paths in test logging
 */
export class PathUtils {
    /**
     * Convert absolute path to relative path from project root with file URL
     */
    static getRelativePathWithFileUrl(absolutePath: string): string {
        // Find project root by going up from e2e-tests directory
        const projectRoot = path.resolve(process.cwd(), '..');
        const relativePath = path.relative(projectRoot, absolutePath);
        const fileUrl = `file://${absolutePath}`;
        return `${relativePath} (${fileUrl})`;
    }
}