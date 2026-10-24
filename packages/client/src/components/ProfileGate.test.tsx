import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { ProfileGate } from './ProfileGate';
import { useCurrentProfile } from '../hooks/useProfile';

vi.mock('../hooks/useProfile', () => ({ useCurrentProfile: vi.fn() }));
vi.mock('./ProfilePicker', () => ({ ProfilePicker: () => <p>picker</p> }));

const current = vi.mocked(useCurrentProfile);
const render = (state: { data?: unknown; isError?: boolean }) => {
  current.mockReturnValue({ isError: false, ...state } as ReturnType<typeof useCurrentProfile>);
  return renderToStaticMarkup(<ProfileGate><p>app</p></ProfileGate>);
};

describe('ProfileGate', () => {
  it('shows the app once a profile is active', () => {
    expect(render({ data: { profile: { id: 1, name: 'Home', color: '#e50914', hasPin: false, isOwner: true } } })).toBe('<p>app</p>');
  });

  it('shows the picker when the server asks for a profile', () => {
    expect(render({ data: null })).toBe('<p>picker</p>');
  });

  it('shows nothing while loading and the app when the check fails', () => {
    expect(render({ data: undefined })).toBe('');
    expect(render({ data: undefined, isError: true })).toBe('<p>app</p>');
  });
});
