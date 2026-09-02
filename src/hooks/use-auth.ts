import { useAuthActions } from "@convex-dev/auth/react";
import { useConvexAuth, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

export interface User {
  _id: string;
  _creationTime: number;
  name?: string;
  email?: string;
  image?: string;
  emailVerificationTime?: number;
  phone?: string;
  phoneVerificationTime?: number;
  isAnonymous?: boolean;
}

export interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  signOut: () => void;
  signInWithPassword: (email: string, password: string) => Promise<void>;
  signUpWithPassword: (email: string, password: string, name?: string) => Promise<void>;
}

export const useAuth = (): AuthContextType => {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const { signIn, signOut } = useAuthActions();
  
  const user = useQuery(api.users.currentUser);

  const signInWithPassword = async (email: string, password: string) => {
    try {
      await signIn("password", { email, password, flow: "signIn" });
    } catch (error) {
      throw new Error("Sign in failed. Please check your credentials.");
    }
  };

  const signUpWithPassword = async (email: string, password: string, _name?: string) => {
    try {
      await signIn("password", { email, password, flow: "signUp" });
      // Note: name will need to be updated separately after signup
    } catch (error) {
      throw new Error("Sign up failed. Please try again.");
    }
  };

  return {
    user: user || null,
    isAuthenticated,
    isLoading: isLoading || (isAuthenticated && user === undefined),
    signOut,
    signInWithPassword,
    signUpWithPassword,
  };
};