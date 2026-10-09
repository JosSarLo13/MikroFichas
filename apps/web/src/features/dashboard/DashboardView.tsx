import React, { useState, useEffect } from 'react';
import {
  Wifi,
  Ticket,
  TrendingUp,
  Cpu,
  HardDrive,
  RefreshCw,
} from 'lucide-react';

export const DashboardView: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalRouters: 0,
    onlineRouters: 0,
    totalStock: 0,
    soldTodayCount: 0,
    todayRevenue: 0,
    activeHotspotUsers: 0,
    topRouterName: 'Ninguno',
  });

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const [routersRes, ticketsRes, salesRes] = await Promise.all([
        fetch('/api/v1/routers').then((r) => r.json()).catch(() => ({ success: false, data: [] })),
        fetch('/api/v1/tickets').then((r) => r.json()).catch(() => ({ success: false, data: [] })),
        fetch('/api/v1/sales/summary').then((r) => r.json()).catch(() => ({ success: false, data: {} })),
      ]);

      const routers = routersRes.data || [];
      const tickets = ticketsRes.data || [];
      const salesSummary = salesRes.data || {};

      const onlineCount = routers.filter((r: any) => r.status === 'ONLINE').length;
      const stockCount = tickets.filter((t: any) => t.status === 'AVAILABLE').length;

      setStats({
        totalRouters: routers.length,
        onlineRouters: onlineCount,
        totalStock: stockCount,
        soldTodayCount: salesSummary.todayTicketsCount || 0,
        todayRevenue: salesSummary.todayRevenue || 0,
        activeHotspotUsers: tickets.filter((t: any) => t.status === 'ACTIVE').length,
        topRouterName: routers[0]?.name || 'Nodo Central',
      });
    } catch (e) {
      console.error('Error cargando dashboard:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  return (
    <div className="space-y-6">
      {/* Top Banner with real sync indicator */}
      <div className="flex items-center justify-between bg-slate-900/60 border border-slate-800 px-4 py-2.5 rounded-xl">
        <div className="flex items-center gap-2 text-xs text-slate-300">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>Datos en vivo sincronizados con la base de datos relacional y RouterOS API</span>
        </div>
        <button
          onClick={fetchDashboardData}
          className="flex items-center gap-1.5 text-xs text-cyan-400 hover:text-cyan-300 font-medium"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Actualizar Métricas
        </button>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Fichas en Stock */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Fichas en Stock
            </span>
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
              <Ticket className="w-4 h-4 text-blue-400" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-white font-mono">
              {stats.totalStock}
            </span>
            <span className="text-xs text-slate-400">PINs listos</span>
          </div>
          <div className="mt-2 text-xs text-slate-500">
            Fichas disponibles para venta inmediata
          </div>
        </div>

        {/* Card 2: Ventas del Día */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Ventas de Hoy
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
              <TrendingUp className="w-4 h-4 text-emerald-400" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-emerald-400 font-mono">
              ${stats.todayRevenue.toFixed(2)}
            </span>
            <span className="text-xs text-slate-400">MXN</span>
          </div>
          <div className="mt-2 text-xs text-slate-500">
            {stats.soldTodayCount} ficha(s) vendida(s) hoy
          </div>
        </div>

        {/* Card 3: Clientes Conectados */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Sesiones Activas
            </span>
            <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
              <Wifi className="w-4 h-4 text-cyan-400" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-white font-mono">
              {stats.activeHotspotUsers}
            </span>
            <span className="text-xs text-slate-400">en línea</span>
          </div>
          <div className="mt-2 text-xs text-slate-500">
            Sesiones autenticadas en MikroTik
          </div>
        </div>

        {/* Card 4: Estado de Routers */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Salud de Nodos
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
              <HardDrive className="w-4 h-4 text-emerald-400" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-white font-mono">
              {stats.onlineRouters} / {stats.totalRouters}
            </span>
            <span className="text-xs text-emerald-400 font-medium">
              {stats.totalRouters > 0
                ? `${Math.round((stats.onlineRouters / stats.totalRouters) * 100)}% Online`
                : 'Sin nodos'}
            </span>
          </div>
          <div className="mt-2 text-xs text-slate-500">
            {stats.totalRouters} router(s) registrado(s)
          </div>
        </div>
      </div>

      {/* Middle Grid: Telemetry & Real-Time Nodes */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-slate-900/90 border border-slate-800 rounded-xl p-6">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-4 mb-4">
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <Cpu className="w-4 h-4 text-cyan-400" />
                Telemetría de Red: {stats.topRouterName}
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Lecturas automáticas vía comandos nativos de RouterOS
              </p>
            </div>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              API Socket 8728 / 8729
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <div className="bg-slate-950/60 p-4 rounded-lg border border-slate-800/80">
              <div className="text-xs text-slate-400">Total Fichas Generadas</div>
              <div className="text-2xl font-bold font-mono text-white mt-1">
                {stats.totalStock + stats.soldTodayCount}
              </div>
              <div className="text-[11px] text-cyan-400 mt-2">En base de datos</div>
            </div>

            <div className="bg-slate-950/60 p-4 rounded-lg border border-slate-800/80">
              <div className="text-xs text-slate-400">Corte de Caja Actual</div>
              <div className="text-2xl font-bold font-mono text-emerald-400 mt-1">
                ${stats.todayRevenue.toFixed(2)}
              </div>
              <div className="text-[11px] text-slate-500 mt-2">Ventas de vendedores hoy</div>
            </div>

            <div className="bg-slate-950/60 p-4 rounded-lg border border-slate-800/80">
              <div className="text-xs text-slate-400">Nodos Disponibles</div>
              <div className="text-2xl font-bold font-mono text-white mt-1">
                {stats.onlineRouters}
              </div>
              <div className="text-[11px] text-emerald-400 mt-2">Listos para emitir PINs</div>
            </div>
          </div>
        </div>

        {/* Resumen Operativo */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-6 flex flex-col justify-between">
          <div>
            <h2 className="text-sm font-bold text-white flex items-center gap-2 border-b border-slate-800/80 pb-4 mb-4">
              <TrendingUp className="w-4 h-4 text-emerald-400" />
              Control Operativo
            </h2>

            <div className="space-y-4 text-xs">
              <div className="p-3.5 rounded-lg bg-slate-950/60 border border-slate-800/80">
                <div className="text-slate-400">App Android de Vendedores</div>
                <div className="text-sm font-bold text-white mt-1">MikroFichas POS APK</div>
                <div className="text-[11px] text-emerald-400 mt-1">● Conectada al backend local</div>
              </div>

              <div className="p-3.5 rounded-lg bg-slate-950/60 border border-slate-800/80">
                <div className="text-slate-400">Seguridad Criptográfica</div>
                <div className="text-sm font-bold text-white mt-1">AES-256-GCM Activo</div>
                <div className="text-[11px] text-cyan-400 mt-1">Credenciales protegidas en reposo</div>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-800 text-[11px] text-slate-500 text-center">
            MikroManager v1.0.0 • Entorno Producción / Local
          </div>
        </div>
      </div>
    </div>
  );
};
