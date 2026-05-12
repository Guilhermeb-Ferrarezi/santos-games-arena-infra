export type AuthProvider = "google" | "discord" | "steam";

export type AuthHealthResponse = {
  status: "ok";
  service: "auth-api";
};

export type AuthSession = {
  id: string;
  userId: string;
  expiresAt: string;
};

export type AuthSessionResponse =
  | {
      authenticated: false;
      user: null;
    }
  | {
      authenticated: true;
      user: {
        id: number;
        email: string;
        login: string;
      };
    };
