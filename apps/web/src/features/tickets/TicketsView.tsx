import React, { useState, useEffect } from 'react';
import {
  Ticket as TicketIcon,
  Plus,
  RefreshCw,
  Printer,
  X,
  CheckSquare,
  Square,
} from 'lucide-react';
import { TicketPrintModal, PrintableTicket } from './TicketPrintModal';

interface TicketItem {
  id: string;
  username: string;
  password: string;
  status: string;
  createdAt: string;
  plan: {
    id: string;
    name: string;
    price: number;
    durationSeconds: number;
    downloadSpeedKbps?: number;
    uploadSpeedKbps?: number;
  };
  router: {
    id: string;
    name: string;
    host?: string;
  };
}

export const TicketsView: React.FC = () => {
  const [tickets, setTickets] = useState<TicketItem[]>([]);
  const [plans, setPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState('ALL');
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [printTickets, setPrintTickets] = useState<PrintableTicket[] | null>(null);

  const [generateForm, setGenerateForm] = useState({
    planId: '',
    quantity: 10,
    prefix: '',
    pinLength: 5,
    authType: 'USER_PASSWORD' as 'USER_PASSWORD' | 'PIN_ONLY',
    syncAllRouters: true,
  });

  const fetchData = async () => {
    try {
      setLoading(true);
      const [ticketsRes, plansRes] = await Promise.all([
        fetch('/api/v1/tickets').then((r) => r.json()),
        fetch('/api/v1/plans').then((r) => r.json()),
      ]);

      if (ticketsRes.success && ticketsRes.data) {
        setTickets(ticketsRes.data);
      }
      if (plansRes.success && plansRes.data) {
        setPlans(plansRes.data);
        if (plansRes.data.length > 0 && !generateForm.planId) {
          setGenerateForm((prev) => ({ ...prev, planId: plansRes.data[0].id }));
        }
      }
    } catch (e) {
      console.error('Error al cargar tickets:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleGenerateBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    const selectedPlan = plans.find((p) => p.id === generateForm.planId);
    if (!selectedPlan) {
      alert('Selecciona un plan');
      return;
    }

    try {
      const payload = {
        routerId: selectedPlan.routerId,
        planId: selectedPlan.id,
        quantity: Number(generateForm.quantity),
        prefix: generateForm.prefix,
        pinLength: Number(generateForm.pinLength),
        authType: generateForm.authType,
        syncAllRouters: generateForm.syncAllRouters,
      };

      const res = await fetch('/api/v1/tickets/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (json.success && json.data) {
        setShowGenerateModal(false);
        fetchData();

        if (json.data.syncedRouters && json.data.syncedRouters.length > 1) {
          alert(`🌐 Fichas Universales Generadas y Sincronizadas:\n` + json.data.syncedRouters.join('\n'));
        }

        // Convert generated tickets to PrintableTicket format and open print modal
        const printableList: PrintableTicket[] = (json.data.tickets || []).map((t: any) => ({
          pin: t.pin || t.username,
          username: t.username,
          password: t.password,
          planName: json.data.planName || selectedPlan.name,
          price: json.data.price || selectedPlan.price,
          durationSeconds: json.data.durationSeconds || selectedPlan.durationSeconds,
          speed: selectedPlan.downloadSpeedKbps
            ? `${selectedPlan.downloadSpeedKbps / 1024}M / ${selectedPlan.uploadSpeedKbps / 1024}M`
            : undefined,
          routerName: selectedPlan.routerName,
        }));

        setPrintTickets(printableList);
      } else {
        alert(json.error?.message || 'Error al generar fichas');
      }
    } catch (err: any) {
      alert(`Error al generar: ${err.message}`);
    }
  };

  const filtered = tickets.filter((t) => {
    if (activeFilter === 'ALL') return true;
    return t.status === activeFilter;
  });

  const toggleSelectAll = () => {
    if (selectedIds.size === filtered.length && filtered.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map((t) => t.id)));
    }
  };

  const toggleSelectOne = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedIds(next);
  };

  const mapTicketToPrintable = (t: TicketItem): PrintableTicket => ({
    pin: t.username,
    username: t.username,
    password: t.password,
    planName: t.plan?.name || 'Internet Wi-Fi',
    price: t.plan?.price || 0,
    durationSeconds: t.plan?.durationSeconds,
    speed:
      t.plan?.downloadSpeedKbps && t.plan?.uploadSpeedKbps
        ? `${t.plan.downloadSpeedKbps / 1024}M / ${t.plan.uploadSpeedKbps / 1024}M`
        : undefined,
    routerName: t.router?.name,
  });

  const handlePrintSelected = () => {
    const toPrint = tickets.filter((t) => selectedIds.has(t.id)).map(mapTicketToPrintable);
    if (toPrint.length === 0) return;
    setPrintTickets(toPrint);
  };

  const handlePrintAllAvailable = () => {
    const toPrint = tickets
      .filter((t) => t.status === 'AVAILABLE')
      .map(mapTicketToPrintable);
    if (toPrint.length === 0) {
      alert('No hay fichas disponibles en inventario para imprimir.');
      return;
    }
    setPrintTickets(toPrint);
  };

  const handlePrintSingle = (t: TicketItem) => {
    setPrintTickets([mapTicketToPrintable(t)]);
  };

  const availableCount = tickets.filter((t) => t.status === 'AVAILABLE').length;

  return (
    <div className="space-y-6">
      {/* Top action header */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-900/90 border border-slate-800 p-4 rounded-xl shadow-lg">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
            <TicketIcon className="w-5 h-5 text-cyan-400" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              Inventario de Fichas (Tickets)
              <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-mono">
                {availableCount} Disponibles
              </span>
            </h2>
            <p className="text-xs text-slate-400">
              PINs generados y listos para venta e impresión en tiras térmicas (58mm/80mm)
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Print Selected */}
          {selectedIds.size > 0 && (
            <button
              onClick={handlePrintSelected}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold text-xs shadow-md transition-all"
            >
              <Printer className="w-4 h-4" />
              Imprimir Seleccionadas ({selectedIds.size})
            </button>
          )}

          {/* Print All Available */}
          {availableCount > 0 && selectedIds.size === 0 && (
            <button
              onClick={handlePrintAllAvailable}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-emerald-500/30 text-xs font-semibold shadow-sm transition-all"
            >
              <Printer className="w-4 h-4" />
              Imprimir Disponibles ({availableCount})
            </button>
          )}

          <button
            onClick={fetchData}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-cyan-400' : ''}`} />
            Actualizar
          </button>

          <button
            onClick={() => setShowGenerateModal(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold text-xs shadow-md transition-all"
          >
            <Plus className="w-4 h-4" />
            Generar Lote
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-3 text-xs">
        <div className="flex items-center gap-2">
          {['ALL', 'AVAILABLE', 'SOLD', 'ACTIVE'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveFilter(tab)}
              className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
                activeFilter === tab
                  ? 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/30 font-bold'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              {tab === 'ALL' && `Todas (${tickets.length})`}
              {tab === 'AVAILABLE' && `Disponibles (${availableCount})`}
              {tab === 'SOLD' && `Vendidas (${tickets.filter((t) => t.status === 'SOLD').length})`}
              {tab === 'ACTIVE' && `En Uso (${tickets.filter((t) => t.status === 'ACTIVE').length})`}
            </button>
          ))}
        </div>

        {filtered.length > 0 && (
          <div className="flex items-center gap-2 text-slate-400">
            <button
              onClick={toggleSelectAll}
              className="flex items-center gap-1.5 text-xs hover:text-white transition-colors"
            >
              {selectedIds.size === filtered.length && filtered.length > 0 ? (
                <CheckSquare className="w-4 h-4 text-cyan-400" />
              ) : (
                <Square className="w-4 h-4 text-slate-500" />
              )}
              {selectedIds.size === filtered.length && filtered.length > 0
                ? 'Deseleccionar todo'
                : 'Seleccionar todo'}
            </button>
          </div>
        )}
      </div>

      {/* Tickets Table */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-950/60 text-slate-400 uppercase font-semibold border-b border-slate-800 tracking-wider">
            <tr>
              <th className="py-3.5 px-4 w-10 text-center">
                <input
                  type="checkbox"
                  checked={selectedIds.size === filtered.length && filtered.length > 0}
                  onChange={toggleSelectAll}
                  className="rounded accent-cyan-500 cursor-pointer"
                />
              </th>
              <th className="py-3.5 px-4">PIN / Usuario Hotspot</th>
              <th className="py-3.5 px-4">Plan Asignado</th>
              <th className="py-3.5 px-4">Precio</th>
              <th className="py-3.5 px-4">Router</th>
              <th className="py-3.5 px-4">Estado</th>
              <th className="py-3.5 px-4">Fecha Creación</th>
              <th className="py-3.5 px-4 text-right">Acción</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/80">
            {filtered.map((t) => {
              const isSelected = selectedIds.has(t.id);
              return (
                <tr
                  key={t.id}
                  className={`hover:bg-slate-800/30 transition-colors ${
                    isSelected ? 'bg-cyan-950/20' : ''
                  }`}
                >
                  <td className="py-3 px-4 text-center">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSelectOne(t.id)}
                      className="rounded accent-cyan-500 cursor-pointer"
                    />
                  </td>
                  <td className="py-3 px-4 font-mono">
                    <div className="flex items-center gap-1.5 font-bold text-white">
                      <span
                        className={`w-2 h-2 rounded-full ${
                          t.status === 'AVAILABLE'
                            ? 'bg-emerald-400'
                            : t.status === 'SOLD'
                            ? 'bg-blue-400'
                            : 'bg-cyan-400'
                        }`}
                      />
                      <span>{t.username}</span>
                    </div>
                    {t.password && t.password !== t.username && (
                      <div className="text-[10px] text-slate-400 font-mono mt-0.5 ml-3.5">
                        Clave: <span className="text-cyan-300 font-semibold">{t.password}</span>
                      </div>
                    )}
                  </td>
                  <td className="py-3 px-4 font-semibold text-slate-200">
                    {t.plan?.name}
                    {t.plan?.durationSeconds && (
                      <span className="text-[10px] text-slate-400 block">
                        {Math.floor(t.plan.durationSeconds / 3600)} horas
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4 font-mono text-emerald-400 font-bold">
                    ${t.plan?.price?.toFixed(2)}
                  </td>
                  <td className="py-3 px-4 text-slate-400">{t.router?.name}</td>
                  <td className="py-3 px-4">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                        t.status === 'AVAILABLE'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : t.status === 'ACTIVE'
                          ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20'
                          : t.status === 'SOLD'
                          ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {t.status === 'AVAILABLE'
                        ? 'DISPONIBLE'
                        : t.status === 'SOLD'
                        ? 'VENDIDA'
                        : t.status === 'ACTIVE'
                        ? 'EN USO'
                        : t.status}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-slate-400 font-mono">
                    {new Date(t.createdAt).toLocaleDateString()} {new Date(t.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <button
                      onClick={() => handlePrintSingle(t)}
                      title="Imprimir Ficha Térmica"
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-emerald-400 transition-colors inline-flex items-center gap-1"
                    >
                      <Printer className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Modal: Generar Lote */}
      {showGenerateModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-md w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Plus className="w-4 h-4 text-cyan-400" />
                Generar Lote Masivo de Fichas
              </h3>
              <button
                onClick={() => setShowGenerateModal(false)}
                className="p-1 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleGenerateBatch} className="space-y-4 text-xs">
              <div>
                <label className="text-slate-300 font-semibold block mb-1">Selecciona el Plan:</label>
                <select
                  value={generateForm.planId}
                  onChange={(e) => setGenerateForm({ ...generateForm, planId: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-cyan-500"
                  required
                >
                  {plans.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} (${p.price}) - {p.routerName}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-slate-300 font-semibold block mb-1">Tipo de Credenciales:</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setGenerateForm({ ...generateForm, authType: 'USER_PASSWORD' })}
                    className={`py-2 px-3 rounded-lg border text-left transition-all ${
                      generateForm.authType === 'USER_PASSWORD'
                        ? 'bg-cyan-500/15 border-cyan-500 text-cyan-400 font-bold'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <div className="text-xs">👤 Usuario y Clave</div>
                    <div className="text-[10px] opacity-75">5 dígitos numéricos c/u</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setGenerateForm({ ...generateForm, authType: 'PIN_ONLY' })}
                    className={`py-2 px-3 rounded-lg border text-left transition-all ${
                      generateForm.authType === 'PIN_ONLY'
                        ? 'bg-cyan-500/15 border-cyan-500 text-cyan-400 font-bold'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <div className="text-xs">🔑 Solo PIN</div>
                    <div className="text-[10px] opacity-75">5 dígitos iguales</div>
                  </button>
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-slate-300 font-semibold">Cantidad de Fichas:</label>
                  <div className="flex gap-1">
                    {[10, 25, 50, 100].map((q) => (
                      <button
                        key={q}
                        type="button"
                        onClick={() => setGenerateForm({ ...generateForm, quantity: q })}
                        className={`px-2 py-0.5 rounded text-[11px] font-mono border ${
                          generateForm.quantity === q
                            ? 'bg-cyan-600 text-slate-950 font-bold border-cyan-500'
                            : 'bg-slate-950 text-slate-400 border-slate-800'
                        }`}
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
                <input
                  type="number"
                  min="1"
                  max="500"
                  value={generateForm.quantity}
                  onChange={(e) => setGenerateForm({ ...generateForm, quantity: Number(e.target.value) })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 font-mono text-cyan-400 font-bold focus:outline-none focus:border-cyan-500"
                  required
                />
              </div>

              <div>
                <label className="text-slate-300 font-semibold block mb-1">Prefijo (Opcional):</label>
                <input
                  type="text"
                  placeholder="Ej: SAR o dejar vacío"
                  value={generateForm.prefix}
                  onChange={(e) => setGenerateForm({ ...generateForm, prefix: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 font-mono text-white focus:outline-none focus:border-cyan-500"
                />
              </div>

              {/* Opción Multizona / Sincronización en todos los routers */}
              <div className="p-3 rounded-lg bg-indigo-500/10 border border-indigo-500/30">
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={generateForm.syncAllRouters}
                    onChange={(e) => setGenerateForm({ ...generateForm, syncAllRouters: e.target.checked })}
                    className="mt-0.5 rounded bg-slate-950 border-slate-700 text-indigo-500 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                  />
                  <div>
                    <span className="text-xs font-bold text-indigo-300 block">
                      🌐 Sincronizar en todos mis MikroTiks (Ficha Universal)
                    </span>
                    <span className="text-[10px] text-slate-400 block mt-0.5">
                      Crea este mismo lote de fichas en todos tus routers registrados. Tu cliente podrá usar el mismo PIN en el Centro, en la Tienda 2 o en otro pueblo.
                    </span>
                  </div>
                </label>
              </div>

              <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-[11px] text-emerald-300 space-y-1">
                <div>🔒 <strong>CSPRNG Seguro:</strong> 5 dígitos numéricos aleatorios (sin letras).</div>
                <div>🚫 <strong>Sin repetición:</strong> Validados contra la base de datos para cero colisiones.</div>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowGenerateModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold rounded-lg shadow-md"
                >
                  Generar Lote &amp; Imprimir
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Ticket Print Modal */}
      {printTickets && printTickets.length > 0 && (
        <TicketPrintModal
          tickets={printTickets}
          brandName="Fichas Sarmientos"
          onClose={() => setPrintTickets(null)}
        />
      )}
    </div>
  );
};
