import { describe, expect, it } from 'vitest';
import { htmlWithBuildId, resolveBuildId } from '../build.js';

describe('resolveBuildId', () => {
  it('prefers the Railway deployment id', () => {
    expect(
      resolveBuildId({
        RAILWAY_DEPLOYMENT_ID: 'dep-1',
        RAILWAY_GIT_COMMIT_SHA: 'abc',
        BUILD_ID: 'manual',
      }),
    ).toBe('dep-1');
  });

  it('falls back to a boot stamp when nothing is set', () => {
    expect(resolveBuildId({})).toMatch(/^boot-\d+$/);
  });
});

describe('htmlWithBuildId', () => {
  it('injects a build-id meta tag into a normal document', () => {
    const html = htmlWithBuildId('<html><head><title>x</title></head></html>', 'dep-9');
    expect(html).toContain('<meta name="build-id" content="dep-9" />');
  });

  it('replaces an existing build-id instead of adding a second one', () => {
    const html = htmlWithBuildId(
      '<html><head><meta name="build-id" content="old" /></head></html>',
      'new',
    );
    expect(html).toContain('content="new"');
    expect(html).not.toContain('content="old"');
  });
});
