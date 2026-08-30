import { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth } from "../lib/firebase";

interface AuthState {
  user: User | null;
  isAdmin: boolean;
  /** True until the very first auth check resolves — use this to avoid a
   * flash of "redirecting to login" before Firebase has had a chance to
   * report whether a session already exists. */
  loading: boolean;
}

const AuthContext = createContext<AuthState>({ user: null, isAdmin: false, loading: true });

export function useAuth() {
  return useContext(AuthContext);
}

/**
 * "Admin" is not a Firestore field or a role you assign in this app's UI —
 * it's a custom claim set on the Firebase Auth user via the Admin SDK (see
 * scripts/setAdminClaim.js). That claim rides along on the user's ID token,
 * which is what firestore.rules' isAdmin() actually checks. This provider
 * just reads that same claim client-side so the UI can react to it too.
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({ user: null, isAdmin: false, loading: true });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setState({ user: null, isAdmin: false, loading: false });
        return;
      }
      // force-refresh the token so a claim granted moments ago (e.g. right
      // after running setAdminClaim.js, followed by signing in again) is
      // picked up rather than a stale cached token without it.
      const tokenResult = await user.getIdTokenResult(true);
      setState({ user, isAdmin: tokenResult.claims.admin === true, loading: false });
    });
    return unsubscribe;
  }, []);

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>;
}
