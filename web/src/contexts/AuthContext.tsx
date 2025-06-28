'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { authAPI, businessAPI } from '@/lib/api';
import toast from 'react-hot-toast';

export interface User {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  role: 'admin' | 'business_owner';
  is_active: boolean;
  created_at: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  register: (data: RegisterData, inviteToken?: string) => Promise<boolean>;
  checkNeedsOnboarding: () => Promise<boolean>;
}

interface RegisterData {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  // Check if user is authenticated on mount
  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      let token = localStorage.getItem('token');
      
      // If no token in localStorage, check cookies
      if (!token) {
        const cookies = document.cookie.split(';');
        const tokenCookie = cookies.find(cookie => cookie.trim().startsWith('token='));
        if (tokenCookie) {
          token = tokenCookie.split('=')[1];
          // Sync it back to localStorage
          localStorage.setItem('token', token);
        }
      }
      
      if (!token) {
        setLoading(false);
        return;
      }

      const userData = await authAPI.getMe();
      setUser(userData);
    } catch (error) {
      localStorage.removeItem('token');
      // Remove cookie on error
      document.cookie = 'token=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT;';
      console.error('Auth check failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const checkNeedsOnboarding = async (): Promise<boolean> => {
    try {
      // For business owners, check if they have a business
      if (user?.role === 'business_owner') {
        await businessAPI.getMy();
        return false; // Business exists, no onboarding needed
      }
      
      // Admin users don't need onboarding
      return false;
    } catch (error: any) {
      // If error is 404, user needs onboarding
      if (error.response?.status === 404) {
        return true;
      }
      
      console.error('Error checking onboarding status:', error);
      return false; // Default to no onboarding on other errors
    }
  };

  const login = async (email: string, password: string): Promise<boolean> => {
    try {
      const response = await authAPI.login({ email, password });
      
      // Store in both localStorage and cookies
      localStorage.setItem('token', response.access_token);
      document.cookie = `token=${response.access_token}; path=/; max-age=${30 * 24 * 60 * 60}`; // 30 days
      
      // Get user data
      const userData = await authAPI.getMe();
      setUser(userData);
      
      toast.success('Login successful!');
      return true;
    } catch (error: any) {
      toast.error(error.message || 'Login failed');
      return false;
    }
  };

  const register = async (data: RegisterData, inviteToken?: string): Promise<boolean> => {
    try {
      await authAPI.register(data, inviteToken);
      toast.success('Registration successful! Please login.');
      return true;
    } catch (error: any) {
      toast.error(error.message || 'Registration failed');
      return false;
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    // Remove cookie
    document.cookie = 'token=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT;';
    setUser(null);
    router.push('/login');
    toast.success('Logged out successfully');
  };

  const value: AuthContextType = {
    user,
    loading,
    login,
    logout,
    register,
    checkNeedsOnboarding,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
} 