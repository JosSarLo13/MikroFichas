import React, { useState } from 'react';
import { Sidebar, NavigationTab } from './components/layout/Sidebar.js';
import { Header } from './components/layout/Header.js';
import { DashboardView } from './features/dashboard/DashboardView.js';
import { RoutersView } from './features/routers/RoutersView.js';
import { HotspotView } from './features/hotspot/HotspotView.js';
import { PlansView } from './features/plans/PlansView.js';
import { TicketsView } from './features/tickets/TicketsView.js';
import { PosView } from './features/pos/PosView.js';
import { OperatorsView } from './features/operators/OperatorsView.js';
import { ReportsView } from './features/reports/ReportsView.js';
import { SettingsView } from './features/settings/SettingsView.js';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<NavigationTab>('dashboard');
  const [collapsed, setCollapsed] = useState(false);

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <DashboardView />;
      case 'routers':
        return <RoutersView />;
      case 'hotspot':
        return <HotspotView />;
      case 'plans':
        return <PlansView />;
      case 'tickets':
        return <TicketsView />;
      case 'pos':
        return <PosView />;
      case 'operators':
        return <OperatorsView />;
      case 'reports':
        return <ReportsView />;
      case 'settings':
        return <SettingsView />;
      default:
        return <DashboardView />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex">
      {/* Sidebar Navigation */}
      <Sidebar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        collapsed={collapsed}
        onToggleCollapse={() => setCollapsed(!collapsed)}
      />

      {/* Main Layout Area */}
      <div
        className={`flex-1 flex flex-col min-h-screen transition-all duration-300 ${
          collapsed ? 'ml-20' : 'ml-64'
        }`}
      >
        {/* Top Header */}
        <Header
          activeTab={activeTab}
          collapsed={collapsed}
          onToggleCollapse={() => setCollapsed(!collapsed)}
          onQuickAction={(action) => {
            if (action === 'new-sale') setActiveTab('pos');
            if (action === 'new-ticket') setActiveTab('tickets');
          }}
        />

        {/* Dynamic View Content */}
        <main className="flex-1 p-6 mt-16 max-w-7xl w-full mx-auto">
          {renderContent()}
        </main>
      </div>
    </div>
  );
};

export default App;
