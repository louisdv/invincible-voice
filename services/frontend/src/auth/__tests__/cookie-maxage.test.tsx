/** Verify the bearerToken cookie is written with a 1-year maxAge. */
import { act, render, waitFor } from '@testing-library/react';
import Cookies from 'universal-cookie';
import AuthProvider, { useAuthContext } from '../authContext';

jest.mock('universal-cookie');
jest.mock('../../i18n/I18nContext', () => ({
  useLocale: () => 'fr',
}));

const ONE_YEAR_SECONDS = 365 * 24 * 60 * 60;

describe('AuthProvider cookie maxAge', () => {
  let setSpy: jest.Mock;

  beforeEach(() => {
    setSpy = jest.fn();
    (Cookies as unknown as jest.Mock).mockImplementation(() => ({
      get: jest.fn(),
      set: setSpy,
      remove: jest.fn(),
    }));

    global.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.includes('/api/auth/login')) {
        return { ok: true, json: async () => ({ access_token: 'token-abc' }) };
      }
      // allow-password / user fetch on mount
      return { ok: true, json: async () => ({ allow_password: true }) };
    }) as unknown as jest.Mock;
  });

  it('signIn stores token with maxAge ≈ 1 year', async () => {
    let signIn: (email: string, password: string) => void = () => {};

    const Capture = () => {
      signIn = useAuthContext().signIn;
      return null;
    };

    render(
      <AuthProvider>
        <Capture />
      </AuthProvider>,
    );

    await act(async () => {
      await signIn('user@example.com', 'pwd');
    });

    await waitFor(() => expect(setSpy).toHaveBeenCalled());

    const call = setSpy.mock.calls.find((c) => c[0] === 'bearerToken');
    expect(call).toBeDefined();
    const opts = call![2];
    expect(opts.path).toBe('/');
    expect(opts.maxAge).toBe(ONE_YEAR_SECONDS);
    expect(opts.sameSite).toBe('lax');
  });
});
