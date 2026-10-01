import { existsSync } from 'fs';
import { extname, join } from 'path';
import type { NextFunction, Request, Response } from 'express';
import type { NestExpressApplication } from '@nestjs/platform-express';

/** Every controller's routes live under this. */
export const API_PREFIX = 'api/v1';

/**
 * Whether a request is for one of the UI's own pages, which the client-side
 * router handles, so it is answered with index.html. Everything under /api and
 * Socket.IO's own path stays with the server, and a path with a file extension
 * is a missing asset rather than a page.
 */
export function isUiRoute(method: string, path: string): boolean {
  if (method !== 'GET' && method !== 'HEAD') return false;
  if (path === '/api' || path.startsWith('/api/') || path.startsWith('/socket.io')) return false;
  return extname(path) === '';
}

/**
 * Serves the built UI from the API's own port. Returns false when there is no
 * build at `dir` (e.g. in development, where Vite serves the UI instead).
 */
export function serveUi(app: NestExpressApplication, dir: string): boolean {
  const index = join(dir, 'index.html');
  if (!existsSync(index)) return false;

  app.useStaticAssets(dir, {
    index: false,
    setHeaders: (res: Response, file: string) => {
      // Vite fingerprints everything under assets/, so it can be kept for good.
      const fingerprinted = file.startsWith(join(dir, 'assets'));
      res.setHeader('Cache-Control', fingerprinted ? 'public, max-age=31536000, immutable' : 'no-cache');
    },
  });

  app.use((req: Request, res: Response, next: NextFunction) => {
    if (!isUiRoute(req.method, req.path)) return next();
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(index);
  });
  return true;
}
