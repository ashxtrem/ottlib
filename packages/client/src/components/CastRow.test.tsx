import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { CastRow, initialsOf } from './CastRow';

const render = (members: Parameters<typeof CastRow>[0]['members']) => renderToStaticMarkup(<MemoryRouter><CastRow members={members} /></MemoryRouter>);

describe('CastRow', () => {
  it('links each cast card to the actor-filtered library', () => {
    const markup = render([{ name: 'Amy Adams', photoUrl: '/media/people/amy.jpg' }, { name: 'Jeremy Renner', photoUrl: null }]);

    expect(markup).toContain('href="/library?actor=Amy%20Adams"');
    expect(markup).toContain('href="/library?actor=Jeremy%20Renner"');
    expect(markup).toContain('src="/media/people/amy.jpg"');
  });

  it('shows initials when a photo is missing', () => {
    const markup = render([{ name: 'Jeremy Renner', photoUrl: null }]);

    expect(markup).toContain('>JR</div>');
    expect(markup).not.toContain('<img');
  });

  it('scrolls sideways', () => {
    expect(render([{ name: 'Amy Adams', photoUrl: null }])).toContain('overflow-x-auto');
  });

  it('renders nothing without cast', () => {
    expect(render([])).toBe('');
  });

  it('takes first and last initials', () => {
    expect(initialsOf('Forest Steven Whitaker')).toBe('FW');
    expect(initialsOf('Cher')).toBe('C');
  });
});
