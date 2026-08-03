import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { getMfaState } from "@/lib/mfa";

interface AuthState {
  user: User | null;
  session: Session | null;
  loading: boolean;
  /** Password step done, TOTP code still owed. Nothing past the login screen. */
  mfaPending: boolean;
}

const AuthContext = createContext<AuthState>({
  user: null,
  session: null,
  loading: true,
  mfaPending: false,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    session: null,
    loading: true,
    mfaPending: false,
  });

  useEffect(() => {
    // The cold-start read and auth events can resolve out of order once the
    // MFA lookup adds a round trip, so only the newest one may write state.
    let latest = 0;

    const publish = async (session: Session | null) => {
      const generation = ++latest;

      if (!session) {
        if (generation === latest) {
          setState({
            user: null,
            session: null,
            loading: false,
            mfaPending: false,
          });
        }
        return;
      }

      let mfaPending: boolean;
      try {
        mfaPending = (await getMfaState()).challengePending;
      } catch {
        // An unreachable auth server cannot prove the second factor was
        // completed, and the same call is what gates the web app, so hold the
        // session at the login screen rather than assume it is elevated.
        mfaPending = true;
      }

      if (generation !== latest) return;
      setState({ user: session.user, session, loading: false, mfaPending });
    };

    supabase.auth.getSession().then(({ data: { session } }) => publish(session));

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => publish(session));

    return () => subscription.unsubscribe();
  }, []);

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  return useContext(AuthContext);
}
