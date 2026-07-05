import helmet from 'helmet';
import type { Express } from 'express';

const isProduction = process.env.NODE_ENV === 'production';
const cspEnforce = process.env.CSP_ENFORCE === 'true';

const cspDirectives: Record<string, string[]> = {
  'default-src': ["'self'"],
  'script-src': ["'self'"],
  'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
  'font-src': ["'self'", 'https://fonts.gstatic.com'],
  'img-src': ["'self'", 'data:'],
  'connect-src': ["'self'"],
  'frame-ancestors': ["'none'"],
  'base-uri': ["'self'"],
  'form-action': ["'self'"],
};

function buildCspHeader(directives: Record<string, string[]>): string {
  return Object.entries(directives)
    .map(([key, values]) => `${key} ${values.join(' ')}`)
    .join('; ');
}

export function applySecurityHeaders(app: Express): void {
  app.use(
    helmet({
      contentSecurityPolicy: cspEnforce
        ? {
            directives: cspDirectives,
          }
        : false,
      crossOriginResourcePolicy: { policy: 'same-origin' },
      frameguard: { action: 'deny' },
      hsts: isProduction
        ? {
            maxAge: 31_536_000,
            includeSubDomains: true,
            preload: false,
          }
        : false,
      referrerPolicy: { policy: 'no-referrer' },
    }),
  );

  if (!cspEnforce) {
    app.use((_req, res, next) => {
      res.setHeader('Content-Security-Policy-Report-Only', buildCspHeader(cspDirectives));
      next();
    });
  }

  app.use((_req, res, next) => {
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    next();
  });
}
