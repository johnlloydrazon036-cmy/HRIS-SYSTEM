import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

type BackendRole = "SUPER_ADMIN" | "ADMIN" | "USER";

export type AuthUser = {
  id: number;
  email: string;
  fullName: string;
  roleId: number;
  role: BackendRole;
};

type LoginResponse = AuthUser & { token: string };

type LoginRole = "USER" | "ADMIN";

type AuthContextType = {
  user: AuthUser | null;
  token: string | null;
  isLoggedIn: boolean;
  loginRole: LoginRole;
  setLoginRole: (role: LoginRole) => void;
  login: (email: string, password: string, remember: boolean) => Promise<void>;
  logout: () => Promise<void>;
};

type SharedSessionAuthPayload = {
  user: AuthUser;
  token: string;
  ts: number;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const API_BASE_URL = "http://localhost:5169";

const AUTH_USER_KEY = "auth.user";
const AUTH_TOKEN_KEY = "auth.token";
const AUTH_LOGIN_ROLE_KEY = "auth.loginRole";
const AUTH_REMEMBER_KEY = "auth.remember";

const LEGACY_KEYS = ["token", "ui.loginRole"] as const;

const SESSION_AUTH_REQUEST_KEY = "auth.session.request";
const SESSION_AUTH_RESPONSE_KEY = "auth.session.response";
const SESSION_AUTH_LOGOUT_KEY = "auth.session.logout";

function safeJsonParse<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function cleanupLegacyKeys() {
  for (const k of LEGACY_KEYS) {
    localStorage.removeItem(k);
    sessionStorage.removeItem(k);
  }
}

function clearStoredAuth() {
  localStorage.removeItem(AUTH_USER_KEY);
  localStorage.removeItem(AUTH_TOKEN_KEY);
  localStorage.removeItem(AUTH_REMEMBER_KEY);

  sessionStorage.removeItem(AUTH_USER_KEY);
  sessionStorage.removeItem(AUTH_TOKEN_KEY);
}

function writePersistentAuth(user: AuthUser, token: string) {
  localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
  localStorage.setItem(AUTH_TOKEN_KEY, token);
  localStorage.setItem(AUTH_REMEMBER_KEY, "true");

  sessionStorage.removeItem(AUTH_USER_KEY);
  sessionStorage.removeItem(AUTH_TOKEN_KEY);
}

function writeSessionAuth(user: AuthUser, token: string) {
  sessionStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
  sessionStorage.setItem(AUTH_TOKEN_KEY, token);

  localStorage.removeItem(AUTH_USER_KEY);
  localStorage.removeItem(AUTH_TOKEN_KEY);
  localStorage.setItem(AUTH_REMEMBER_KEY, "false");
}

function loadInitialAuth(): { user: AuthUser | null; token: string | null } {
  const remembered = localStorage.getItem(AUTH_REMEMBER_KEY) === "true";

  if (remembered) {
    const user = safeJsonParse<AuthUser>(localStorage.getItem(AUTH_USER_KEY));
    const token = localStorage.getItem(AUTH_TOKEN_KEY);

    if (!user || !token) {
      clearStoredAuth();
      return { user: null, token: null };
    }

    return { user, token };
  }

  const user = safeJsonParse<AuthUser>(sessionStorage.getItem(AUTH_USER_KEY));
  const token = sessionStorage.getItem(AUTH_TOKEN_KEY);

  if (!user || !token) {
    return { user: null, token: null };
  }

  return { user, token };
}

function loadInitialLoginRole(): LoginRole {
  const raw = localStorage.getItem(AUTH_LOGIN_ROLE_KEY);
  return raw === "ADMIN" ? "ADMIN" : "USER";
}

export function AuthProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    cleanupLegacyKeys();
  }, []);

  const initial = loadInitialAuth();

  const [user, setUser] = useState<AuthUser | null>(initial.user);
  const [token, setToken] = useState<string | null>(initial.token);
  const [loginRole, setLoginRoleState] = useState<LoginRole>(() => loadInitialLoginRole());

  const isLoggedIn = !!token && !!user;
  const loginInFlightRef = useRef(false);
  const logoutInFlightRef = useRef(false);
  const sessionRequestIdRef = useRef<string | null>(null);

  const setAuthState = useCallback((nextUser: AuthUser | null, nextToken: string | null) => {
    setUser(nextUser);
    setToken(nextToken);
  }, []);

  const setLoginRole = useCallback((role: LoginRole) => {
    setLoginRoleState(role);
    localStorage.setItem(AUTH_LOGIN_ROLE_KEY, role);

    localStorage.removeItem("ui.loginRole");
    sessionStorage.removeItem("ui.loginRole");
  }, []);

  const applyLoginStorage = useCallback((nextUser: AuthUser, nextToken: string, remember: boolean) => {
    if (remember) {
      writePersistentAuth(nextUser, nextToken);
    } else {
      writeSessionAuth(nextUser, nextToken);
    }

    setAuthState(nextUser, nextToken);
    cleanupLegacyKeys();
  }, [setAuthState]);

  const clearAuthStateAndStorage = useCallback(() => {
    clearStoredAuth();
    setAuthState(null, null);
    cleanupLegacyKeys();
  }, [setAuthState]);

  const logout = useCallback(async () => {
    if (logoutInFlightRef.current) return;
    logoutInFlightRef.current = true;

    const remembered = localStorage.getItem(AUTH_REMEMBER_KEY) === "true";
    const currentToken = remembered
      ? localStorage.getItem(AUTH_TOKEN_KEY)
      : sessionStorage.getItem(AUTH_TOKEN_KEY);

    clearAuthStateAndStorage();

    try {
      if (currentToken) {
        await fetch(`${API_BASE_URL}/auth/logout`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${currentToken}`,
          },
        });
      }
    } catch {
      // ignore logout logging failure and continue clearing local auth
    } finally {
      localStorage.setItem(
        SESSION_AUTH_LOGOUT_KEY,
        JSON.stringify({ ts: Date.now() })
      );
      localStorage.removeItem(SESSION_AUTH_LOGOUT_KEY);
      logoutInFlightRef.current = false;
    }
  }, [clearAuthStateAndStorage]);

  const login = useCallback(
    async (email: string, password: string, remember: boolean) => {
      if (loginInFlightRef.current) return;
      loginInFlightRef.current = true;

      try {
        const res = await fetch(`${API_BASE_URL}/auth/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        });

        if (!res.ok) {
          const text = await res.text().catch(() => "");
          throw new Error(text || `Login failed (${res.status})`);
        }

        const data = (await res.json()) as LoginResponse;

        const isBackendAdmin = data.role === "SUPER_ADMIN" || data.role === "ADMIN";
        const isBackendUser = data.role === "USER";

        const validForTab =
          (loginRole === "ADMIN" && isBackendAdmin) ||
          (loginRole === "USER" && isBackendUser);

        if (!validForTab) {
          await logout();
          throw new Error(
            loginRole === "ADMIN"
              ? "This account is not an admin. Please use User Login."
              : "This account is an admin. Please use Admin Login."
          );
        }

        const nextUser: AuthUser = {
          id: data.id,
          email: data.email,
          fullName: data.fullName,
          roleId: data.roleId,
          role: data.role,
        };

        applyLoginStorage(nextUser, data.token, remember);
      } finally {
        loginInFlightRef.current = false;
      }
    },
    [applyLoginStorage, loginRole, logout]
  );

  useEffect(() => {
    const remembered = localStorage.getItem(AUTH_REMEMBER_KEY) === "true";
    if (remembered) return;
    if (sessionStorage.getItem(AUTH_TOKEN_KEY)) return;

    const requestId =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random()}`;

    sessionRequestIdRef.current = requestId;

    localStorage.setItem(
      SESSION_AUTH_REQUEST_KEY,
      JSON.stringify({ requestId, ts: Date.now() })
    );
    localStorage.removeItem(SESSION_AUTH_REQUEST_KEY);

    const timer = window.setTimeout(() => {
      if (sessionRequestIdRef.current === requestId) {
        sessionRequestIdRef.current = null;
      }
    }, 1200);

    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (!event.key || !event.newValue) return;

      if (event.key === SESSION_AUTH_REQUEST_KEY) {
        const remembered = localStorage.getItem(AUTH_REMEMBER_KEY) === "true";

        if (remembered) return;
        if (!user || !token) return;

        const currentSessionToken = sessionStorage.getItem(AUTH_TOKEN_KEY);
        const currentSessionUser = sessionStorage.getItem(AUTH_USER_KEY);

        if (!currentSessionToken || !currentSessionUser) return;

        const request = safeJsonParse<{ requestId: string; ts: number }>(event.newValue);
        if (!request?.requestId) return;

        const payload: SharedSessionAuthPayload & { requestId: string } = {
          requestId: request.requestId,
          user,
          token,
          ts: Date.now(),
        };

        localStorage.setItem(SESSION_AUTH_RESPONSE_KEY, JSON.stringify(payload));
        localStorage.removeItem(SESSION_AUTH_RESPONSE_KEY);
        return;
      }

      if (event.key === SESSION_AUTH_RESPONSE_KEY) {
        const response = safeJsonParse<
          SharedSessionAuthPayload & { requestId: string }
        >(event.newValue);

        if (!response?.requestId) return;
        if (sessionRequestIdRef.current !== response.requestId) return;

        sessionRequestIdRef.current = null;
        writeSessionAuth(response.user, response.token);
        setAuthState(response.user, response.token);
        return;
      }

      if (event.key === SESSION_AUTH_LOGOUT_KEY) {
        clearAuthStateAndStorage();
      }
    };

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [clearAuthStateAndStorage, setAuthState, token, user]);

  const value = useMemo(
    () => ({
      user,
      token,
      isLoggedIn,
      loginRole,
      setLoginRole,
      login,
      logout,
    }),
    [user, token, isLoggedIn, loginRole, setLoginRole, login, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
