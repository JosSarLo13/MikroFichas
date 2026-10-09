import React, { useState, useEffect } from 'react';
import {
  BarChart3,
  FileDown,
  Printer,
  Calendar,
  Filter,
  RefreshCw,
  Search,
  DollarSign,
  Ticket,
  TrendingUp,
  HardDrive,
  CreditCard,
  Banknote,
  X,
} from 'lucide-react';

interface ReportSummary {
  period: string;
  totalRevenue: number;
  totalTickets: number;
  salesCount: number;
  todayRevenue: number;
  todayTickets: number;
  weekRevenue: number;
  weekTickets: number;
  monthRevenue: number;
  monthTickets: number;
  averageDaily: number;
}

interface SaleTransaction {
  id: string;
  createdAt: string;
  formattedDate: string;
  formattedTime: string;
  vendor: string;
  routerName: string;
  routerHost: string;
  planName: string;
  username: string;
  password: string;
  amount: number;
  paymentMethod: string;
  notes: string;
}

interface RouterStat {
  routerId: string;
  routerName: string;
  revenue: number;
  tickets: number;
}

interface PlanStat {
  planName: string;
  price: number;
  revenue: number;
  tickets: number;
}

export const ReportsView: React.FC = () => {
  const [period, setPeriod] = useState<'today' | 'week' | 'month' | 'all'>('month');
  const [selectedRouterId, setSelectedRouterId] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<ReportSummary | null>(null);
  const [paymentMethods, setPaymentMethods] = useState<Record<string, number>>({});
  const [byRouter, setByRouter] = useState<RouterStat[]>([]);
  const [byPlan, setByPlan] = useState<PlanStat[]>([]);
  const [transactions, setTransactions] = useState<SaleTransaction[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [routersList, setRoutersList] = useState<{ id: string; name: string }[]>([]);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [exportingCsv, setExportingCsv] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);

  const fetchReportData = async () => {
    try {
      setLoading(true);
      const query = new URLSearchParams({ period, routerId: selectedRouterId });
      const res = await fetch(`/api/v1/sales/report?${query.toString()}`);
      const json = await res.json();
      if (json.success && json.data) {
        setSummary(json.data.summary);
        setPaymentMethods(json.data.paymentMethods || {});
        setByRouter(json.data.byRouter || []);
        setByPlan(json.data.byPlan || []);
        setTransactions(json.data.transactions || []);
      }
    } catch (e) {
      console.error('Error al cargar reporte:', e);
    } finally {
      setLoading(false);
    }
  };

  const fetchRouters = async () => {
    try {
      const res = await fetch('/api/v1/routers');
      const json = await res.json();
      if (json.success && json.data) {
        setRoutersList(json.data);
      }
    } catch (e) {
      console.error('Error al cargar lista de routers:', e);
    }
  };

  useEffect(() => {
    fetchRouters();
  }, []);

  useEffect(() => {
    fetchReportData();
  }, [period, selectedRouterId]);

  const handleDownloadCsv = async () => {
    try {
      setExportingCsv(true);
      const res = await fetch('/api/v1/sales/export/csv');
      if (!res.ok) throw new Error('Error al generar CSV');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `reporte_ventas_mikrofichas_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err: any) {
      alert(`Error al descargar CSV: ${err.message}`);
    } finally {
      setExportingCsv(false);
    }
  };

  const handleDownloadPdf = async () => {
    try {
      setExportingPdf(true);
      const query = new URLSearchParams({ period, routerId: selectedRouterId });
      const res = await fetch(`/api/v1/sales/export/pdf?${query.toString()}`);
      if (!res.ok) throw new Error('Error al generar PDF oficial en el servidor');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `corte_caja_${period}_${new Date().toISOString().slice(0, 10)}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err: any) {
      alert(`Error al descargar PDF: ${err.message}`);
    } finally {
      setExportingPdf(false);
    }
  };


  const filteredTransactions = transactions.filter((t) => {
    const term = searchTerm.toLowerCase();
    return (
      t.username.toLowerCase().includes(term) ||
      t.vendor.toLowerCase().includes(term) ||
      t.planName.toLowerCase().includes(term) ||
      t.routerName.toLowerCase().includes(term)
    );
  });

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-900/90 border border-slate-800 p-4 rounded-xl">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
            <BarChart3 className="w-5 h-5 text-cyan-400" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white">Reportes y Auditoría de Ventas</h2>
            <p className="text-xs text-slate-400">
              Métricas reales, cortes de caja y descargas oficiales PDF / CSV
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchReportData}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition-colors"
            title="Actualizar métricas"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-cyan-400' : ''}`} />
            Actualizar
          </button>
          <button
            onClick={handleDownloadCsv}
            disabled={exportingCsv}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-950/40 border border-emerald-500/30 hover:bg-emerald-900/40 text-emerald-300 text-xs font-semibold transition-colors disabled:opacity-50"
          >
            <FileDown className="w-4 h-4 text-emerald-400" />
            {exportingCsv ? 'Exportando...' : 'Descargar CSV'}
          </button>
          <button
            onClick={handleDownloadPdf}
            disabled={exportingPdf}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-rose-950/40 border border-rose-500/30 hover:bg-rose-900/40 text-rose-300 text-xs font-semibold transition-colors disabled:opacity-50"
            title="Descargar archivo PDF oficial con arqueo y firmas"
          >
            <FileDown className="w-4 h-4 text-rose-400" />
            {exportingPdf ? 'Generando PDF...' : 'Descargar PDF'}
          </button>
          <button
            onClick={() => setShowPrintModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-slate-950 text-xs font-bold shadow-md transition-all"
          >
            <Printer className="w-4 h-4" />
            Exportar PDF / Imprimir
          </button>

        </div>
      </div>

      {/* Filter and Period Controls */}
      <div className="bg-slate-900/80 border border-slate-800 p-3 rounded-xl flex flex-col md:flex-row items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 w-full md:w-auto">
          <Calendar className="w-4 h-4 text-cyan-400" />
          <span className="text-slate-400 font-medium">Periodo:</span>
          <div className="flex bg-slate-950 p-1 rounded-lg border border-slate-800">
            {(
              [
                { id: 'today', label: 'Hoy' },
                { id: 'week', label: 'Últimos 7 Días' },
                { id: 'month', label: 'Últimos 30 Días' },
                { id: 'all', label: 'Histórico' },
              ] as const
            ).map((p) => (
              <button
                key={p.id}
                onClick={() => setPeriod(p.id)}
                className={`px-3 py-1 rounded text-xs font-semibold transition-colors ${
                  period === p.id
                    ? 'bg-cyan-600 text-slate-950'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto justify-end">
          <Filter className="w-4 h-4 text-cyan-400" />
          <span className="text-slate-400 font-medium">Router:</span>
          <select
            value={selectedRouterId}
            onChange={(e) => setSelectedRouterId(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-white font-medium focus:outline-none focus:border-cyan-500"
          >
            <option value="all">Todos los Routers</option>
            {routersList.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Real Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between text-xs text-slate-400 uppercase tracking-wider font-semibold">
            <span>Ingreso del Periodo</span>
            <DollarSign className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-3xl font-extrabold text-white font-mono mt-2">
            ${summary ? summary.totalRevenue.toFixed(2) : '0.00'}
          </div>
          <div className="text-xs text-emerald-400 mt-1 flex items-center gap-1">
            <Ticket className="w-3.5 h-3.5" />
            {summary ? summary.totalTickets : 0} fichas liquidadas
          </div>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between text-xs text-slate-400 uppercase tracking-wider font-semibold">
            <span>Corte de Hoy</span>
            <Banknote className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-3xl font-extrabold text-emerald-400 font-mono mt-2">
            ${summary ? summary.todayRevenue.toFixed(2) : '0.00'}
          </div>
          <div className="text-xs text-slate-400 mt-1">
            {summary ? summary.todayTickets : 0} fichas vendidas hoy
          </div>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between text-xs text-slate-400 uppercase tracking-wider font-semibold">
            <span>Últimos 7 Días</span>
            <TrendingUp className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="text-3xl font-extrabold text-indigo-300 font-mono mt-2">
            ${summary ? summary.weekRevenue.toFixed(2) : '0.00'}
          </div>
          <div className="text-xs text-slate-400 mt-1">
            {summary ? summary.weekTickets : 0} fichas esta semana
          </div>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between text-xs text-slate-400 uppercase tracking-wider font-semibold">
            <span>Promedio Diario</span>
            <CreditCard className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-3xl font-extrabold text-amber-300 font-mono mt-2">
            ${summary ? summary.averageDaily.toFixed(2) : '0.00'}
          </div>
          <div className="text-xs text-slate-400 mt-1">Estimación últimos 30 días</div>
        </div>
      </div>

      {/* Desglose Métodos de Pago y Routers */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Desglose por Router */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5">
          <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-3 flex items-center gap-2">
            <HardDrive className="w-4 h-4 text-cyan-400" />
            Rendimiento por Router
          </h3>
          <div className="space-y-2.5">
            {byRouter.length === 0 ? (
              <p className="text-xs text-slate-500 py-3 text-center">No hay registros para este periodo</p>
            ) : (
              byRouter.map((r) => (
                <div
                  key={r.routerId}
                  className="flex items-center justify-between p-2.5 bg-slate-950/60 rounded-lg border border-slate-800/80 text-xs"
                >
                  <div>
                    <span className="font-semibold text-white block">{r.routerName}</span>
                    <span className="text-[11px] text-slate-400">{r.tickets} fichas vendidas</span>
                  </div>
                  <span className="font-mono font-bold text-cyan-400 text-sm">
                    ${r.revenue.toFixed(2)}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Desglose por Plan y Métodos de Pago */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5">
          <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-3 flex items-center gap-2">
            <Ticket className="w-4 h-4 text-emerald-400" />
            Ventas por Plan de Ficha
          </h3>
          <div className="space-y-2.5">
            {byPlan.length === 0 ? (
              <p className="text-xs text-slate-500 py-3 text-center">No hay registros para este periodo</p>
            ) : (
              byPlan.map((p) => (
                <div
                  key={p.planName}
                  className="flex items-center justify-between p-2.5 bg-slate-950/60 rounded-lg border border-slate-800/80 text-xs"
                >
                  <div>
                    <span className="font-semibold text-white block">{p.planName}</span>
                    <span className="text-[11px] text-slate-400">
                      {p.tickets} ventas • ${p.price.toFixed(2)} c/u
                    </span>
                  </div>
                  <span className="font-mono font-bold text-emerald-400 text-sm">
                    ${p.revenue.toFixed(2)}
                  </span>
                </div>
              ))
            )}
          </div>

          <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
            <span>Efectivo en Caja: <strong className="text-white font-mono">${(paymentMethods['CASH'] || 0).toFixed(2)}</strong></span>
            <span>Transferencias: <strong className="text-cyan-400 font-mono">${(paymentMethods['TRANSFER'] || 0).toFixed(2)}</strong></span>
          </div>
        </div>
      </div>

      {/* Detailed Transactions Table */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mb-4">
          <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
            <FileDown className="w-4 h-4 text-cyan-400" />
            Auditoría de Transacciones ({filteredTransactions.length})
          </h3>
          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-500" />
            <input
              type="text"
              placeholder="Buscar PIN, plan o vendedor..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
            />
          </div>
        </div>

        <div className="overflow-x-auto rounded-lg border border-slate-800">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800 font-semibold">
              <tr>
                <th className="py-2.5 px-3">Fecha y Hora</th>
                <th className="py-2.5 px-3">Vendedor</th>
                <th className="py-2.5 px-3">Router</th>
                <th className="py-2.5 px-3">Plan</th>
                <th className="py-2.5 px-3">Ficha / Usuario</th>
                <th className="py-2.5 px-3">Contraseña</th>
                <th className="py-2.5 px-3">Método</th>
                <th className="py-2.5 px-3 text-right">Monto</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono text-slate-300 text-[11px]">
              {filteredTransactions.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-500 font-sans">
                    No se encontraron transacciones
                  </td>
                </tr>
              ) : (
                filteredTransactions.slice(0, 50).map((t) => (
                  <tr key={t.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-2 px-3 text-slate-400 whitespace-nowrap">
                      {t.formattedDate} {t.formattedTime}
                    </td>
                    <td className="py-2 px-3 font-sans font-medium text-white">{t.vendor}</td>
                    <td className="py-2 px-3 font-sans text-slate-300">{t.routerName}</td>
                    <td className="py-2 px-3 font-sans font-medium text-cyan-300">{t.planName}</td>
                    <td className="py-2 px-3 font-bold text-white bg-slate-950/40">{t.username}</td>
                    <td className="py-2 px-3 text-slate-400">{t.password}</td>
                    <td className="py-2 px-3 font-sans">
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                          t.paymentMethod === 'CASH'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                        }`}
                      >
                        {t.paymentMethod === 'CASH' ? 'EFECTIVO' : t.paymentMethod}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-right font-bold text-emerald-400">
                      ${t.amount.toFixed(2)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Exportar PDF / Vista Previa de Impresión Oficial */}
      {showPrintModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-3xl w-full p-6 shadow-2xl flex flex-col max-h-[92vh]">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Printer className="w-4 h-4 text-cyan-400" />
                Reporte de Auditoría y Corte Oficial de Caja
              </h3>
              <button onClick={() => setShowPrintModal(false)} className="p-1 text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Documento Imprimible */}
            <div
              id="printable-report"
              className="flex-1 bg-white text-slate-950 rounded-lg p-6 overflow-y-auto font-sans text-xs space-y-4"
            >
              <div className="border-b-2 border-slate-900 pb-3 flex items-start justify-between">
                <div>
                  <h1 className="text-xl font-extrabold tracking-tight text-slate-900">
                    MIKROFICHAS / MIKROMANAGER
                  </h1>
                  <p className="text-xs text-slate-600 font-medium">
                    Sistema de Gestión y Venta de Internet Hotspot
                  </p>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Emisión: {new Date().toLocaleString('es-MX')} • Router: {selectedRouterId === 'all' ? 'Consolidado General' : routersList.find(r => r.id === selectedRouterId)?.name || 'Todos'}
                  </p>
                </div>
                <div className="text-right">
                  <span className="inline-block px-2.5 py-1 bg-slate-900 text-white font-bold text-[11px] rounded">
                    CORTE OFICIAL
                  </span>
                  <div className="text-[11px] text-slate-600 mt-1 font-mono">
                    Periodo: {period.toUpperCase()}
                  </div>
                </div>
              </div>

              {/* Resumen Ejecutivo */}
              <div className="grid grid-cols-3 gap-3 bg-slate-100 p-3 rounded border border-slate-300">
                <div>
                  <div className="text-[10px] text-slate-600 uppercase font-bold">Total Recaudado</div>
                  <div className="text-xl font-extrabold text-slate-900 font-mono">
                    ${summary ? summary.totalRevenue.toFixed(2) : '0.00'} MXN
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-600 uppercase font-bold">Fichas Vendidas</div>
                  <div className="text-xl font-extrabold text-slate-900 font-mono">
                    {summary ? summary.totalTickets : 0}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-600 uppercase font-bold">Efectivo en Caja</div>
                  <div className="text-xl font-extrabold text-emerald-700 font-mono">
                    ${(paymentMethods['CASH'] || 0).toFixed(2)} MXN
                  </div>
                </div>
              </div>

              {/* Tablas de Desglose */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="font-bold text-slate-900 mb-1 text-[11px] uppercase border-b border-slate-300 pb-1">
                    Desglose por Router
                  </h4>
                  <table className="w-full text-left text-[11px]">
                    <tbody>
                      {byRouter.map((r) => (
                        <tr key={r.routerId} className="border-b border-slate-200">
                          <td className="py-1 font-medium">{r.routerName}</td>
                          <td className="py-1 text-slate-600">{r.tickets} fichas</td>
                          <td className="py-1 text-right font-mono font-bold">${r.revenue.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div>
                  <h4 className="font-bold text-slate-900 mb-1 text-[11px] uppercase border-b border-slate-300 pb-1">
                    Desglose por Plan
                  </h4>
                  <table className="w-full text-left text-[11px]">
                    <tbody>
                      {byPlan.map((p) => (
                        <tr key={p.planName} className="border-b border-slate-200">
                          <td className="py-1 font-medium">{p.planName}</td>
                          <td className="py-1 text-slate-600">{p.tickets} ventas</td>
                          <td className="py-1 text-right font-mono font-bold">${p.revenue.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Últimas Transacciones del Corte */}
              <div>
                <h4 className="font-bold text-slate-900 mb-1 text-[11px] uppercase border-b border-slate-300 pb-1">
                  Detalle de Transacciones (Muestra de Corte)
                </h4>
                <table className="w-full text-left text-[10px]">
                  <thead>
                    <tr className="border-b border-slate-300 text-slate-600">
                      <th className="py-1">Hora</th>
                      <th className="py-1">Vendedor</th>
                      <th className="py-1">Plan</th>
                      <th className="py-1">Usuario PIN</th>
                      <th className="py-1">Método</th>
                      <th className="py-1 text-right">Monto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.slice(0, 20).map((t) => (
                      <tr key={t.id} className="border-b border-slate-100 font-mono">
                        <td className="py-1 text-slate-600">{t.formattedTime}</td>
                        <td className="py-1 font-sans">{t.vendor}</td>
                        <td className="py-1 font-sans">{t.planName}</td>
                        <td className="py-1 font-bold">{t.username}</td>
                        <td className="py-1 font-sans">{t.paymentMethod}</td>
                        <td className="py-1 text-right font-bold">${t.amount.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Firmas de Arqueo */}
              <div className="pt-8 grid grid-cols-2 gap-8 text-center text-[11px]">
                <div className="border-t border-slate-900 pt-2">
                  <p className="font-bold text-slate-900">Firma del Operador / Vendedor</p>
                  <p className="text-slate-500 text-[10px]">Entregó en efectivo</p>
                </div>
                <div className="border-t border-slate-900 pt-2">
                  <p className="font-bold text-slate-900">Firma del Administrador</p>
                  <p className="text-slate-500 text-[10px]">Recibió y validó arqueo</p>
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-between pt-4 mt-4 border-t border-slate-800">
              <span className="text-xs text-slate-400">
                Listo para imprimir en cualquier impresora estándar o Guardar como PDF
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowPrintModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold"
                >
                  Cerrar
                </button>
                <button
                  type="button"
                  onClick={handleDownloadPdf}
                  disabled={exportingPdf}
                  className="flex items-center gap-2 px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs rounded-lg shadow-md transition-all disabled:opacity-50"
                >
                  <FileDown className="w-4 h-4" />
                  {exportingPdf ? 'Descargando...' : 'Descargar Archivo PDF'}
                </button>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="flex items-center gap-2 px-5 py-2 bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold text-xs rounded-lg shadow-md transition-all"
                >
                  <Printer className="w-4 h-4" />
                  Imprimir / Guardar PDF
                </button>

              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
