import React, { createContext, useState, useContext, useEffect } from 'react';

interface User {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  isAdmin?: boolean;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, firstName: string, lastName: string, phone?: string) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Carregar token do localStorage ao iniciar
  useEffect(() => {
    const savedToken = localStorage.getItem('authToken');
    if (savedToken) {
      setToken(savedToken);
      // Verificar se token é válido
      verifyToken(savedToken);
    } else {
      setLoading(false);
    }
  }, []);

  async function verifyToken(token: string) {
    try {
      const response = await fetch('http://localhost:5001/api/auth/me', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const userData = await response.json();
        setUser(userData);
      } else {
        localStorage.removeItem('authToken');
        setToken(null);
      }
    } catch (error) {
      console.error('Erro ao verificar token:', error);
      localStorage.removeItem('authToken');
      setToken(null);
    } finally {
      setLoading(false);
    }
  }

  async function login(email: string, password: string) {
    try {
      const response = await fetch('http://localhost:5001/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        throw new Error('Email ou senha inválidos');
      }

      const data = await response.json();
      setToken(data.token);
      setUser(data.user);
      localStorage.setItem('authToken', data.token);
    } catch (error) {
      throw error;
    }
  }

  async function register(email: string, password: string, firstName: string, lastName: string, phone?: string) {
    try {
      const response = await fetch('http://localhost:5001/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password, firstName, lastName, phone }),
      });

      if (!response.ok) {
        throw new Error('Erro ao registrar');
      }

      const data = await response.json();
      setToken(data.token);
      setUser(data.user);
      localStorage.setItem('authToken', data.token);
    } catch (error) {
      throw error;
    }
  }

  function logout() {
    setUser(null);
    setToken(null);
    localStorage.removeItem('authToken');
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        login,
        register,
        logout,
        isAuthenticated: !!user,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth deve ser usado dentro de AuthProvider');
  }
  return context;
}
