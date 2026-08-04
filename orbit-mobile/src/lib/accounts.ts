import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Session } from "@supabase/supabase-js";

/**
 * The accounts signed in on this device, so switching between them does not
 * mean signing in again.
 *
 * A stored `session` is a live credential and is treated exactly like the one
 * the Supabase client persists: same AsyncStorage, never logged, never put in
 * the react-query cache, never sent anywhere. Callers outside this module get
 * `AccountIdentity` values, which carry no tokens; only the auth provider
 * reads a session back out, to hand it straight to `setSession`.
 */

const ACCOUNTS_KEY = "orbit-accounts";

// Five identities still fit the switcher without scrolling on a small phone.
const MAX_STORED_ACCOUNTS = 5;

/** What the switcher renders. Deliberately credential-free. */
export interface AccountIdentity {
  userId: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  /** Prefills the login form when a stored session turns out to be dead. */
  email: string | null;
}

export interface StoredAccount extends AccountIdentity {
  session: Session;
}

/** The profile fields the switcher shows, resolved at sign-in time. */
export interface AccountProfile {
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
}

function isStoredAccount(value: unknown): value is StoredAccount {
  if (typeof value !== "object" || value === null) return false;
  const { userId, username, session } = value as Partial<StoredAccount>;
  return (
    typeof userId === "string" &&
    typeof username === "string" &&
    typeof session === "object" &&
    session !== null &&
    typeof session.access_token === "string" &&
    typeof session.refresh_token === "string"
  );
}

async function readAll(): Promise<StoredAccount[]> {
  try {
    const raw = await AsyncStorage.getItem(ACCOUNTS_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    return Array.isArray(parsed) ? parsed.filter(isStoredAccount) : [];
  } catch {
    // An unreadable list must not block signing in; the live session still
    // works and this device just forgets its other accounts.
    return [];
  }
}

async function writeAll(accounts: StoredAccount[]): Promise<void> {
  await AsyncStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
}

function identityOf(account: StoredAccount): AccountIdentity {
  return {
    userId: account.userId,
    username: account.username,
    displayName: account.displayName,
    avatarUrl: account.avatarUrl,
    email: account.email,
  };
}

export async function listAccountIdentities(): Promise<AccountIdentity[]> {
  return (await readAll()).map(identityOf);
}

/**
 * Adds a newly authenticated account, or refreshes what is stored for one
 * already on the device. Insertion order is kept so the switcher never
 * reshuffles under the finger; the oldest entry drops once the list is full.
 */
export async function rememberAccount(
  session: Session,
  profile: AccountProfile,
): Promise<void> {
  const accounts = await readAll();
  const entry: StoredAccount = {
    userId: session.user.id,
    username: profile.username,
    displayName: profile.displayName,
    avatarUrl: profile.avatarUrl,
    email: session.user.email ?? null,
    session,
  };

  const index = accounts.findIndex((a) => a.userId === entry.userId);
  if (index >= 0) accounts[index] = entry;
  else accounts.push(entry);

  await writeAll(accounts.slice(-MAX_STORED_ACCOUNTS));
}

/**
 * Keeps a stored session in step with a token refresh, so switching back to
 * an account weeks later does not hand `setSession` a token the server has
 * already rotated away. No-op for an account this device does not store.
 */
export async function updateStoredSession(session: Session): Promise<void> {
  const accounts = await readAll();
  const index = accounts.findIndex((a) => a.userId === session.user.id);
  if (index < 0) return;
  accounts[index] = {
    ...accounts[index],
    email: session.user.email ?? accounts[index].email,
    session,
  };
  await writeAll(accounts);
}

export async function readStoredAccount(
  userId: string,
): Promise<StoredAccount | null> {
  return (await readAll()).find((a) => a.userId === userId) ?? null;
}

export async function forgetAccount(userId: string): Promise<void> {
  const accounts = await readAll();
  await writeAll(accounts.filter((a) => a.userId !== userId));
}

export async function forgetAllAccounts(): Promise<void> {
  await AsyncStorage.removeItem(ACCOUNTS_KEY);
}
