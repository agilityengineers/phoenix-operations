import { useQuery } from "@tanstack/react-query";
import { fetchSession, type AuthSession } from "./auth";

export type { AuthSession };

export const SESSION_QUERY_KEY = ["auth-session"] as const;

/** The signed-in user, shared by the admin layout and every admin page through one cached query. */
export const useSession = () =>
  useQuery({ queryKey: SESSION_QUERY_KEY, queryFn: fetchSession, retry: false, staleTime: 60_000 });
