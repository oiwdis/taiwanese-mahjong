/**
 * Identify the running deploy so a phone that is still holding an old
 * `index.html` can notice and offer one Update tap instead of a hard refresh.
 */
export function resolveBuildId(env: NodeJS.ProcessEnv = process.env): string {
  return (
    env.RAILWAY_DEPLOYMENT_ID ||
    env.RAILWAY_GIT_COMMIT_SHA ||
    env.BUILD_ID ||
    `boot-${Math.floor(Date.now() / 1000)}`
  );
}

export const BUILD_ID = resolveBuildId();

export function htmlWithBuildId(html: string, buildId: string): string {
  const safe = buildId.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  const tag = `<meta name="build-id" content="${safe}" />`;
  if (/<meta\s+name="build-id"/i.test(html)) {
    return html.replace(/<meta\s+name="build-id"[^>]*>/i, tag);
  }
  if (html.includes('</head>')) return html.replace('</head>', `    ${tag}\n  </head>`);
  return `${tag}\n${html}`;
}

export const HTML_NO_STORE = 'no-store, no-cache, must-revalidate';
export const ASSET_CACHE = 'public, max-age=31536000, immutable';
