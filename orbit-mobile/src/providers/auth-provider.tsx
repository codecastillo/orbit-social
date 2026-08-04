import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Alert } from "react-native";
import { useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import type { AuthChangeEvent, Session, User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { getMfaState } from "@/lib/mfa";
import { resetAccountScopedState } from "@/lib/account-state";
import { clearPersistedQueryCache } from "@/lib/query-persist";
import { setRecentSearchScope } from "@/lib/recent-searches";
import {
  forgetAccount,
  forgetAllAccounts,
  listAccountIdentities,
  readStoredAccount,
  rememberAccount,
  updateStoredSession,
  type AccountIdentity,
} from "@/lib/accounts";
import { getAccountProfile } from "@/lib/queries/profiles";
import { reactivateAccount } from "@/lib/queries/account";

interface AuthState {
  user: User | null;
  session: Session | null;
  loading: boolean;
  /** Password step done, TOTP code still owed. Nothing past the login screen. */
  mfaPending: boolean;
}

interface AuthValue extends AuthState {
  /** Every account signed in on this device, active one included. */
  accounts: AccountIdentity[];
  /** True between accounts, and while the login screen is adding one. */
  switching: boolean;
  /** The login screen is signing in an extra account, not replacing this one. */
  addingAccount: boolean;
  switchAccount: (userId: string) => Promise<void>;
  beginAddAccount: () => void;
  finishAddAccount: () => void;
  cancelAddAccount: () => Promise<void>;
  signOutActiveAccount: () => Promise<void>;
  signOutAllAccounts: () => Promise<void>;
}

const AuthContext = createContext<AuthValue>({
  user: null,
  session: null,
  loading: true,
  mfaPending: false,
  accounts: [],
  switching: false,
  addingAccount: false,
  switchAccount: async () => {},
  beginAddAccount: () => {},
  finishAddAccount: () => {},
  cancelAddAccount: async () => {},
  signOutActiveAccount: async () => {},
  signOutAllAccounts: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [state, setState] = useState<AuthState>({
    user: null,
    session: null,
    loading: true,
    mfaPending: false,
  });
  const [accounts, setAccounts] = useState<AccountIdentity[]>([]);
  const [switching, setSwitching] = useState(false);
  const [addingAccount, setAddingAccount] = useState(false);

  // The switch and sign-out flows read the current account outside of render.
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);
  // Which account to fall back to if adding another one is abandoned.
  const addReturnUserId = useRef<string | null>(null);
  // Set while a swap owns the session, so auth events do not interleave.
  const swapping = useRef(false);
  // The cold-start read and auth events can resolve out of order once the
  // MFA lookup adds a round trip, so only the newest one may write state.
  const generation = useRef(0);

  const publish = useCallback(
    async (session: Session | null, refreshIdentity: boolean) => {
      const current = ++generation.current;

      if (!session) {
        // Search history is keyed by account, so point it back at the
        // signed-out bucket before any screen reads it.
        setRecentSearchScope(null);
        if (current === generation.current) {
          setState({
            user: null,
            session: null,
            loading: false,
            mfaPending: false,
          });
        }
        return;
      }

      setRecentSearchScope(session.user.id);

      let mfaPending: boolean;
      try {
        mfaPending = (await getMfaState()).challengePending;
      } catch {
        // An unreachable auth server cannot prove the second factor was
        // completed, and the same call is what gates the web app, so hold the
        // session at the login screen rather than assume it is elevated.
        mfaPending = true;
      }

      if (current !== generation.current) return;
      setState({ user: session.user, session, loading: false, mfaPending });

      // Only a fully authenticated session is worth storing: an account that
      // still owes its TOTP code would come back from the switcher unusable.
      if (mfaPending) return;

      // Signing back in is the whole reactivation gesture, and only a session
      // past the MFA gate counts as signed in. A token refresh is not a new
      // sign-in, so this rides along with the identity refresh.
      if (refreshIdentity) {
        try {
          if (await reactivateAccount(session.user.id)) {
            Alert.alert("Welcome back", "Your account is active again.");
          }
        } catch {
          // The pause simply holds until the next sign-in tries again.
        }
      }

      try {
        if (refreshIdentity) {
          const profile = await getAccountProfile(session.user.id);
          if (profile) await rememberAccount(session, profile);
        } else {
          await updateStoredSession(session);
        }
        setAccounts(await listAccountIdentities());
      } catch {
        // The switcher losing an entry is not worth failing a sign-in over.
      }
    },
    [],
  );

  useEffect(() => {
    supabase.auth
      .getSession()
      .then(({ data: { session } }) => publish(session, true));
    listAccountIdentities().then(setAccounts);

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event: AuthChangeEvent, session) => {
      // A swap signs out and back in as one operation and publishes its own
      // end state; letting its intermediate SIGNED_OUT through would blank
      // the account it just switched to.
      if (swapping.current) return;
      // A token refresh republishes the same identity; only re-read the
      // profile when the account itself changed.
      void publish(session, event !== "TOKEN_REFRESHED");
    });

    return () => subscription.unsubscribe();
  }, [publish]);

  /** Everything the outgoing account left behind, in one place. */
  const clearAccountScope = useCallback(() => {
    resetAccountScopedState();
    // A cached page from another account is a data leak, not a stale render.
    queryClient.clear();
    // The on-disk copy outlives the process, so clearing memory alone would
    // hand the outgoing account's data to the next cold start.
    void clearPersistedQueryCache();
  }, [queryClient]);

  const switchTo = useCallback(
    async (userId: string) => {
      const target = await readStoredAccount(userId);
      if (!target) return;

      clearAccountScope();

      const { data, error } = await supabase.auth.setSession({
        access_token: target.session.access_token,
        refresh_token: target.session.refresh_token,
      });

      if (error || !data.session) {
        // A rejected refresh token means the stored account is dead. Land on
        // a known state, signed out at the login form, rather than leave the
        // app half switched.
        await forgetAccount(userId);
        await supabase.auth.signOut({ scope: "local" });
        setAccounts(await listAccountIdentities());
        await publish(null, false);
        clearAccountScope();
        router.replace({
          pathname: "/(auth)/login",
          params: { email: target.email ?? "", expired: "1" },
        });
        return;
      }

      // Screens stay mounted through the swap, so a query that was already
      // in flight under the old token can land in the cache after the first
      // clear. Clearing again once the session is in place is what makes the
      // cache genuinely empty for the incoming account.
      clearAccountScope();

      // Publishing here rather than waiting on the SIGNED_IN event keeps the
      // gate closed until the incoming account's MFA state is re-resolved.
      await publish(data.session, true);
    },
    [clearAccountScope, publish, router],
  );

  /**
   * Runs one session swap: the gate holds and auth events stay out of the way
   * until it has published where it landed.
   */
  const runSwap = useCallback(async (swap: () => Promise<void>) => {
    swapping.current = true;
    setSwitching(true);
    try {
      await swap();
    } finally {
      swapping.current = false;
      setSwitching(false);
    }
  }, []);

  const switchAccount = useCallback(
    async (userId: string) => {
      const active = stateRef.current;
      if (userId === active.user?.id && !active.mfaPending) return;
      await runSwap(() => switchTo(userId));
    },
    [runSwap, switchTo],
  );

  const signOutActiveAccount = useCallback(
    () =>
      runSwap(async () => {
        const activeUserId = stateRef.current.user?.id;
        clearAccountScope();
        if (activeUserId) await forgetAccount(activeUserId);
        const remaining = await listAccountIdentities();
        setAccounts(remaining);

        await supabase.auth.signOut();

        const next = remaining[0];
        if (next) {
          await switchTo(next.userId);
        } else {
          await publish(null, false);
          clearAccountScope();
        }
      }),
    [clearAccountScope, publish, runSwap, switchTo],
  );

  const signOutAllAccounts = useCallback(
    () =>
      runSwap(async () => {
        clearAccountScope();
        await forgetAllAccounts();
        setAccounts([]);
        await supabase.auth.signOut();
        await publish(null, false);
        clearAccountScope();
      }),
    [clearAccountScope, publish, runSwap],
  );

  const beginAddAccount = useCallback(() => {
    addReturnUserId.current = stateRef.current.user?.id ?? null;
    setAddingAccount(true);
  }, []);

  const finishAddAccount = useCallback(() => {
    addReturnUserId.current = null;
    setAddingAccount(false);
  }, []);

  const cancelAddAccount = useCallback(async () => {
    const target = addReturnUserId.current;
    addReturnUserId.current = null;
    setAddingAccount(false);

    const active = stateRef.current;
    // Nothing was signed in over the top, so the previous account is still live.
    if (!target || (target === active.user?.id && !active.mfaPending)) {
      if (!target) await supabase.auth.signOut();
      return;
    }
    // A half-authenticated sign-in is standing in the previous account's
    // place; restoring its stored session puts it back.
    await runSwap(() => switchTo(target));
  }, [runSwap, switchTo]);

  return (
    <AuthContext.Provider
      value={{
        ...state,
        accounts,
        switching,
        addingAccount,
        switchAccount,
        beginAddAccount,
        finishAddAccount,
        cancelAddAccount,
        signOutActiveAccount,
        signOutAllAccounts,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthValue {
  return useContext(AuthContext);
}
