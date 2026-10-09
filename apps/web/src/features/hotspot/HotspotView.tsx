import React, { useState, useEffect } from 'react';
import {
  Wifi,
  UserX,
  Search,
  RefreshCw,
  Clock,
  AlertCircle,
  Users,
  Smartphone,
  ExternalLink,
  Sparkles,
  CheckCircle,
} from 'lucide-react';

interface ActiveSession {
  id: string; // .id de MikroTik
  user: string;
  address: string;
  macAddress: string;
  uptime: string;
  bytesIn: string;
  bytesOut: string;
}

export const HotspotView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'sessions' | 'portal'>('sessions');
  const [searchTerm, setSearchTerm] = useState('');
  const [sessions, setSessions] = useState<ActiveSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [routerName, setRouterName] = useState<string>('MikroTik');
  const [routerId, setRouterId] = useState<string>('');
  const [routersList, setRoutersList] = useState<{ id: string; name: string }[]>([]);
  const [selectedRouterForPortal, setSelectedRouterForPortal] = useState<string>('');
  const [kickingId, setKickingId] = useState<string | null>(null);
  const [installingPortal, setInstallingPortal] = useState(false);
  const [portalResult, setPortalResult] = useState<{ success: boolean; message: string } | null>(null);


  const fetchActiveSessions = async () => {
    try {
      setLoading(true);
      setErrorMessage(null);
      const res = await fetch('/api/v1/hotspot/active');
      const json = await res.json();

      if (json.success && json.data) {
        setSessions(json.data.sessions || []);
        setRouterName(json.data.routerName || 'MikroTik');
        setRouterId(json.data.routerId || '');
      } else {
        setErrorMessage(
          json.error?.message || 'No se pudo conectar al socket MikroTik para leer sesiones activas.'
        );
        setSessions([]);
      }
    } catch (e: any) {
      setErrorMessage(`Error de red al consultar RouterOS: ${e.message}`);
      setSessions([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchRouters = async () => {
    try {
      const res = await fetch('/api/v1/routers');
      const json = await res.json();
      if (json.success && json.data) {
        setRoutersList(json.data.map((r: any) => ({ id: r.id, name: r.name })));
        if (json.data.length > 0 && !selectedRouterForPortal) {
          setSelectedRouterForPortal(json.data[0].id);
        }
      }
    } catch {}
  };

  useEffect(() => {
    fetchActiveSessions();
    fetchRouters();
  }, []);

  const handleInstallPortal = async () => {
    const targetId = selectedRouterForPortal || routersList[0]?.id || routerId;
    if (!targetId) {
      alert('Por favor selecciona un router');
      return;
    }

    try {
      setInstallingPortal(true);
      setPortalResult(null);
      const res = await fetch(`/api/v1/routers/${targetId}/hotspot/install-template`, {
        method: 'POST',
      });
      const json = await res.json();
      setPortalResult({
        success: json.success,
        message: json.message,
      });
    } catch (e: any) {
      setPortalResult({
        success: false,
        message: `Fallo de conexión al instalar portal: ${e.message}`,
      });
    } finally {
      setInstallingPortal(false);
    }
  };

  const handleKick = async (id: string, user: string) => {
    if (!confirm(`¿Expulsar la sesión activa de '${user}' en MikroTik?`)) return;
    setKickingId(id);

    try {
      const res = await fetch('/api/v1/hotspot/kick', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          routerId: routerId || 'default',
          sessionId: id,
        }),
      });

      const json = await res.json();
      if (json.success) {
        fetchActiveSessions();
      } else {
        alert(json.error?.message || 'Error al expulsar sesión');
      }
    } catch (e: any) {
      alert(`Fallo al expulsar: ${e.message}`);
    } finally {
      setKickingId(null);
    }
  };

  const filtered = sessions.filter(
    (s) =>
      s.user.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.address.includes(searchTerm) ||
      s.macAddress.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Sub Tabs Selector */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
        <button
          onClick={() => setActiveTab('sessions')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
            activeTab === 'sessions'
              ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <Users className="w-4 h-4" />
          Sesiones Activas ({sessions.length})
        </button>

        <button
          onClick={() => setActiveTab('portal')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
            activeTab === 'portal'
              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <Sparkles className="w-4 h-4 text-emerald-400" />
          Portal Cautivo Fichas Sarmientos
        </button>
      </div>

      {activeTab === 'portal' && (
        <div className="space-y-6 animate-fadeIn">
          {/* Header */}
          <div className="bg-slate-900/90 border border-slate-800 p-5 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-extrabold text-white">Portal Cautivo Wi-Fi: Fichas Sarmientos</span>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold">
                  Diseño Exclusivo
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Optimizado para teléfonos Android/iOS con tema Dark Glassmorphism, auto-login por PIN/QR y botón directo de WhatsApp.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <a
                href="/api/v1/hotspot/template/preview"
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5 text-cyan-400" />
                Abrir en Pantalla Completa
              </a>
            </div>
          </div>

          {/* Result Alert Banner */}
          {portalResult && (
            <div
              className={`p-4 rounded-xl text-xs flex items-center gap-3 ${
                portalResult.success
                  ? 'bg-emerald-950/40 text-emerald-300 border border-emerald-500/40'
                  : 'bg-amber-950/40 text-amber-300 border border-amber-500/40'
              }`}
            >
              {portalResult.success ? (
                <CheckCircle className="w-5 h-5 text-emerald-400 flex-shrink-0" />
              ) : (
                <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0" />
              )}
              <span className="font-medium">{portalResult.message}</span>
            </div>
          )}

          {/* Grid Layout: Phone Mockup + Controls */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Phone Mockup Frame */}
            <div className="lg:col-span-5 flex justify-center">
              <div className="w-[340px] h-[640px] bg-slate-950 border-4 border-slate-800 rounded-[36px] p-2.5 shadow-2xl relative flex flex-col">
                <div className="w-24 h-4 bg-slate-800 rounded-full mx-auto mb-2 flex-shrink-0" />
                <div className="flex-1 rounded-[26px] overflow-hidden border border-slate-800/80">
                  <iframe
                    src="/api/v1/hotspot/template/preview"
                    title="Vista Previa Fichas Sarmientos"
                    className="w-full h-full bg-[#090D16]"
                  />
                </div>
              </div>
            </div>

            {/* Control & Installation Panel */}
            <div className="lg:col-span-7 space-y-5">
              <div className="bg-slate-900/90 border border-slate-800 p-5 rounded-xl space-y-4">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Smartphone className="w-4 h-4 text-cyan-400" />
                  Instalación Directa en MikroTik
                </h3>

                <p className="text-xs text-slate-400 leading-relaxed">
                  Puedes inyectar este portal automáticamente a la memoria del MikroTik. El sistema subirá <span className="font-mono text-cyan-300">login.html</span>, <span className="font-mono text-cyan-300">status.html</span> y <span className="font-mono text-cyan-300">logout.html</span> a la carpeta <span className="font-mono text-cyan-300">hotspot/</span> del router.
                </p>

                {routersList.length > 0 && (
                  <div>
                    <label className="text-xs text-slate-400 font-semibold block mb-1">Router Destino:</label>
                    <select
                      value={selectedRouterForPortal || routersList[0]?.id}
                      onChange={(e) => setSelectedRouterForPortal(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 text-white rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-cyan-500"
                    >
                      {routersList.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleInstallPortal}
                  disabled={installingPortal}
                  className="w-full py-3 bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-slate-950 font-extrabold rounded-lg text-xs shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <Sparkles className="w-4 h-4" />
                  {installingPortal ? 'Instalando en MikroTik...' : '⚡ Instalar Portal Cautivo en MikroTik (1 Clic)'}
                </button>
              </div>

              {/* Package Details */}
              <div className="bg-slate-900/90 border border-slate-800 p-5 rounded-xl space-y-3">
                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Archivos Incluidos</h4>
                <div className="space-y-2 text-xs">
                  <div className="p-2.5 bg-slate-950 rounded-lg border border-slate-800/80 flex items-center justify-between">
                    <div>
                      <div className="font-mono font-bold text-cyan-400">hotspot/login.html</div>
                      <div className="text-[11px] text-slate-400">Login con PIN único, soporte QR y botón de WhatsApp</div>
                    </div>
                    <span className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded font-mono">Principal</span>
                  </div>

                  <div className="p-2.5 bg-slate-950 rounded-lg border border-slate-800/80 flex items-center justify-between">
                    <div>
                      <div className="font-mono font-bold text-emerald-400">hotspot/status.html</div>
                      <div className="text-[11px] text-slate-400">Panel en vivo de tiempo restante y datos consumidos</div>
                    </div>
                    <span className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded font-mono">Sesión</span>
                  </div>

                  <div className="p-2.5 bg-slate-950 rounded-lg border border-slate-800/80 flex items-center justify-between">
                    <div>
                      <div className="font-mono font-bold text-amber-400">hotspot/logout.html</div>
                      <div className="text-[11px] text-slate-400">Pantalla de pausa de sesión para conservar tiempo</div>
                    </div>
                    <span className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded font-mono">Pausa</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'sessions' && (
        <div className="space-y-6">
          {/* Control bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-900/90 border border-slate-800 p-4 rounded-xl">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                placeholder="Buscar por PIN, IP o MAC..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition-colors"
              />
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
              <span className="text-xs text-slate-400">
                Nodo: <strong className="text-cyan-400">{routerName}</strong> • En línea:{' '}
                <strong className="text-white">{filtered.length}</strong>
              </span>
              <button
                onClick={fetchActiveSessions}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition-colors"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-cyan-400 ${loading ? 'animate-spin' : ''}`} />
                Actualizar
              </button>
            </div>
          </div>


      {/* Error state if router offline */}
      {errorMessage && (
        <div className="p-4 rounded-xl bg-amber-950/20 border border-amber-500/30 text-xs text-amber-300 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
          <div>
            <span className="font-bold block text-sm text-amber-200">
              Router no conectado o API deshabilitada
            </span>
            <p className="mt-1 text-amber-300/80">{errorMessage}</p>
            <p className="mt-2 text-slate-400">
              💡 Para ver sesiones en tiempo real, verifica en la pestaña "Routers MikroTik" que tu IP y credenciales sean correctas y que el servicio API esté activo en MikroTik (`/ip service enable api`).
            </p>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!loading && !errorMessage && sessions.length === 0 && (
        <div className="p-12 text-center text-slate-400 bg-slate-900/60 rounded-xl border border-slate-800">
          <Users className="w-10 h-10 mx-auto text-slate-600 mb-3" />
          <h3 className="text-base font-bold text-white mb-1">No hay usuarios conectados en este momento</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            Cuando los clientes ingresen su PIN en el portal cautivo de MikroTik, aparecerán reflejados aquí automáticamente con su IP, MAC y consumo de megabytes.
          </p>
        </div>
      )}

      {/* Sessions Table */}
      {sessions.length > 0 && (
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/60 text-slate-400 uppercase font-semibold border-b border-slate-800 tracking-wider">
                <tr>
                  <th className="py-3.5 px-4">Usuario / PIN</th>
                  <th className="py-3.5 px-4">Dirección IP</th>
                  <th className="py-3.5 px-4">Dirección MAC</th>
                  <th className="py-3.5 px-4">Tiempo Conectado</th>
                  <th className="py-3.5 px-4">Consumo (Subida / Bajada)</th>
                  <th className="py-3.5 px-4 text-right">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80 font-mono">
                {filtered.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-3 px-4 font-bold text-cyan-400 flex items-center gap-2 font-sans">
                      <Wifi className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                      <span>{s.user}</span>
                    </td>
                    <td className="py-3 px-4 text-slate-200">{s.address}</td>
                    <td className="py-3 px-4 text-slate-400">{s.macAddress}</td>
                    <td className="py-3 px-4 text-emerald-400 flex items-center gap-1 font-sans">
                      <Clock className="w-3 h-3 text-slate-500" />
                      {s.uptime}
                    </td>
                    <td className="py-3 px-4 text-slate-300">
                      <span className="text-emerald-400 font-mono">↓ {s.bytesOut}</span>
                      <span className="mx-1 text-slate-600">/</span>
                      <span className="text-cyan-400 font-mono">↑ {s.bytesIn}</span>
                    </td>
                    <td className="py-3 px-4 text-right font-sans">
                      <button
                        onClick={() => handleKick(s.id, s.user)}
                        disabled={kickingId === s.id}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 font-medium transition-colors disabled:opacity-50"
                        title="Desconectar usuario (Kick)"
                      >
                        <UserX className="w-3.5 h-3.5" />
                        {kickingId === s.id ? 'Expulsando...' : 'Kick'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
        </div>
      )}
    </div>
  );
};

