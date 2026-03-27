/**
 * Resolve an image_path from the database to a URL the browser can load.
 * Uploaded files are served via /api/uploads/..., committed public assets via /.
 */
export function resolveImageUrl(path: string): string {
  return path.startsWith('uploads/') ? `/api/${path}` : `/${path}`;
}
