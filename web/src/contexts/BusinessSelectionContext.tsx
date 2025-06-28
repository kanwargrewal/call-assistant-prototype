'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Business } from '@/lib/api';
import { useAuth } from './AuthContext';

interface BusinessSelectionContextType {
  selectedBusiness: Business | null;
  setSelectedBusiness: (business: Business | null) => void;
  isAdminMode: boolean;
}

const BusinessSelectionContext = createContext<BusinessSelectionContextType | undefined>(undefined);

interface BusinessSelectionProviderProps {
  children: ReactNode;
}

export function BusinessSelectionProvider({ children }: BusinessSelectionProviderProps) {
  const [selectedBusiness, setSelectedBusiness] = useState<Business | null>(null);
  const { user } = useAuth();

  const isAdminMode = user?.role === 'admin';

  // Clear selection when user changes or logs out
  useEffect(() => {
    if (!user || user.role !== 'admin') {
      setSelectedBusiness(null);
    }
  }, [user]);

  // Store selection in localStorage for admin users
  useEffect(() => {
    if (isAdminMode && selectedBusiness) {
      localStorage.setItem('admin_selected_business', JSON.stringify(selectedBusiness));
    }
  }, [selectedBusiness, isAdminMode]);

  // Restore selection from localStorage for admin users
  useEffect(() => {
    if (isAdminMode && !selectedBusiness) {
      const stored = localStorage.getItem('admin_selected_business');
      if (stored) {
        try {
          const business = JSON.parse(stored);
          setSelectedBusiness(business);
        } catch (error) {
          console.error('Failed to restore selected business:', error);
          localStorage.removeItem('admin_selected_business');
        }
      }
    }
  }, [isAdminMode]);

  return (
    <BusinessSelectionContext.Provider
      value={{
        selectedBusiness,
        setSelectedBusiness,
        isAdminMode,
      }}
    >
      {children}
    </BusinessSelectionContext.Provider>
  );
}

export function useBusinessSelection() {
  const context = useContext(BusinessSelectionContext);
  if (context === undefined) {
    throw new Error('useBusinessSelection must be used within a BusinessSelectionProvider');
  }
  return context;
} 