import { useQuery } from "@tanstack/react-query";

export type AuthSession = {
  user: { id: string; email: string; name: string; role: string };
  workspace: { id: string };
};

export const SESSION_QUERY_KEY = ["auth-session"] as const;

export const fetchSession = async (): Promise<AuthSession | null> => {
  const response = await fetch("/api/auth/session", { credentials: "include" });
  if (!response.ok) return null;
  return response.json() as Promise<AuthSession>;
};

/** The signed-in user, shared by the admin layout and every admin page through one cached query. */
export const useSession = () =>
  useQuery({ queryKey: SESSION_QUERY_KEY, queryFn: fetchSession, retry: false, staleTime: 60_000 });
