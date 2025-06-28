'use client';

import { useState, useEffect } from 'react';
import { ChevronDownIcon, BuildingOfficeIcon } from '@heroicons/react/24/outline';
import { useBusinessSelection } from '@/contexts/BusinessSelectionContext';
import { Business, businessAPI } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';

export default function BusinessSelector() {
  const { user } = useAuth();
  const { selectedBusiness, setSelectedBusiness, isAdminMode } = useBusinessSelection();
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  // Only show for admin users
  if (!isAdminMode) {
    return null;
  }

  useEffect(() => {
    loadBusinesses();
  }, []);

  const loadBusinesses = async () => {
    setLoading(true);
    try {
      const businessList = await businessAPI.listAll();
      setBusinesses(businessList);
    } catch (error) {
      console.error('Failed to load businesses:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectBusiness = (business: Business) => {
    setSelectedBusiness(business);
    setIsOpen(false);
  };

  return (
    <div className="relative">
      <button
        type="button"
        className="flex items-center space-x-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-colors"
        onClick={() => setIsOpen(!isOpen)}
        disabled={loading}
      >
        <BuildingOfficeIcon className="h-4 w-4" />
        <span className="truncate max-w-40">
          {selectedBusiness ? selectedBusiness.name : 'Select Business'}
        </span>
        <ChevronDownIcon className="h-4 w-4" />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-600 z-50">
          <div className="p-2">
            <div className="text-xs font-medium text-gray-500 dark:text-gray-400 px-2 py-1 mb-1">
              Select Business to Manage
            </div>
            {loading ? (
              <div className="flex items-center justify-center py-4">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-purple-600"></div>
              </div>
            ) : businesses.length === 0 ? (
              <div className="text-sm text-gray-500 dark:text-gray-400 px-2 py-2">
                No businesses found
              </div>
            ) : (
              <div className="max-h-60 overflow-y-auto">
                {businesses.map((business) => (
                  <button
                    key={business.id}
                    className={`w-full text-left px-2 py-2 rounded text-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ${
                      selectedBusiness?.id === business.id
                        ? 'bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300'
                        : 'text-gray-900 dark:text-gray-100'
                    }`}
                    onClick={() => handleSelectBusiness(business)}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium">{business.name}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          Owner: {business.owner.first_name} {business.owner.last_name}
                        </div>
                      </div>
                      <div className={`w-2 h-2 rounded-full ${
                        business.is_active ? 'bg-green-400' : 'bg-red-400'
                      }`} />
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Click outside to close */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-40" 
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  );
} 