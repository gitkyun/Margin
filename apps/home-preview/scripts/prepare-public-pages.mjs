import { copyFileSync } from 'node:fs';
// Cloudflare Pages serves this shell with HTTP 404 for unknown public paths.
copyFileSync(new URL('../dist/client/index.html', import.meta.url), new URL('../dist/client/404.html', import.meta.url));
