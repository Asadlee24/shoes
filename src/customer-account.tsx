import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import type { ReactNode } from "react";
import { api, ApiError } from "./api";
export type Customer = {
  id: string;
  name: string;
  email: string;
  emailVerified?: boolean;
  phone: string;
  city: string;
  address: string;
};
type Session = { user: Customer; csrf: string; recoveryCode?: string };
type AccountContext = {
  user: Customer | null;
  loading: boolean;
  error: string;
  headers: Record<string, string>;
  refresh: () => Promise<void>;
  authenticate: (
    mode: string,
    input: Record<string, FormDataEntryValue>,
  ) => Promise<Session>;
  logout: () => Promise<void>;
  update: (session: Partial<Session>) => void;
};
const Context = createContext<AccountContext | null>(null);
export function AccountProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  const refresh = useCallback(async () => {
    setError("");
    try {
      setSession(await api<Session>("/api/account/session"));
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) setSession(null);
      else setError((error as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  async function authenticate(
    mode: string,
    input: Record<string, FormDataEntryValue>,
  ) {
    const result = await api<Session>(`/api/account/${mode}`, {
      method: "POST",
      body: JSON.stringify(input),
    });
    setSession({ user: result.user, csrf: result.csrf });
    setError("");
    return result;
  }
  const headers = { "X-Customer-CSRF": session?.csrf || "" };
  async function logout() {
    await api("/api/account/logout", { method: "POST", headers, body: "{}" });
    setSession(null);
  }
  function update(next: Partial<Session>) {
    setSession((current) => (current ? { ...current, ...next } : current));
  }
  return (
    <Context.Provider
      value={{
        user: session?.user || null,
        loading,
        error,
        headers,
        refresh,
        authenticate,
        logout,
        update,
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function useAccount() {
  const value = useContext(Context);
  if (!value) throw new Error("AccountProvider required");
  return value;
}
