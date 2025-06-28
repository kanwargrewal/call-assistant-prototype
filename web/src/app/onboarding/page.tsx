'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { businessAPI, phoneAPI, apiConfigAPI } from '@/lib/api';

interface BusinessSetup {
  name: string;
  description: string;
  owner_phone: string;
}

interface PhoneSetup {
  area_code: string;
  country: string;
  selected_number: string;
}

interface ApiSetup {
  openai_api_key: string;
  custom_instructions: string;
}

export default function OnboardingPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form data
  const [businessData, setBusinessData] = useState<BusinessSetup>({
    name: '',
    description: '',
    owner_phone: ''
  });

  const [phoneData, setPhoneData] = useState<PhoneSetup>({
    area_code: '',
    country: 'US',
    selected_number: ''
  });

  const [apiData, setApiData] = useState<ApiSetup>({
    openai_api_key: '',
    custom_instructions: ''
  });

  const [availableNumbers, setAvailableNumbers] = useState<any[]>([]);

  useEffect(() => {
    // Middleware handles authentication, no need to check here
  }, [user, router, authLoading]);

  const handleBusinessSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await businessAPI.create(businessData);
      setCurrentStep(2);
    } catch (error: any) {
      setError(error.response?.data?.detail || 'Failed to create business');
    } finally {
      setLoading(false);
    }
  };

  const searchPhoneNumbers = async () => {
    if (!phoneData.area_code) return;
    
    setLoading(true);
    try {
      const numbers = await phoneAPI.search(phoneData.area_code, phoneData.country);
      setAvailableNumbers(numbers || []);
    } catch (error: any) {
      setError('Failed to search phone numbers');
    } finally {
      setLoading(false);
    }
  };

  const handlePhoneSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phoneData.selected_number) {
      setError('Please select a phone number');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await phoneAPI.purchase(
        phoneData.selected_number,
        phoneData.area_code,
        phoneData.country
      );
      setCurrentStep(3);
    } catch (error: any) {
      setError(error.response?.data?.detail || 'Failed to purchase phone number');
    } finally {
      setLoading(false);
    }
  };

  const handleApiSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await apiConfigAPI.create(apiData);
      router.push('/dashboard');
    } catch (error: any) {
      setError('Failed to save API configuration');
    } finally {
      setLoading(false);
    }
  };

  const steps = [
    { number: 1, name: 'Business Info', description: 'Tell us about your business' },
    { number: 2, name: 'Phone Number', description: 'Get your business phone number' },
    { number: 3, name: 'AI Configuration', description: 'Set up your AI assistant' }
  ];

  // Show loading while auth is being checked
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="spinner"></div>
      </div>
    );
  }

  if (!user) {
    return <div>Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Progress Steps */}
        <div className="mb-8">
          <nav aria-label="Progress">
            <ol role="list" className="flex items-center">
              {steps.map((step, stepIdx) => (
                <li key={step.name} className={`${stepIdx !== steps.length - 1 ? 'pr-8 sm:pr-20' : ''} relative`}>
                  <div className="flex items-center">
                    <div className={`relative flex h-8 w-8 items-center justify-center rounded-full ${
                      currentStep > step.number 
                        ? 'bg-indigo-600' 
                        : currentStep === step.number 
                        ? 'bg-indigo-600' 
                        : 'bg-gray-300'
                    }`}>
                      <span className="text-white font-medium text-sm">{step.number}</span>
                    </div>
                    <span className="ml-4 text-sm font-medium text-gray-900">{step.name}</span>
                  </div>
                  {stepIdx !== steps.length - 1 && (
                    <div className={`absolute top-4 left-4 -ml-px h-0.5 w-full ${
                      currentStep > step.number ? 'bg-indigo-600' : 'bg-gray-300'
                    }`} />
                  )}
                </li>
              ))}
            </ol>
          </nav>
        </div>

        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-md p-4">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {/* Step 1: Business Information */}
        {currentStep === 1 && (
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Tell us about your business</h2>
            <form onSubmit={handleBusinessSubmit} className="space-y-6">
              <div>
                <label htmlFor="business_name" className="block text-sm font-medium text-gray-700">
                  Business Name *
                </label>
                <input
                  type="text"
                  id="business_name"
                  required
                  value={businessData.name}
                  onChange={(e) => setBusinessData(prev => ({ ...prev, name: e.target.value }))}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  placeholder="e.g. Acme Pizza"
                />
              </div>

              <div>
                <label htmlFor="description" className="block text-sm font-medium text-gray-700">
                  Business Description
                </label>
                <textarea
                  id="description"
                  rows={3}
                  value={businessData.description}
                  onChange={(e) => setBusinessData(prev => ({ ...prev, description: e.target.value }))}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  placeholder="Brief description of your business"
                />
              </div>

              <div>
                <label htmlFor="owner_phone" className="block text-sm font-medium text-gray-700">
                  Your Phone Number *
                </label>
                <input
                  type="tel"
                  id="owner_phone"
                  required
                  value={businessData.owner_phone}
                  onChange={(e) => setBusinessData(prev => ({ ...prev, owner_phone: e.target.value }))}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  placeholder="+1 (555) 123-4567"
                />
                <p className="mt-1 text-sm text-gray-500">
                  We'll try to reach you first when customers call, before routing to AI
                </p>
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={loading}
                  className="bg-indigo-600 text-white px-6 py-2 rounded-md hover:bg-indigo-700 disabled:opacity-50"
                >
                  {loading ? 'Creating...' : 'Continue'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Step 2: Phone Number */}
        {currentStep === 2 && (
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Get your business phone number</h2>
            
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="country" className="block text-sm font-medium text-gray-700">
                    Country
                  </label>
                  <select
                    id="country"
                    value={phoneData.country}
                    onChange={(e) => setPhoneData(prev => ({ ...prev, country: e.target.value }))}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  >
                    <option value="US">United States</option>
                    <option value="CA">Canada</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="area_code" className="block text-sm font-medium text-gray-700">
                    Area Code
                  </label>
                  <input
                    type="text"
                    id="area_code"
                    maxLength={3}
                    value={phoneData.area_code}
                    onChange={(e) => setPhoneData(prev => ({ ...prev, area_code: e.target.value }))}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    placeholder="415"
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={searchPhoneNumbers}
                disabled={!phoneData.area_code || loading}
                className="bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700 disabled:opacity-50"
              >
                {loading ? 'Searching...' : 'Search Available Numbers'}
              </button>

              {availableNumbers.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Select a Phone Number
                  </label>
                  <div className="grid grid-cols-1 gap-2 max-h-60 overflow-y-auto">
                    {availableNumbers.map((number, index) => (
                      <label key={index} className="flex items-center p-3 border rounded-md hover:bg-gray-50">
                        <input
                          type="radio"
                          name="phone_number"
                          value={number.phone_number}
                          checked={phoneData.selected_number === number.phone_number}
                          onChange={(e) => setPhoneData(prev => ({ ...prev, selected_number: e.target.value }))}
                          className="mr-3"
                        />
                        <span className="font-mono text-lg">{number.friendly_name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex justify-between">
                <button
                  type="button"
                  onClick={() => setCurrentStep(1)}
                  className="bg-gray-300 text-gray-700 px-6 py-2 rounded-md hover:bg-gray-400"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={handlePhoneSubmit}
                  disabled={!phoneData.selected_number || loading}
                  className="bg-indigo-600 text-white px-6 py-2 rounded-md hover:bg-indigo-700 disabled:opacity-50"
                >
                  {loading ? 'Purchasing...' : 'Purchase Number'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Step 3: API Configuration */}
        {currentStep === 3 && (
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Configure your AI assistant</h2>
            <form onSubmit={handleApiSubmit} className="space-y-6">
              <div>
                <label htmlFor="openai_api_key" className="block text-sm font-medium text-gray-700">
                  OpenAI API Key *
                </label>
                <input
                  type="password"
                  id="openai_api_key"
                  required
                  value={apiData.openai_api_key}
                  onChange={(e) => setApiData(prev => ({ ...prev, openai_api_key: e.target.value }))}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  placeholder="sk-..."
                />
                <p className="mt-1 text-sm text-gray-500">
                  Get your API key from <a href="https://platform.openai.com/api-keys" target="_blank" className="text-indigo-600 hover:underline">OpenAI Platform</a>
                </p>
              </div>

              <div>
                <label htmlFor="custom_instructions" className="block text-sm font-medium text-gray-700">
                  Custom Instructions for AI Assistant
                </label>
                <textarea
                  id="custom_instructions"
                  rows={4}
                  value={apiData.custom_instructions}
                  onChange={(e) => setApiData(prev => ({ ...prev, custom_instructions: e.target.value }))}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  placeholder="e.g. You are a helpful assistant for a pizza restaurant. Take orders, provide information about our menu, and help customers with their questions."
                />
                <p className="mt-1 text-sm text-gray-500">
                  Tell the AI how to behave when answering calls for your business
                </p>
              </div>

              <div className="flex justify-between">
                <button
                  type="button"
                  onClick={() => setCurrentStep(2)}
                  className="bg-gray-300 text-gray-700 px-6 py-2 rounded-md hover:bg-gray-400"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="bg-indigo-600 text-white px-6 py-2 rounded-md hover:bg-indigo-700 disabled:opacity-50"
                >
                  {loading ? 'Setting up...' : 'Complete Setup'}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
} 