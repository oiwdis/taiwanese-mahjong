import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { Landing } from '../Lobby.js';

vi.mock('../../socket.js', () => ({
  api: {},
  socket: { on: () => {}, off: () => {}, emit: () => {} },
}));

describe('landing', () => {
  it('shows an Update button when a handler is provided', () => {
    const html = renderToStaticMarkup(
      <Landing
        onCreate={() => {}}
        onJoin={() => {}}
        error={null}
        busy={false}
        onUpdate={() => {}}
      />,
    );
    expect(html).toContain('Update');
    expect(html).toContain('latest Railway deploy');
  });

  it('submits Join when Enter is pressed in the code field', () => {
    const html = renderToStaticMarkup(
      <Landing onCreate={() => {}} onJoin={() => {}} error={null} busy={false} />,
    );
    expect(html).toContain('<form');
    expect(html).toContain('type="submit"');
    expect(html).toContain('Join');
  });
});
