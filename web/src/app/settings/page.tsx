'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { businessAPI, apiConfigAPI, settingsAPI } from '@/lib/api';
import type { Business, ApiConfiguration, Settings } from '@/lib/api';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { useBusinessSelection } from '@/contexts/BusinessSelectionContext';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';
import {
  Cog6ToothIcon,
  BuildingOfficeIcon,
  BellIcon,
  PhoneIcon,
  ClockIcon,
  ChatBubbleLeftRightIcon,
  LinkIcon,
  EyeIcon,
  Squares2X2Icon,
  ListBulletIcon,
  RectangleStackIcon,
  SunIcon,
  MoonIcon,
  ComputerDesktopIcon,
  ArrowRightOnRectangleIcon,
} from '@heroicons/react/24/outline';
import BusinessSelector from '@/components/BusinessSelector';

interface SettingsTab {
  id: string;
  name: string;
  icon: React.ElementType;
  description: string;
}

const settingsTabs: SettingsTab[] = [
  {
    id: 'business',
    name: 'Business Info',
    icon: BuildingOfficeIcon,
    description: 'Manage your business details and contact information',
  },
  {
    id: 'appearance',
    name: 'Appearance',
    icon: EyeIcon,
    description: 'Customize dashboard layout and theme preferences',
  },
  {
    id: 'calls',
    name: 'Call Settings',
    icon: PhoneIcon,
    description: 'Configure call routing, recording, and AI behavior',
  },
  {
    id: 'notifications',
    name: 'Notifications',
    icon: BellIcon,
    description: 'Set up email and SMS notifications',
  },
  {
    id: 'hours',
    name: 'Business Hours',
    icon: ClockIcon,
    description: 'Configure operating hours and timezone',
  },
  {
    id: 'ai',
    name: 'AI Assistant',
    icon: ChatBubbleLeftRightIcon,
    description: 'Configure AI responses and behavior',
  },
  {
    id: 'integrations',
    name: 'Integrations',
    icon: LinkIcon,
    description: 'Manage webhooks and third-party integrations',
  },
];

const layoutOptions = [
  { value: 'grid', label: 'Grid View', icon: Squares2X2Icon, description: 'Cards in a grid layout' },
  { value: 'list', label: 'List View', icon: ListBulletIcon, description: 'Detailed list format' },
  { value: 'compact', label: 'Compact View', icon: RectangleStackIcon, description: 'Dense information display' },
];

const themeOptions = [
  { value: 'light', label: 'Light', icon: SunIcon, description: 'Light theme' },
  { value: 'dark', label: 'Dark', icon: MoonIcon, description: 'Dark theme' },
  { value: 'auto', label: 'Auto', icon: ComputerDesktopIcon, description: 'Follow system preference' },
];

export default function Settings() {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const { logout } = useAuth();
  const { selectedBusiness, isAdminMode } = useBusinessSelection();
  const [activeTab, setActiveTab] = useState('business');
  const [business, setBusiness] = useState<Business | null>(null);
  const [apiConfig, setApiConfig] = useState<ApiConfiguration | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Form states
  const [businessForm, setBusinessForm] = useState({
    name: '',
    description: '',
    owner_phone: '',
  });

  const [apiForm, setApiForm] = useState({
    openai_api_key: '',
    custom_instructions: '',
  });

  const [settingsForm, setSettingsForm] = useState({
    dashboard_layout: 'grid' as 'grid' | 'list' | 'compact',
    theme: 'light' as 'light' | 'dark' | 'auto',
    dashboard_refresh_interval: 30,
    call_recording_enabled: true,
    call_forwarding_timeout: 30,
    ai_takeover_delay: 10,
    email_notifications: true,
    sms_notifications: false,
    notification_email: '',
    notification_phone: '',
    timezone: 'UTC',
    custom_greeting: '',
    holiday_message: '',
    after_hours_message: '',
    webhook_url: '',
  });

  // Redirect admins with no business selected to system settings
  useEffect(() => {
    if (isAdminMode && !selectedBusiness) {
      router.push('/system-settings');
      return;
    }
    loadData();
  }, [isAdminMode, selectedBusiness, router]);

  // Update settings form theme when context theme changes
  useEffect(() => {
    setSettingsForm(prev => ({ ...prev, theme }));
  }, [theme]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError('');

      const businessId = isAdminMode ? selectedBusiness?.id : undefined;

      // Load business data
      const businessData = await businessAPI.getMy(businessId);
      setBusiness(businessData);
      setBusinessForm({
        name: businessData.name,
        description: businessData.description || '',
        owner_phone: businessData.owner_phone,
      });

      // Load API config
      try {
        const apiData = await apiConfigAPI.getMy(businessId);
        setApiConfig(apiData);
        setApiForm({
          openai_api_key: apiData.openai_api_key === '***hidden***' ? '' : apiData.openai_api_key,
          custom_instructions: apiData.custom_instructions || '',
        });
      } catch (err) {
        console.log('No API config found');
      }

      // Load settings
      try {
        const settingsData = await settingsAPI.getMy(businessId);
        setSettings(settingsData);
        setSettingsForm({
          dashboard_layout: settingsData.dashboard_layout,
          theme: settingsData.theme,
          dashboard_refresh_interval: settingsData.dashboard_refresh_interval,
          call_recording_enabled: settingsData.call_recording_enabled,
          call_forwarding_timeout: settingsData.call_forwarding_timeout,
          ai_takeover_delay: settingsData.ai_takeover_delay,
          email_notifications: settingsData.email_notifications,
          sms_notifications: settingsData.sms_notifications,
          notification_email: settingsData.notification_email || '',
          notification_phone: settingsData.notification_phone || '',
          timezone: settingsData.timezone,
          custom_greeting: settingsData.custom_greeting || '',
          holiday_message: settingsData.holiday_message || '',
          after_hours_message: settingsData.after_hours_message || '',
          webhook_url: settingsData.webhook_url || '',
        });
      } catch (err) {
        console.log('No settings found, will create defaults');
      }
    } catch (err) {
      setError('Failed to load settings');
      console.error('Error loading settings:', err);
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    try {
      setSaving(true);
      setError('');
      setSuccessMessage('');

      const businessId = isAdminMode ? selectedBusiness?.id : undefined;

      if (activeTab === 'business') {
        await businessAPI.update(business!.id, businessForm, businessId);
        setSuccessMessage('Business information updated successfully!');
      } else if (activeTab === 'ai') {
        if (apiConfig) {
          await apiConfigAPI.update(apiForm, businessId);
        } else {
          await apiConfigAPI.create(apiForm, businessId);
        }
        setSuccessMessage('AI configuration updated successfully!');
      } else {
        // Update general settings
        if (settings) {
          await settingsAPI.update(settingsForm, businessId);
        } else {
          await settingsAPI.create(settingsForm, businessId);
        }
        setSuccessMessage('Settings updated successfully!');
      }

      // Reload data
      await loadData();
    } catch (err) {
      setError('Failed to save settings');
      console.error('Error saving settings:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleThemeChange = async (newTheme: 'light' | 'dark' | 'auto') => {
    setSettingsForm({ ...settingsForm, theme: newTheme });
    // Apply theme immediately through context
    await setTheme(newTheme);
  };

  const renderBusinessSettings = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">Business Information</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Business Name *
            </label>
            <input
              type="text"
              value={businessForm.name}
              onChange={(e) => setBusinessForm({ ...businessForm, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Your Phone Number *
            </label>
            <input
              type="tel"
              value={businessForm.owner_phone}
              onChange={(e) => setBusinessForm({ ...businessForm, owner_phone: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              placeholder="We'll try to reach you first when customers call"
              required
            />
          </div>
        </div>

        <div className="mt-6">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Business Description
          </label>
          <textarea
            value={businessForm.description}
            onChange={(e) => setBusinessForm({ ...businessForm, description: e.target.value })}
            rows={4}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            placeholder="Tell us about your business..."
          />
        </div>
      </div>
    </div>
  );

  const renderAppearanceSettings = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">Dashboard Layout</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {layoutOptions.map((option) => (
            <button
              key={option.value}
              onClick={() => setSettingsForm({ ...settingsForm, dashboard_layout: option.value as any })}
              className={`p-4 border-2 rounded-lg text-left transition-all ${
                settingsForm.dashboard_layout === option.value
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                  : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 bg-white dark:bg-gray-800'
              }`}
            >
              <option.icon className="h-6 w-6 text-gray-600 dark:text-gray-400 mb-2" />
              <div className="font-medium text-gray-900 dark:text-gray-100">{option.label}</div>
              <div className="text-sm text-gray-500 dark:text-gray-400">{option.description}</div>
            </button>
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">Theme</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {themeOptions.map((option) => (
            <button
              key={option.value}
              onClick={() => handleThemeChange(option.value as any)}
              className={`p-4 border-2 rounded-lg text-left transition-all ${
                settingsForm.theme === option.value
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                  : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 bg-white dark:bg-gray-800'
              }`}
            >
              <option.icon className="h-6 w-6 text-gray-600 dark:text-gray-400 mb-2" />
              <div className="font-medium text-gray-900 dark:text-gray-100">{option.label}</div>
              <div className="text-sm text-gray-500 dark:text-gray-400">{option.description}</div>
            </button>
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">Refresh Settings</h3>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Dashboard Refresh Interval (seconds)
          </label>
          <select
            value={settingsForm.dashboard_refresh_interval}
            onChange={(e) => setSettingsForm({ ...settingsForm, dashboard_refresh_interval: parseInt(e.target.value) })}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
          >
            <option value={15}>15 seconds</option>
            <option value={30}>30 seconds</option>
            <option value={60}>1 minute</option>
            <option value={300}>5 minutes</option>
            <option value={0}>Manual refresh only</option>
          </select>
        </div>
      </div>
    </div>
  );

  const renderCallSettings = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">Call Recording</h3>
        <label className="flex items-center">
          <input
            type="checkbox"
            checked={settingsForm.call_recording_enabled}
            onChange={(e) => setSettingsForm({ ...settingsForm, call_recording_enabled: e.target.checked })}
            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700"
          />
          <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">Enable call recording</span>
        </label>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Call Forwarding Timeout (seconds)
          </label>
          <input
            type="number"
            value={settingsForm.call_forwarding_timeout}
            onChange={(e) => setSettingsForm({ ...settingsForm, call_forwarding_timeout: parseInt(e.target.value) })}
            min="10"
            max="60"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
          />
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">How long to ring your phone before routing to AI</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            AI Takeover Delay (seconds)
          </label>
          <input
            type="number"
            value={settingsForm.ai_takeover_delay}
            onChange={(e) => setSettingsForm({ ...settingsForm, ai_takeover_delay: parseInt(e.target.value) })}
            min="0"
            max="30"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
          />
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Delay before AI assistant starts speaking</p>
        </div>
      </div>
    </div>
  );

  const renderNotificationSettings = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">Notification Preferences</h3>
        <div className="space-y-4">
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={settingsForm.email_notifications}
              onChange={(e) => setSettingsForm({ ...settingsForm, email_notifications: e.target.checked })}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700"
            />
            <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">Email notifications</span>
          </label>

          <label className="flex items-center">
            <input
              type="checkbox"
              checked={settingsForm.sms_notifications}
              onChange={(e) => setSettingsForm({ ...settingsForm, sms_notifications: e.target.checked })}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700"
            />
            <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">SMS notifications</span>
          </label>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Notification Email
          </label>
          <input
            type="email"
            value={settingsForm.notification_email}
            onChange={(e) => setSettingsForm({ ...settingsForm, notification_email: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            placeholder="notifications@yourcompany.com"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Notification Phone
          </label>
          <input
            type="tel"
            value={settingsForm.notification_phone}
            onChange={(e) => setSettingsForm({ ...settingsForm, notification_phone: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            placeholder="+1234567890"
          />
        </div>
      </div>
    </div>
  );

  const renderAISettings = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">OpenAI Configuration</h3>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            OpenAI API Key *
          </label>
          <input
            type="password"
            value={apiForm.openai_api_key}
            onChange={(e) => setApiForm({ ...apiForm, openai_api_key: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            placeholder="sk-..."
            required
          />
        </div>
      </div>

      <div>
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">AI Behavior</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Custom Instructions
            </label>
            <textarea
              value={apiForm.custom_instructions}
              onChange={(e) => setApiForm({ ...apiForm, custom_instructions: e.target.value })}
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              placeholder="Additional instructions for the AI assistant..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Custom Greeting
            </label>
            <textarea
              value={settingsForm.custom_greeting}
              onChange={(e) => setSettingsForm({ ...settingsForm, custom_greeting: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              placeholder="Hello! Thank you for calling..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              After Hours Message
            </label>
            <textarea
              value={settingsForm.after_hours_message}
              onChange={(e) => setSettingsForm({ ...settingsForm, after_hours_message: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              placeholder="We're currently closed. Please call back during business hours..."
            />
          </div>
        </div>
      </div>
    </div>
  );

  const renderTabContent = () => {
    switch (activeTab) {
      case 'business':
        return renderBusinessSettings();
      case 'appearance':
        return renderAppearanceSettings();
      case 'calls':
        return renderCallSettings();
      case 'notifications':
        return renderNotificationSettings();
      case 'ai':
        return renderAISettings();
      default:
        return <div className="text-gray-500 dark:text-gray-400">Coming soon...</div>;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => router.push('/dashboard')}
                className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                <ArrowLeftIcon className="h-5 w-5" />
              </button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  {isAdminMode ? `Settings: ${business?.name}` : 'Settings'}
                </h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {isAdminMode ? 'Managing business configuration' : 'Manage your business configuration and AI assistant settings'}
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              {/* Business Selector for Admin Users */}
              {isAdminMode && <BusinessSelector />}
              
              <button
                onClick={logout}
                title="Logout"
                className="flex items-center space-x-2 px-3 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                <ArrowRightOnRectangleIcon className="h-5 w-5" />
                <span className="text-sm font-medium">Logout</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="lg:grid lg:grid-cols-12 lg:gap-8">
          {/* Sidebar */}
          <div className="lg:col-span-3">
            <nav className="space-y-1">
              {settingsTabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-start px-3 py-3 text-sm font-medium rounded-lg transition-colors ${
                    activeTab === tab.id
                      ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border-l-4 border-blue-700 dark:border-blue-300'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-800'
                  }`}
                >
                  <tab.icon className="flex-shrink-0 h-5 w-5 mr-3" />
                  <div className="text-left">
                    <div>{tab.name}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 font-normal">{tab.description}</div>
                  </div>
                </button>
              ))}
            </nav>
          </div>

          {/* Main content */}
          <div className="mt-8 lg:mt-0 lg:col-span-9">
            <div className="bg-white dark:bg-gray-800 shadow-sm rounded-lg border border-gray-200 dark:border-gray-700">
              <div className="px-6 py-8">
                {error && (
                  <div className="mb-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-3 rounded-lg">
                    {error}
                  </div>
                )}

                {successMessage && (
                  <div className="mb-6 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-300 px-4 py-3 rounded-lg">
                    {successMessage}
                  </div>
                )}

                {renderTabContent()}

                <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
                  <div className="flex justify-end">
                    <button
                      onClick={saveSettings}
                      disabled={saving}
                      className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {saving ? 'Saving...' : 'Save Changes'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 