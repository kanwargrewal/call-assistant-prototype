'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { businessAPI, settingsAPI } from '@/lib/api';
import type { DashboardData, Settings, Business } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { useBusinessSelection } from '@/contexts/BusinessSelectionContext';
import BusinessSelector from '@/components/BusinessSelector';
import {
  PhoneIcon,
  UserGroupIcon,
  CpuChipIcon,
  ClockIcon,
  CurrencyDollarIcon,
  Cog6ToothIcon,
  Squares2X2Icon,
  ListBulletIcon,
  RectangleStackIcon,
  ArrowPathIcon,
  EyeIcon,
  ArrowRightOnRectangleIcon,
  ExclamationTriangleIcon,
  BuildingOfficeIcon,
} from '@heroicons/react/24/outline';

interface LayoutToggleProps {
  currentLayout: 'grid' | 'list' | 'compact';
  onLayoutChange: (layout: 'grid' | 'list' | 'compact') => void;
}

const LayoutToggle = ({ currentLayout, onLayoutChange }: LayoutToggleProps) => {
  const layouts = [
    { value: 'grid', icon: Squares2X2Icon, tooltip: 'Grid View' },
    { value: 'list', icon: ListBulletIcon, tooltip: 'List View' },
    { value: 'compact', icon: RectangleStackIcon, tooltip: 'Compact View' },
  ];

  return (
    <div className="flex items-center space-x-1 bg-gray-100 dark:bg-gray-700 p-1 rounded-lg">
      {layouts.map((layout) => (
        <button
          key={layout.value}
          onClick={() => onLayoutChange(layout.value as any)}
          className={`p-2 rounded-md transition-all ${
            currentLayout === layout.value
              ? 'bg-white dark:bg-gray-600 shadow-sm text-blue-600 dark:text-blue-400'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600'
          }`}
          title={layout.tooltip}
        >
          <layout.icon className="h-4 w-4" />
        </button>
      ))}
    </div>
  );
};

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ElementType;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  color: 'blue' | 'green' | 'purple' | 'orange' | 'red';
  layout: 'grid' | 'list' | 'compact';
}

const StatCard = ({ title, value, subtitle, icon: Icon, trend, color, layout }: StatCardProps) => {
  const colorClasses = {
    blue: 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800',
    green: 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 border-green-200 dark:border-green-800',
    purple: 'bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-800',
    orange: 'bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 border-orange-200 dark:border-orange-800',
    red: 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800',
  };

  if (layout === 'compact') {
    return (
      <div className="flex items-center justify-between p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:shadow-sm transition-shadow">
        <div className="flex items-center space-x-3">
          <div className={`p-2 rounded-md ${colorClasses[color]}`}>
            <Icon className="h-4 w-4" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{title}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">{subtitle}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">{value}</p>
          {trend && (
            <p className={`text-xs ${trend.isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
              {trend.isPositive ? '+' : ''}{trend.value}%
            </p>
          )}
        </div>
      </div>
    );
  }

  if (layout === 'list') {
    return (
      <div className="flex items-center justify-between p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow">
        <div className="flex items-center space-x-4">
          <div className={`p-3 rounded-lg ${colorClasses[color]}`}>
            <Icon className="h-6 w-6" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{title}</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">{subtitle}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{value}</p>
          {trend && (
            <p className={`text-sm ${trend.isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
              {trend.isPositive ? '↗' : '↘'} {Math.abs(trend.value)}%
            </p>
          )}
        </div>
      </div>
    );
  }

  // Grid layout (default)
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 hover:shadow-lg transition-all duration-200 hover:border-gray-300 dark:hover:border-gray-600">
      <div className="flex items-center justify-between mb-4">
        <div className={`p-3 rounded-lg ${colorClasses[color]}`}>
          <Icon className="h-6 w-6" />
        </div>
        {trend && (
          <div className={`flex items-center text-sm ${trend.isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
            <span className="font-medium">{trend.isPositive ? '+' : ''}{trend.value}%</span>
          </div>
        )}
      </div>
      <div>
        <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">{title}</h3>
        <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">{value}</p>
        {subtitle && <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{subtitle}</p>}
      </div>
    </div>
  );
};

export default function Dashboard() {
  const router = useRouter();
  const { logout, user, checkNeedsOnboarding } = useAuth();
  const { selectedBusiness, isAdminMode } = useBusinessSelection();
  const [data, setData] = useState<DashboardData | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [business, setBusiness] = useState<Business | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [isCheckingOnboarding, setIsCheckingOnboarding] = useState(true);

  // Local layout state (can override settings)
  const [layout, setLayout] = useState<'grid' | 'list' | 'compact'>('grid');

  // Check if we should load data (admin needs business selected)
  const canLoadData = !isAdminMode || selectedBusiness;

  // Redirect admins with no business selected to system settings
  useEffect(() => {
    if (isAdminMode && !selectedBusiness) {
      router.push('/system-settings');
      return;
    }
  }, [isAdminMode, selectedBusiness, router]);

  // Check onboarding status for business owners
  useEffect(() => {
    const checkOnboarding = async () => {
      if (user && user.role === 'business_owner') {
        try {
          const needsOnboarding = await checkNeedsOnboarding();
          if (needsOnboarding) {
            router.push('/onboarding');
            return;
          }
        } catch (error) {
          console.error('Error checking onboarding:', error);
        }
      }
      setIsCheckingOnboarding(false);
    };

    if (user) {
      checkOnboarding();
    }
  }, [user, checkNeedsOnboarding, router]);

  // Load data when dependencies change
  useEffect(() => {
    if (canLoadData && !isCheckingOnboarding) {
      loadData();
    }
  }, [canLoadData, selectedBusiness, isCheckingOnboarding]);

  // Auto-refresh data
  useEffect(() => {
    if (!settings?.dashboard_refresh_interval || settings.dashboard_refresh_interval === 0 || !canLoadData) {
      return;
    }

    const interval = setInterval(() => {
      if (!loading && !refreshing) {
        loadData(true);
      }
    }, settings.dashboard_refresh_interval * 1000);

    return () => clearInterval(interval);
  }, [settings?.dashboard_refresh_interval, canLoadData]);

  const loadData = async (refresh = false) => {
    if (!canLoadData) return;
    
    try {
      setLoading(true);
      setError('');

      const businessId = isAdminMode ? selectedBusiness?.id : undefined;

      // Load dashboard data and settings in parallel
      const [dashboardData, settingsData] = await Promise.all([
        businessAPI.getDashboard(businessId),
        settingsAPI.getMy(businessId).catch(() => null), // Don't fail if no settings yet
      ]);

      setData(dashboardData);
      if (settingsData) {
        setSettings(settingsData);
        setLayout(settingsData.dashboard_layout);
      }
      setLastRefresh(new Date());
    } catch (err) {
      setError('Failed to load dashboard data');
      console.error('Error loading dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  const refreshData = async () => {
    setRefreshing(true);
    await loadData(true);
    setRefreshing(false);
  };

  const handleLayoutChange = async (newLayout: 'grid' | 'list' | 'compact') => {
    setLayout(newLayout);
    
    // Save to backend if we have settings
    if (settings) {
      try {
        const businessId = isAdminMode ? selectedBusiness?.id : undefined;
        await settingsAPI.update({ dashboard_layout: newLayout }, businessId);
        setSettings({ ...settings, dashboard_layout: newLayout });
      } catch (err) {
        console.error('Error saving layout preference:', err);
      }
    }
  };

  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const getGridClasses = () => {
    switch (layout) {
      case 'list':
        return 'space-y-4';
      case 'compact':
        return 'grid grid-cols-1 lg:grid-cols-2 gap-4';
      default: // grid
        return 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6';
    }
  };

  // Helper function to handle settings navigation
  const handleSettingsClick = () => {
    // If admin with no business selected, go to system settings
    if (isAdminMode && !selectedBusiness) {
      router.push('/system-settings');
    } else {
      // Business owner or admin with selected business goes to regular settings
      router.push('/settings');
    }
  };

  // Show business selection prompt for admins
  if (isAdminMode && !selectedBusiness) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors">
        {/* Header */}
        <header className="bg-white dark:bg-gray-800 shadow border-b border-gray-200 dark:border-gray-700 transition-colors">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              <div className="flex items-center space-x-4">
                <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Dashboard</h1>
              </div>
              <div className="flex items-center space-x-4">
                <BusinessSelector />
                <button
                  onClick={handleSettingsClick}
                  className="flex items-center space-x-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 px-3 py-2 rounded-lg transition-colors"
                >
                  <Cog6ToothIcon className="h-4 w-4" />
                  <span className="text-sm font-medium text-gray-900 dark:text-gray-100">Settings</span>
                </button>
                <button
                  onClick={logout}
                  className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 dark:focus:ring-offset-gray-800 transition-colors"
                >
                  <ArrowRightOnRectangleIcon className="h-4 w-4 mr-2" />
                  Logout
                </button>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="max-w-7xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <ExclamationTriangleIcon className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500" />
            <h2 className="mt-4 text-lg font-medium text-gray-900 dark:text-gray-100">
              Select a Business
            </h2>
            <p className="mt-2 text-gray-600 dark:text-gray-400">
              Please select a business from the dropdown above to view its dashboard.
            </p>
          </div>
        </main>
      </div>
    );
  }

  // Show loading while checking onboarding status
  if (isCheckingOnboarding) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">No Data Available</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-4">Unable to load dashboard data.</p>
          <button
            onClick={() => loadData()}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  const stats = [
    {
      title: 'Total Calls',
      value: data.call_summary.total_calls,
      subtitle: 'All time',
      icon: PhoneIcon,
      color: 'blue' as const,
      trend: data.call_summary.total_calls > 0 ? { value: 12, isPositive: true } : undefined,
    },
    {
      title: 'Human Calls',
      value: data.call_summary.human_calls,
      subtitle: 'Answered by owner',
      icon: UserGroupIcon,
      color: 'green' as const,
      trend: data.call_summary.human_calls > 0 ? { value: 8, isPositive: true } : undefined,
    },
    {
      title: 'AI Calls',
      value: data.call_summary.ai_calls,
      subtitle: 'Handled by assistant',
      icon: CpuChipIcon,
      color: 'purple' as const,
      trend: data.call_summary.ai_calls > 0 ? { value: 15, isPositive: true } : undefined,
    },
    {
      title: 'Avg Duration',
      value: formatDuration(Math.round(data.call_summary.average_duration)),
      subtitle: 'Per call',
      icon: ClockIcon,
      color: 'orange' as const,
      trend: data.call_summary.average_duration > 0 ? { value: 5, isPositive: false } : undefined,
    },
    {
      title: 'Total Cost',
      value: formatCurrency(data.call_summary.total_cost),
      subtitle: 'This month',
      icon: CurrencyDollarIcon,
      color: 'red' as const,
      trend: data.call_summary.total_cost > 0 ? { value: 3, isPositive: false } : undefined,
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {isAdminMode ? `Admin: ${data.business.name}` : `Welcome, ${data.business.name}`}
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {isAdminMode ? 'Managing business dashboard' : 'Monitor your call activity and business performance'}
              </p>
            </div>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2 text-sm text-gray-500 dark:text-gray-400">
                <span>Last updated: {lastRefresh.toLocaleTimeString()}</span>
                <button
                  onClick={refreshData}
                  disabled={refreshing}
                  className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
                  title="Refresh"
                >
                  <ArrowPathIcon className={`h-5 w-5 ${refreshing ? 'animate-spin' : ''}`} />
                </button>
              </div>
              <LayoutToggle currentLayout={layout} onLayoutChange={handleLayoutChange} />
              
              {/* Business Selector for Admin Users */}
              {isAdminMode && <BusinessSelector />}
              
              <button
                onClick={handleSettingsClick}
                className="flex items-center space-x-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 px-3 py-2 rounded-lg transition-colors"
              >
                <Cog6ToothIcon className="h-4 w-4" />
                <span className="text-sm font-medium text-gray-900 dark:text-gray-100">Settings</span>
              </button>
              <button
                onClick={logout}
                title="Logout"
                className="flex items-center space-x-2 px-3 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                <ArrowRightOnRectangleIcon className="h-4 w-4" />
                <span className="text-sm font-medium">Logout</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <div className="mb-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        {/* Stats Grid */}
        <div className={getGridClasses()}>
          {stats.map((stat, index) => (
            <StatCard
              key={index}
              {...stat}
              layout={layout}
            />
          ))}
        </div>

        {/* Recent Calls */}
        <div className="mt-8">
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Recent Calls</h2>
            </div>
            <div className="overflow-hidden">
              {data.recent_calls.length === 0 ? (
                <div className="text-center py-12">
                  <PhoneIcon className="mx-auto h-12 w-12 text-gray-300 dark:text-gray-600" />
                  <h3 className="mt-4 text-sm font-medium text-gray-900 dark:text-gray-100">No calls yet</h3>
                  <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                    Your recent calls will appear here once customers start calling.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-700">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                          Caller
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                          Type
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                          Status
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                          Duration
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                          Cost
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                          Time
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                      {data.recent_calls.map((call) => (
                        <tr key={call.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">
                            {call.caller_number}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              call.call_type === 'human' 
                                ? 'bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-300' 
                                : 'bg-purple-100 dark:bg-purple-900/20 text-purple-800 dark:text-purple-300'
                            }`}>
                              {call.call_type === 'human' ? (
                                <>
                                  <UserGroupIcon className="h-3 w-3 mr-1" />
                                  Human
                                </>
                              ) : (
                                <>
                                  <CpuChipIcon className="h-3 w-3 mr-1" />
                                  AI
                                </>
                              )}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              call.status === 'completed' 
                                ? 'bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-300'
                                : call.status === 'failed' 
                                ? 'bg-red-100 dark:bg-red-900/20 text-red-800 dark:text-red-300'
                                : 'bg-yellow-100 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-300'
                            }`}>
                              {call.status.replace('_', ' ')}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                            {call.duration_seconds ? formatDuration(call.duration_seconds) : '-'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                            {call.cost ? formatCurrency(call.cost) : '-'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                            {new Date(call.start_time).toLocaleDateString()} {new Date(call.start_time).toLocaleTimeString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 