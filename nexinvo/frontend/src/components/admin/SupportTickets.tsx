import React, { useState } from 'react';

const SupportTickets: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'tickets' | 'create' | 'knowledge'>('tickets');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterPriority, setFilterPriority] = useState('all');

  // Mock data
  const tickets = [
    {
      id: 'TKT-001',
      title: 'Unable to generate GST reports',
      tenant: 'ABC CA Associates',
      status: 'open',
      priority: 'high',
      category: 'Technical',
      assignee: 'Support Team',
      createdAt: '2024-03-15 10:30 AM',
      lastUpdate: '2024-03-15 02:45 PM'
    },
    {
      id: 'TKT-002',
      title: 'Billing inquiry for March subscription',
      tenant: 'XYZ Chartered Accountants',
      status: 'in_progress',
      priority: 'medium',
      category: 'Billing',
      assignee: 'John Doe',
      createdAt: '2024-03-14 03:20 PM',
      lastUpdate: '2024-03-15 11:15 AM'
    },
    {
      id: 'TKT-003',
      title: 'Feature request: Custom invoice templates',
      tenant: 'PQR Financial Services',
      status: 'resolved',
      priority: 'low',
      category: 'Feature Request',
      assignee: 'Jane Smith',
      createdAt: '2024-03-13 09:45 AM',
      lastUpdate: '2024-03-14 04:30 PM'
    },
    {
      id: 'TKT-004',
      title: 'Password reset not working',
      tenant: 'MNO Tax Consultants',
      status: 'open',
      priority: 'medium',
      category: 'Account',
      assignee: 'Support Team',
      createdAt: '2024-03-13 02:15 PM',
      lastUpdate: '2024-03-13 02:15 PM'
    },
    {
      id: 'TKT-005',
      title: 'Data export functionality issue',
      tenant: 'DEF Business Solutions',
      status: 'closed',
      priority: 'high',
      category: 'Technical',
      assignee: 'Mike Johnson',
      createdAt: '2024-03-12 11:00 AM',
      lastUpdate: '2024-03-13 09:20 AM'
    }
  ];

  const [newTicket, setNewTicket] = useState({
    title: '',
    description: '',
    tenant: '',
    priority: 'medium',
    category: 'Technical'
  });

  const stats = [
    { label: 'Open Tickets', value: '23', change: '+3', trend: 'up', icon: '🎫' },
    { label: 'In Progress', value: '12', change: '-2', trend: 'down', icon: '⏳' },
    { label: 'Resolved Today', value: '8', change: '+5', trend: 'up', icon: '✅' },
    { label: 'Avg Response Time', value: '2.4h', change: '-0.3h', trend: 'up', icon: '⚡' }
  ];

  const getStatusBadge = (status: string) => {
    const styles = {
      open: 'bg-red-100 text-red-800',
      in_progress: 'bg-yellow-100 text-yellow-800',
      resolved: 'bg-green-100 text-green-800',
      closed: 'bg-gray-100 text-gray-800'
    };
    return styles[status as keyof typeof styles] || 'bg-gray-100 text-gray-800';
  };

  const getPriorityBadge = (priority: string) => {
    const styles = {
      high: 'bg-red-100 text-red-800',
      medium: 'bg-yellow-100 text-yellow-800',
      low: 'bg-green-100 text-green-800'
    };
    return styles[priority as keyof typeof styles] || 'bg-gray-100 text-gray-800';
  };

  const filteredTickets = tickets.filter(ticket => {
    if (filterStatus !== 'all' && ticket.status !== filterStatus) return false;
    if (filterPriority !== 'all' && ticket.priority !== filterPriority) return false;
    return true;
  });

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Support Tickets</h1>
            <p className="text-gray-600 mt-2">Manage customer support requests and issues</p>
          </div>
          <button className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700">
            Create Ticket
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {stats.map((stat, index) => (
          <div key={index} className="bg-white rounded-xl shadow-lg border border-gray-100 p-6 hover:shadow-xl transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">{stat.label}</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{stat.value}</p>
                <div className="flex items-center mt-2">
                  <span className={`text-sm font-medium ${
                    stat.trend === 'up' ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {stat.trend === 'up' ? '↗' : '↘'} {stat.change}
                  </span>
                </div>
              </div>
              <div className="text-3xl opacity-70">{stat.icon}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="mb-8">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            {[
              { key: 'tickets', label: 'All Tickets' },
              { key: 'create', label: 'Create Ticket' },
              { key: 'knowledge', label: 'Knowledge Base' }
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as any)}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === tab.key
                    ? 'border-indigo-500 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Tickets Tab */}
      {activeTab === 'tickets' && (
        <div>
          {/* Filters */}
          <div className="mb-6 flex items-center space-x-4">
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value="all">All Status</option>
              <option value="open">Open</option>
              <option value="in_progress">In Progress</option>
              <option value="resolved">Resolved</option>
              <option value="closed">Closed</option>
            </select>
            <select
              value={filterPriority}
              onChange={(e) => setFilterPriority(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value="all">All Priority</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>

          {/* Tickets Cards - More Compact */}
          <div className="space-y-4">
            {filteredTickets.map((ticket) => (
              <div key={ticket.id} className="bg-white rounded-lg shadow border border-gray-100 p-4 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-3 mb-2">
                      <span className="text-sm font-medium text-blue-600">{ticket.id}</span>
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusBadge(ticket.status)}`}>
                        {ticket.status.replace('_', ' ')}
                      </span>
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getPriorityBadge(ticket.priority)}`}>
                        {ticket.priority}
                      </span>
                    </div>
                    <h3 className="text-sm font-semibold text-gray-900 mb-1 truncate">{ticket.title}</h3>
                    <div className="flex items-center text-xs text-gray-500 space-x-4">
                      <span>👤 {ticket.tenant}</span>
                      <span>📁 {ticket.category}</span>
                      <span>👨‍💼 {ticket.assignee}</span>
                      <span>🕒 {ticket.lastUpdate}</span>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2 ml-4">
                    <button className="text-indigo-600 hover:text-indigo-900 text-sm font-medium">View</button>
                    <button className="text-gray-600 hover:text-gray-900 text-sm font-medium">Edit</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Create Ticket Tab */}
      {activeTab === 'create' && (
        <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
          <h3 className="text-xl font-semibold text-gray-900 mb-4">Create New Support Ticket</h3>

          <div className="space-y-4">
            {/* Title - Full Width */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Ticket Title</label>
              <input
                type="text"
                value={newTicket.title}
                onChange={(e) => setNewTicket({ ...newTicket, title: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="Brief description of the issue"
              />
            </div>

            {/* Two Column Layout */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tenant</label>
                <select
                  value={newTicket.tenant}
                  onChange={(e) => setNewTicket({ ...newTicket, tenant: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                >
                  <option value="">Select Tenant</option>
                  <option value="ABC CA Associates">ABC CA Associates</option>
                  <option value="XYZ Chartered Accountants">XYZ Chartered Accountants</option>
                  <option value="PQR Financial Services">PQR Financial Services</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
                <select
                  value={newTicket.priority}
                  onChange={(e) => setNewTicket({ ...newTicket, priority: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>
            </div>

            {/* Category - Full Width */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
              <select
                value={newTicket.category}
                onChange={(e) => setNewTicket({ ...newTicket, category: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value="Technical">Technical</option>
                <option value="Billing">Billing</option>
                <option value="Account">Account</option>
                <option value="Feature Request">Feature Request</option>
                <option value="General">General</option>
              </select>
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea
                value={newTicket.description}
                onChange={(e) => setNewTicket({ ...newTicket, description: e.target.value })}
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="Detailed description of the issue..."
              />
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end space-x-3 pt-2">
              <button className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 text-sm">
                Cancel
              </button>
              <button className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 text-sm">
                Create Ticket
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Knowledge Base Tab */}
      {activeTab === 'knowledge' && (
        <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6 text-center">
          <div className="text-4xl mb-3">📚</div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Knowledge Base</h3>
          <p className="text-gray-600 mb-4 text-sm">Common solutions and documentation for support issues</p>
          <div className="grid grid-cols-3 gap-3 max-w-lg mx-auto">
            <button className="bg-indigo-600 text-white px-3 py-2 rounded-lg hover:bg-indigo-700 text-sm">
              Technical Issues
            </button>
            <button className="bg-green-600 text-white px-3 py-2 rounded-lg hover:bg-green-700 text-sm">
              Billing Help
            </button>
            <button className="bg-purple-600 text-white px-3 py-2 rounded-lg hover:bg-purple-700 text-sm">
              User Guides
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default SupportTickets;