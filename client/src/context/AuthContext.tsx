import React, { createContext, useContext, useState, useEffect } from 'react';
import { apiRequest, getAuthToken, setAuthToken, removeAuthToken } from '../api/client';
import { disconnectSocket } from '../api/socket';

export interface User {
  id: string;
  student_id: string;
  email: string;
  username: string;
  full_name: string;
  course?: string;
  college?: string;
  academic_year?: string;
  bio?: string;
  avatar_url?: string;
  is_verified: number;
  availability?: string;
}

interface RegisterResult {
  message: string;
  unverified: boolean;
  email: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (identifier: string, pass: string) => Promise<void>;
  register: (formData: any) => Promise<RegisterResult>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = async () => {
    try {
      const token = getAuthToken();
      if (!token) {
        setUser(null);
        setLoading(false);
        return;
      }
      const data = await apiRequest<{ user: User }>('/auth/me');
      setUser(data.user);
    } catch {
      setUser(null);
      removeAuthToken();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshUser();

    const handleUnauthorized = () => {
      setUser(null);
      disconnectSocket();
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('studysync:unauthorized', handleUnauthorized);
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('studysync:unauthorized', handleUnauthorized);
      }
    };
  }, []);

  const login = async (identifier: string, pass: string) => {
    disconnectSocket();
    const data = await apiRequest<{ token: string; user: User }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ identifier, password: pass }),
    });
    setAuthToken(data.token);
    setUser(data.user);
  };

  const register = async (formData: any): Promise<RegisterResult> => {
    const data = await apiRequest<RegisterResult>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(formData),
    });
    return data;
  };

  const logout = async () => {
    try {
      await apiRequest('/auth/logout', { method: 'POST' });
    } catch {
      // Ignore network errors on logout
    }
    disconnectSocket();
    removeAuthToken();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
