'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useBusinessSelection } from '@/contexts/BusinessSelectionContext';
import { businessAPI, adminAPI } from '@/lib/api';
import type { Business } from '@/lib/api';
import {
  ArrowLeftIcon,
  BuildingOfficeIcon,
  UserPlusIcon,
  ClipboardDocumentListIcon,
  Cog6ToothIcon,
  EyeIcon,
  ArrowRightOnRectangleIcon,
  PlusIcon,
  CheckCircleIcon,
  ClockIcon,
  XCircleIcon,
  EnvelopeIcon,
} from '@heroicons/react/24/outline';
import BusinessSelector from '@/components/BusinessSelector';
import toast from 'react-hot-toast';

interface SystemTab {
  id: string;
  name: string;
  icon: React.ElementType;
  description: string;
}

const systemTabs: SystemTab[] = [
  {
    id: 'businesses',
    name: 'Businesses',
    icon: BuildingOfficeIcon,
    description: 'View and manage all businesses in the system',
  },
  {
    id: 'invites',
    name: 'Invitations',
    icon: UserPlusIcon,
    description: 'Manage user invitations and access',
  },
  {
    id: 'system',
    name: 'System Settings',
    icon: Cog6ToothIcon,
    description: 'Configure system-wide settings',
  },
];

interface Invite {
  id: number;
  email: string;
  role: string;
  status: string;
  created_at: string;
  expires_at: string;
  invited_by: string;
  used_at?: string;
}

export default function SystemSettings() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const { isAdminMode } = useBusinessSelection();
  const [activeTab, setActiveTab] = useState('businesses');
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('business_owner');
  const [inviting, setInviting] = useState(false);

  // Redirect non-admin users
  useEffect(() => {
    if (!isAdminMode) {
      router.push('/dashboard');
      return;
    }
    loadData();
  }, [isAdminMode, router]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError('');

      // Load businesses and invites in parallel
      const [businessList, inviteList] = await Promise.all([
        businessAPI.listAll(),
        adminAPI.getInvites(),
      ]);

      setBusinesses(businessList);
      setInvites(inviteList);
    } catch (err) {
      setError('Failed to load system data');
      console.error('Error loading system data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;

    setInviting(true);
    try {
      await adminAPI.inviteUser(inviteEmail, inviteRole);
      toast.success(`Invitation sent to ${inviteEmail}`);
      setInviteEmail('');
      await loadData(); // Refresh invites list
    } catch (error: any) {
      const message = error.response?.data?.detail || 'Failed to send invite';
      toast.error(message);
    } finally {
      setInviting(false);
    }
  };

  const handleCancelInvite = async (inviteId: number) => {
    try {
      await adminAPI.cancelInvite(inviteId);
      toast.success('Invitation cancelled');
      await loadData(); // Refresh invites list
    } catch (error: any) {
      const message = error.response?.data?.detail || 'Failed to cancel invite';
      toast.error(message);
    }
  };

  const getStatusBadge = (status: string) => {
    const baseClasses = "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium";
    
    switch (status.toLowerCase()) {
      case 'pending':
        return (
          <span className={`${baseClasses} bg-yellow-100 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-300`}>
            <ClockIcon className="h-3 w-3 mr-1" />
            Pending
          </span>
        );
      case 'accepted':
        return (
          <span className={`${baseClasses} bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-300`}>
            <CheckCircleIcon className="h-3 w-3 mr-1" />
            Accepted
          </span>
        );
      case 'expired':
        return (
          <span className={`${baseClasses} bg-red-100 dark:bg-red-900/20 text-red-800 dark:text-red-300`}>
            <XCircleIcon className="h-3 w-3 mr-1" />
            Expired
          </span>
        );
      default:
        return (
          <span className={`${baseClasses} bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300`}>
            {status}
          </span>
        );
    }
  };

  const renderBusinessesTab = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
          All Businesses ({businesses.length})
        </h3>
      </div>

      {businesses.length === 0 ? (
        <div className="text-center py-12">
          <BuildingOfficeIcon className="mx-auto h-12 w-12 text-gray-300 dark:text-gray-600" />
          <h3 className="mt-4 text-sm font-medium text-gray-900 dark:text-gray-100">No businesses yet</h3>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            Businesses will appear here once users register and create their accounts.
          </p>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 shadow overflow-hidden sm:rounded-md">
          <ul className="divide-y divide-gray-200 dark:divide-gray-700">
            {businesses.map((business) => (
              <li key={business.id}>
                <div className="px-4 py-4 flex items-center justify-between">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <BuildingOfficeIcon className="h-10 w-10 text-gray-400 dark:text-gray-500" />
                    </div>
                    <div className="ml-4">
                      <div className="flex items-center">
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                          {business.name}
                        </p>
                        <div className={`ml-2 w-2 h-2 rounded-full ${
                          business.is_active ? 'bg-green-400' : 'bg-red-400'
                        }`} />
                      </div>
                      <div className="mt-1">
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          Owner: {business.owner.first_name} {business.owner.last_name} ({business.owner.email})
                        </p>
                        <p className="text-sm text-gray-500 dark:text-gray-500">
                          Phone: {business.owner_phone}
                        </p>
                        <p className="text-xs text-gray-400 dark:text-gray-500">
                          Created: {new Date(business.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      business.is_active 
                        ? 'bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-300' 
                        : 'bg-red-100 dark:bg-red-900/20 text-red-800 dark:text-red-300'
                    }`}>
                      {business.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );

  const renderInvitesTab = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">Send New Invitation</h3>
        <form onSubmit={handleSendInvite} className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Email Address
              </label>
              <input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-purple-500 focus:border-purple-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                placeholder="user@example.com"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Role
              </label>
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-purple-500 focus:border-purple-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              >
                <option value="business_owner">Business Owner</option>
                <option value="admin">Admin</option>
              </select>
            </div>
          </div>
          <div className="mt-4">
            <button
              type="submit"
              disabled={inviting}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 dark:focus:ring-offset-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {inviting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Sending...
                </>
              ) : (
                <>
                  <EnvelopeIcon className="h-4 w-4 mr-2" />
                  Send Invitation
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      <div>
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">
          Invitation History ({invites.length})
        </h3>
        
        {invites.length === 0 ? (
          <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg">
            <ClipboardDocumentListIcon className="mx-auto h-12 w-12 text-gray-300 dark:text-gray-600" />
            <h3 className="mt-4 text-sm font-medium text-gray-900 dark:text-gray-100">No invitations sent</h3>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              Send your first invitation using the form above.
            </p>
          </div>
        ) : (
          <div className="bg-white dark:bg-gray-800 shadow overflow-hidden sm:rounded-md">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Email
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Role
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Invited By
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {invites.map((invite) => (
                    <tr key={invite.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">
                        {invite.email}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        <span className="capitalize">{invite.role.replace('_', ' ')}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {getStatusBadge(invite.status)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {invite.invited_by}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        <div>
                          <div>{new Date(invite.created_at).toLocaleDateString()}</div>
                          <div className="text-xs text-gray-400">
                            Expires: {new Date(invite.expires_at).toLocaleDateString()}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        {invite.status === 'pending' && (
                          <button
                            onClick={() => handleCancelInvite(invite.id)}
                            className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                          >
                            Cancel
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  const renderSystemTab = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">System Information</h3>
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
          <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-6">
            <div>
              <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Businesses</dt>
              <dd className="mt-1 text-sm text-gray-900 dark:text-gray-100">{businesses.length}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Active Businesses</dt>
              <dd className="mt-1 text-sm text-gray-900 dark:text-gray-100">
                {businesses.filter(b => b.is_active).length}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Pending Invites</dt>
              <dd className="mt-1 text-sm text-gray-900 dark:text-gray-100">
                {invites.filter(i => i.status === 'pending').length}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Invites</dt>
              <dd className="mt-1 text-sm text-gray-900 dark:text-gray-100">{invites.length}</dd>
            </div>
          </dl>
        </div>
      </div>

      <div>
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">System Actions</h3>
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            Additional system management features coming soon...
          </p>
        </div>
      </div>
    </div>
  );

  const renderTabContent = () => {
    switch (activeTab) {
      case 'businesses':
        return renderBusinessesTab();
      case 'invites':
        return renderInvitesTab();
      case 'system':
        return renderSystemTab();
      default:
        return <div className="text-gray-500 dark:text-gray-400">Coming soon...</div>;
    }
  };

  if (!isAdminMode) {
    return null; // Will redirect in useEffect
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow border-b border-gray-200 dark:border-gray-700 transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => router.push('/dashboard')}
                className="inline-flex items-center text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
              >
                <ArrowLeftIcon className="h-5 w-5 mr-2" />
                Back to Dashboard
              </button>
              <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">System Settings</h1>
            </div>
            <div className="flex items-center space-x-4">
              <BusinessSelector />
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
      <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        {error && (
          <div className="mb-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        <div className="lg:grid lg:grid-cols-12 lg:gap-8">
          {/* Sidebar */}
          <div className="lg:col-span-3">
            <nav className="space-y-1">
              {systemTabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-start px-3 py-3 text-sm font-medium rounded-lg transition-colors ${
                    activeTab === tab.id
                      ? 'bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 border-l-4 border-purple-700 dark:border-purple-300'
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
                {renderTabContent()}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
} 