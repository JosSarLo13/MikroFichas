import React from 'react';
import {
  Menu,
  Bell,
  HardDrive,
  PlusCircle,
} from 'lucide-react';
import { NavigationTab } from './Sidebar.js';

interface HeaderProps {
  activeTab: NavigationTab;
  collapsed: boolean;
  onToggleCollapse: () => void;
  onQuickAction: (action: 'new-ticket' | 'new-sale') => void;
}

const TAB_TITLES: Record<NavigationTab, { title: string; subtitle: string }> = {
  dashboard: {
    title: 'Panel Principal',
    subtitle: 'Monitoreo en vivo de telemetría, ventas y nodos Hotspot',
  },
  routers: {
    title: 'Routers MikroTik',
    subtitle: 'Administración de conexiones RouterOS API y estado de hardware',
  },
  hotspot: {
    title: 'Hotspot en Vivo',
    subtitle: 'Sesiones activas, tráfico en tiempo real y desconexión forzada',
  },
  plans: {
    title: 'Planes y Tarifas',
    subtitle: 'Configuración de perfiles de velocidad, tiempo y cuotas de datos',
  },
  tickets: {
    title: 'Generador de Tickets',
    subtitle: 'Emisión de lotes anti-colisión, plantillas de impresión y códigos QR',
  },
  pos: {
    title: 'Caja Rápida (Punto de Venta)',
    subtitle: 'Venta ágil de fichas para cajeros y arqueo de turnos',
  },
  operators: {
    title: 'Operadores y Personal',
    subtitle: 'Control de acceso granular por roles y registro de actividades',
  },
  reports: {
    title: 'Reportes y Cortes',
    subtitle: 'Estadísticas históricas de ingresos, consumo y exportación de datos',
  },
  settings: {
    title: 'Configuración del Sistema',
    subtitle: 'Parámetros generales de red, plantillas de tickets y seguridad',
  },
};

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  collapsed,
  onToggleCollapse,
  onQuickAction,
}) => {
  const current = TAB_TITLES[activeTab];

  return (
    <header
      className={`fixed top-0 right-0 z-30 h-16 bg-slate-900/80 backdrop-blur-md border-b border-slate-800 transition-all duration-300 px-6 flex items-center justify-between ${
        collapsed ? 'left-20' : 'left-64'
      }`}
    >
      {/* Left: Hamburger & Current View Title */}
      <div className="flex items-center gap-4">
        <button
          onClick={onToggleCollapse}
          className="p-2 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800/80 transition-colors"
          title="Alternar barra lateral"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="flex flex-col">
          <h1 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
            {current.title}
          </h1>
          <p className="text-xs text-slate-400 hidden sm:block">
            {current.subtitle}
          </p>
        </div>
      </div>

      {/* Right: Active Router Badge, Quick Action Buttons & Status */}
      <div className="flex items-center gap-3">
        {/* Active Router Indicator */}
        <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800/80 border border-slate-700/60 text-xs">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <HardDrive className="w-3.5 h-3.5 text-slate-400" />
          <span className="font-semibold text-slate-200">Nodo Central</span>
          <span className="text-[10px] font-mono text-cyan-400 bg-cyan-950/60 px-1.5 py-0.5 rounded border border-cyan-800/40">
            v7.16.2
          </span>
        </div>

        {/* Quick Venta POS Button */}
        <button
          onClick={() => onQuickAction('new-sale')}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold text-xs shadow-md shadow-cyan-950/30 transition-all active:scale-95"
        >
          <PlusCircle className="w-4 h-4 text-slate-950" />
          <span className="hidden sm:inline">Nueva Venta</span>
        </button>

        {/* Notifications Icon */}
        <button
          className="p-2 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800/80 relative transition-colors"
          title="Notificaciones del sistema"
        >
          <Bell className="w-4 h-4" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-cyan-400" />
        </button>
      </div>
    </header>
  );
};
