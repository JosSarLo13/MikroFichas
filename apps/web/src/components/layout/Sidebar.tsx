import React from 'react';
import {
  LayoutDashboard,
  Router as RouterIcon,
  Wifi,
  Ticket,
  ShoppingCart,
  Layers,
  Users,
  BarChart3,
  Settings,
  ShieldCheck,
  ChevronRight,
} from 'lucide-react';

export type NavigationTab =
  | 'dashboard'
  | 'routers'
  | 'hotspot'
  | 'plans'
  | 'tickets'
  | 'pos'
  | 'operators'
  | 'reports'
  | 'settings';

interface SidebarProps {
  activeTab: NavigationTab;
  onTabChange: (tab: NavigationTab) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

interface NavItem {
  id: NavigationTab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
  badgeColor?: string;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onTabChange,
  collapsed,
}) => {
  const navItems: NavItem[] = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'routers', label: 'Routers MikroTik', icon: RouterIcon, badge: 'Live', badgeColor: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
    { id: 'hotspot', label: 'Hotspot en Vivo', icon: Wifi },
    { id: 'plans', label: 'Planes y Tarifas', icon: Layers },
    { id: 'tickets', label: 'Generador Tickets', icon: Ticket },
    { id: 'pos', label: 'Caja Rápida (POS)', icon: ShoppingCart, badge: 'Venta', badgeColor: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20' },
    { id: 'operators', label: 'Operadores', icon: Users },
    { id: 'reports', label: 'Reportes y Cortes', icon: BarChart3 },
    { id: 'settings', label: 'Configuración', icon: Settings },
  ];

  return (
    <aside
      className={`fixed top-0 left-0 z-40 h-screen transition-all duration-300 bg-slate-900/95 backdrop-blur-md border-r border-slate-800 flex flex-col justify-between ${
        collapsed ? 'w-20' : 'w-64'
      }`}
    >
      {/* Brand Header */}
      <div>
        <div className="h-16 flex items-center px-5 border-b border-slate-800/80 gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-600 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-950/50 flex-shrink-0">
            <span className="font-mono font-extrabold text-white text-lg">M</span>
          </div>
          {!collapsed && (
            <div className="flex flex-col">
              <span className="font-extrabold tracking-tight text-white text-base leading-none">
                Mikro<span className="text-cyan-400">Manager</span>
              </span>
              <span className="text-[10px] text-slate-400 font-mono tracking-widest mt-1 uppercase">
                Hotspot Controller
              </span>
            </div>
          )}
        </div>

        {/* Navigation Section */}
        <div className="px-3 py-4 space-y-1">
          <div className="px-3 pb-2 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
            {!collapsed && 'Navegación Principal'}
          </div>

          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onTabChange(item.id)}
                title={collapsed ? item.label : undefined}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all group ${
                  isActive
                    ? 'bg-gradient-to-r from-cyan-500/15 to-blue-500/5 text-cyan-400 border border-cyan-500/20 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                <Icon
                  className={`w-5 h-5 flex-shrink-0 transition-colors ${
                    isActive ? 'text-cyan-400' : 'text-slate-400 group-hover:text-slate-200'
                  }`}
                />
                {!collapsed && (
                  <span className="flex-1 text-left truncate">{item.label}</span>
                )}
                {!collapsed && item.badge && (
                  <span
                    className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${
                      item.badgeColor || 'bg-slate-800 text-slate-300 border-slate-700'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
                {!collapsed && isActive && (
                  <ChevronRight className="w-4 h-4 text-cyan-400/80" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Footer Profile / Node Status */}
      <div className="p-3 border-t border-slate-800/80 bg-slate-950/40">
        <div className="flex items-center gap-3 p-2 rounded-lg bg-slate-800/40 border border-slate-800">
          <div className="w-8 h-8 rounded-full bg-slate-700/80 flex items-center justify-center flex-shrink-0">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
          </div>
          {!collapsed && (
            <div className="flex flex-col min-w-0 flex-1">
              <span className="text-xs font-semibold text-slate-200 truncate">
                SuperAdmin
              </span>
              <span className="text-[10px] text-slate-400 truncate font-mono">
                API Port 8728 / 8729
              </span>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
};
