export const API_BASE_URL = (process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:4000").replace(/\/$/, "");
const API_URL = API_BASE_URL;

export interface User {
  id: string;
  username: string;
  balance: number;
  createdAt: string;
}

export interface AuthResponse {
  message?: string;
  token?: string;
  user?: User;
  error?: string;
}

export interface DepositResponse {
  message: string;
  balance: number;
  transaction?: {
    id: string;
    amount: number;
    type: string;
    createdAt: string;
  };
  error?: string;
}

export const authApi = {
  async register(username: string, password: string): Promise<AuthResponse> {
    const res = await fetch(`${API_URL}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    return res.json();
  },

  async login(username: string, password: string): Promise<AuthResponse> {
    const res = await fetch(`${API_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    return res.json();
  },

  async getMe(token: string): Promise<{ user?: User; error?: string }> {
    const res = await fetch(`${API_URL}/api/auth/me`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    return res.json();
  },

  async mockDeposit(token: string): Promise<DepositResponse> {
    const res = await fetch(`${API_URL}/api/wallet/mock-deposit`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    return res.json();
  },
};
