import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type { AuthResponse, AuthUser } from '@inventory/contracts';
import { configureApi, publicPost } from '../lib/api';
import { desktop } from '../lib/platform';

interface AuthContextValue {
  user: AuthUser | null;
  booting: boolean;
  login(email: string, password: string): Promise<void>;
  logout(): Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren): React.JSX.Element {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [booting, setBooting] = useState(true);

  const applySession = useCallback(async (session: AuthResponse): Promise<string> => {
    setAccessToken(session.accessToken);
    setUser(session.user);
    await desktop.secureStore.setRefreshToken(session.refreshToken);
    return session.accessToken;
  }, []);

  const refresh = useCallback(async (): Promise<string | null> => {
    const refreshToken = await desktop.secureStore.getRefreshToken();
    if (!refreshToken) return null;
    try {
      const session = await publicPost<AuthResponse>('/auth/refresh', { refreshToken });
      return await applySession(session);
    } catch {
      await desktop.secureStore.setRefreshToken(null);
      setAccessToken(null);
      setUser(null);
      return null;
    }
  }, [applySession]);

  useEffect(() => {
    configureApi({ token: accessToken, refresh });
  }, [accessToken, refresh]);

  useEffect(() => {
    refresh().finally(() => setBooting(false));
  }, [refresh]);

  const login = useCallback(
    async (email: string, password: string): Promise<void> => {
      const session = await publicPost<AuthResponse>('/auth/login', { email, password });
      await applySession(session);
    },
    [applySession],
  );

  const logout = useCallback(async (): Promise<void> => {
    const refreshToken = await desktop.secureStore.getRefreshToken();
    if (refreshToken) {
      await publicPost('/auth/logout', { refreshToken }).catch(() => undefined);
    }
    await desktop.secureStore.setRefreshToken(null);
    setAccessToken(null);
    setUser(null);
  }, []);

  const value = useMemo(() => ({ user, booting, login, logout }), [user, booting, login, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider');
  return value;
}
