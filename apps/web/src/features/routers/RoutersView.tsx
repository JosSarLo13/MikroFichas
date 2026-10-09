import React, { useState, useEffect } from 'react';
import {
  HardDrive,
  Plus,
  RefreshCw,
  Shield,
  Trash2,
  X,
  CheckCircle,
  AlertCircle,
  Server,
  Terminal,
  Copy,
  Check,
  Globe,
  Edit3,
  Sliders,
  Zap,
  Clock,
  Wifi,
  Radio,
  Activity,
  Cpu,
  Layers,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';


export interface DiscoveredDevice {
  mac: string;
  identity: string;
  version: string;
  platform: string;
  board: string;
  uptimeSeconds: number | null;
  softwareId: string;
  interfaceName: string;
  ipv4: string | null;
  ipv6: string | null;
  source: 'mndp' | 'probe';
  apiPort: 'open' | 'refused' | 'filtered' | 'no-ip';
  winboxPort: 'open' | 'refused' | 'filtered' | 'no-ip';
  isRegistered: boolean;
  registeredRouterId?: string | null;
  registeredRouterName?: string | null;
}

interface RouterItem {
  id: string;
  name: string;
  host: string;
  apiPort: number;
  useSsl: boolean;
  username: string;
  rosVersion?: string | null;
  identity?: string | null;
  status: 'ONLINE' | 'OFFLINE' | 'ERROR' | 'UNCHECKED';
  _count?: { plans: number; tickets: number };
}


export const RoutersView: React.FC = () => {
  const [routers, setRouters] = useState<RouterItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [bootstrapScript, setBootstrapScript] = useState<{
    routerName: string;
    script: string;
    quickUnlockCommand?: string;
    ntpScript?: string;
    hotspotScript?: string;
    hotspotSubnet?: string;
    hotspotGateway?: string;
  } | null>(null);
  const [loadingScriptId, setLoadingScriptId] = useState<string | null>(null);
  const [copiedScript, setCopiedScript] = useState(false);
  const [showRemoteGuide, setShowRemoteGuide] = useState(false);
  const [copiedCmd, setCopiedCmd] = useState<string | null>(null);
  const [ztNetworkId, setZtNetworkId] = useState('b9a18a606f03ddb5');
  const [ztRemoteIp, setZtRemoteIp] = useState('');
  const [ztSelectedRouter, setZtSelectedRouter] = useState<string>('');
  const [ztStatusMsg, setZtStatusMsg] = useState<{ success: boolean; text: string } | null>(null);
  const [applyingZt, setApplyingZt] = useState(false);
  const [connectingRemote, setConnectingRemote] = useState(false);
  const [testResult, setTestResult] = useState<{ id: string; success: boolean; message: string } | null>(null);

  // Router Details & 1-Click Auto-Provision States
  const [selectedRouterDetails, setSelectedRouterDetails] = useState<RouterItem | null>(null);
  const [telemetryData, setTelemetryData] = useState<any | null>(null);
  const [loadingTelemetry, setLoadingTelemetry] = useState(false);
  const [autoProvisioning, setAutoProvisioning] = useState(false);
  const [autoProvisionResult, setAutoProvisionResult] = useState<{
    success: boolean;
    steps: Array<{ id: string; title: string; description: string; status: 'SUCCESS' | 'ERROR' | 'WARNING'; detail: string }>;
    summary: string;
  } | null>(null);
  const [autoProvisionError, setAutoProvisionError] = useState<string | null>(null);
  const [showManualInModal, setShowManualInModal] = useState(false);

  // Winbox Discovery & Neighbors States
  const [showDiscoveryModal, setShowDiscoveryModal] = useState(false);
  const [scanningDevices, setScanningDevices] = useState(false);
  const [discoveredDevices, setDiscoveredDevices] = useState<DiscoveredDevice[]>([]);
  const [scanError, setScanError] = useState<string | null>(null);

  // Quick Connect Dialog for discovered device
  const [quickConnectDevice, setQuickConnectDevice] = useState<DiscoveredDevice | null>(null);
  const [connectVia, setConnectVia] = useState<'ip' | 'mac'>('ip');
  const [quickConnectName, setQuickConnectName] = useState('');
  const [quickConnectUser, setQuickConnectUser] = useState('admin');
  const [quickConnectPass, setQuickConnectPass] = useState('');
  const [quickConnecting, setQuickConnecting] = useState(false);
  const [quickConnectError, setQuickConnectError] = useState<string | null>(null);
  const [quickConnectSuccess, setQuickConnectSuccess] = useState<string | null>(null);

  // Modo IP y sugerencias automáticas
  const [ipMode, setIpMode] = useState<'AUTO' | 'MANUAL'>('AUTO');

  const [suggestedIpData, setSuggestedIpData] = useState<{
    suggestedHost: string;
    suggestedSubnet: string;
    suggestedGateway: string;
    occupiedHosts: string[];
    occupiedSubnets: string[];
  } | null>(null);

  // Formulario nuevo router
  const [formData, setFormData] = useState({
    name: '',
    host: '192.168.88.1',
    apiPort: 8728,
    useSsl: false,
    username: 'admin',
    password: '',
  });

  // Modal de edición de router
  const [editingRouter, setEditingRouter] = useState<RouterItem | null>(null);
  const [editFormData, setEditFormData] = useState({
    name: '',
    host: '',
    apiPort: 8728,
    useSsl: false,
    username: 'admin',
    password: '',
  });

  const fetchIpSuggestions = async () => {
    try {
      const res = await fetch('/api/v1/routers/suggest-ip');
      const json = await res.json();
      if (json.success && json.data) {
        setSuggestedIpData(json.data);
        if (ipMode === 'AUTO') {
          setFormData((prev) => ({
            ...prev,
            host: json.data.suggestedHost,
          }));
        }
      }
    } catch (e) {
      console.error('Error al obtener sugerencias de IP:', e);
    }
  };

  const fetchRouters = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/v1/routers');
      const json = await res.json();
      if (json.success && json.data) {
        setRouters(json.data);
      }
    } catch (e) {
      console.error('Error al obtener routers:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRouters();
    fetchIpSuggestions();
  }, []);

  const handleOpenRouterDetails = (router: RouterItem) => {
    setSelectedRouterDetails(router);
    setTelemetryData(null);
    setAutoProvisionResult(null);
    setAutoProvisionError(null);
    setShowManualInModal(false);
    fetchRouterTelemetry(router.id);
  };

  const fetchRouterTelemetry = async (routerId: string) => {
    setLoadingTelemetry(true);
    try {
      const res = await fetch(`/api/v1/routers/${routerId}/telemetry`);
      const json = await res.json();
      if (json.success && json.data) {
        setTelemetryData(json.data);
      }
    } catch (err: any) {
      console.error('Error fetching router telemetry:', err);
    } finally {
      setLoadingTelemetry(false);
    }
  };

  const handleExecuteAutoProvision = async (routerId: string) => {
    setAutoProvisioning(true);
    setAutoProvisionError(null);
    setAutoProvisionResult(null);
    try {
      const res = await fetch(`/api/v1/routers/${routerId}/auto-provision`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const json = await res.json();
      if (json.success && json.data) {
        setAutoProvisionResult(json.data);
        fetchRouterTelemetry(routerId);
        fetchRouters();
      } else {
        setAutoProvisionError(json.error?.message || json.message || 'Error durante la auto-configuración del MikroTik.');
      }
    } catch (err: any) {
      setAutoProvisionError(`Fallo de conexión al router: ${err.message}`);
    } finally {
      setAutoProvisioning(false);
    }
  };

  const handleOpenEdit = (router: RouterItem) => {
    setEditingRouter(router);
    setEditFormData({
      name: router.name,
      host: router.host,
      apiPort: router.apiPort,
      useSsl: router.useSsl,
      username: router.username,
      password: '',
    });
    fetchIpSuggestions();
  };

  const handleUpdateRouter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRouter) return;
    try {
      const payload: any = {
        name: editFormData.name.trim(),
        host: editFormData.host.trim(),
        apiPort: Number(editFormData.apiPort),
        useSsl: editFormData.useSsl,
        username: editFormData.username.trim(),
      };
      if (editFormData.password.trim().length > 0) {
        payload.password = editFormData.password.trim();
      }
      const res = await fetch(`/api/v1/routers/${editingRouter.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (json.success) {
        setEditingRouter(null);
        fetchRouters();
      } else {
        alert(json.error?.message || json.message || 'Error al actualizar router');
      }
    } catch (err: any) {
      alert(`Error al actualizar router: ${err.message}`);
    }
  };

  const handleTestConnection = async (id: string) => {
    setTestingId(id);
    setTestResult(null);
    try {
      const res = await fetch(`/api/v1/routers/${id}/test`, {
        method: 'POST',
      });
      const json = await res.json();
      if (json.success) {
        setTestResult({
          id,
          success: true,
          message: json.message || `Conexión exitosa (${json.data.latencyMs}ms)`,
        });
      } else {
        setTestResult({
          id,
          success: false,
          message: json.error?.message || 'No se pudo conectar al router',
        });
      }
      fetchRouters();
    } catch (e: any) {
      setTestResult({
        id,
        success: false,
        message: `Fallo de red al probar conexión: ${e.message}`,
      });
    } finally {
      setTestingId(null);
    }
  };

  const [syncingId, setSyncingId] = useState<string | null>(null);

  const handleSyncTickets = async (id: string, name: string) => {
    setSyncingId(id);
    try {
      const res = await fetch(`/api/v1/routers/${id}/sync-tickets`, { method: 'POST' });
      const json = await res.json();
      if (json.success) {
        alert(json.message || `Fichas sincronizadas con éxito en ${name}`);
        fetchRouters();
      } else {
        alert(json.message || 'No se pudieron sincronizar las fichas');
      }
    } catch (e: any) {
      alert(`Error de red al sincronizar: ${e.message}`);
    } finally {
      setSyncingId(null);
    }
  };

  const handleCreateRouter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.host || !formData.username) {
      alert('Por favor completa todos los campos requeridos');
      return;
    }

    try {
      const res = await fetch('/api/v1/routers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      const json = await res.json();
      if (json.success) {
        setShowAddModal(false);
        setFormData({
          name: '',
          host: '192.168.88.1',
          apiPort: 8728,
          useSsl: false,
          username: 'admin',
          password: '',
        });
        fetchRouters();
        fetchIpSuggestions();
      } else {
        alert(json.error?.message || 'Error al guardar router');
      }
    } catch (err: any) {
      alert(`Error al registrar router: ${err.message}`);
    }
  };

  const handleScanNetwork = async () => {
    setScanningDevices(true);
    setScanError(null);
    setQuickConnectDevice(null);
    setQuickConnectError(null);
    setQuickConnectSuccess(null);
    try {
      const res = await fetch('/api/v1/routers/discover?timeoutMs=3500');
      const json = await res.json();
      if (json.success && json.data) {
        setDiscoveredDevices(json.data);
      } else {
        setScanError(json.error?.message || 'No se pudo completar el escaneo de red.');
      }
    } catch (err: any) {
      setScanError(`Error al escanear: ${err.message}`);
    } finally {
      setScanningDevices(false);
    }
  };

  const handleSelectDeviceToConnect = (device: DiscoveredDevice, mode: 'ip' | 'mac') => {
    setQuickConnectDevice(device);
    setConnectVia(mode);
    setQuickConnectName(device.identity && device.identity !== 'MikroTik' ? device.identity : (device.board || 'MikroTik'));
    setQuickConnectUser('admin');
    setQuickConnectPass('');
    setQuickConnectError(null);
    setQuickConnectSuccess(null);
  };

  const handleExecuteQuickConnect = async () => {
    if (!quickConnectDevice) return;
    const targetHost = (connectVia === 'ip' ? quickConnectDevice.ipv4 : quickConnectDevice.ipv4) || '192.168.88.1';

    setQuickConnecting(true);
    setQuickConnectError(null);
    setQuickConnectSuccess(null);

    try {
      const res = await fetch('/api/v1/routers/quick-connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: quickConnectName.trim() || quickConnectDevice.identity,
          host: targetHost,
          apiPort: 8728,
          useSsl: false,
          username: quickConnectUser.trim(),
          password: quickConnectPass,
          connectVia,
          mac: quickConnectDevice.mac,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || json.message || 'Error al conectar');
      }

      setQuickConnectSuccess(json.message || 'Router conectado exitosamente');
      fetchRouters();
      fetchIpSuggestions();

      setTimeout(() => {
        setQuickConnectDevice(null);
        handleScanNetwork();
      }, 1600);
    } catch (err: any) {
      setQuickConnectError(err.message);
    } finally {
      setQuickConnecting(false);
    }
  };

  const handleDeleteRouter = async (id: string, name: string) => {

    if (!confirm(`¿Eliminar router '${name}'? Se eliminarán también sus planes y tickets asociados.`)) return;

    try {
      const res = await fetch(`/api/v1/routers/${id}`, { method: 'DELETE' });
      const json = await res.json();
      if (json.success) {
        fetchRouters();
        fetchIpSuggestions();
      } else {
        alert(json.message || 'Error al eliminar');
      }
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
  };

  const handleShowBootstrap = async (routerId: string, routerName: string) => {
    try {
      setLoadingScriptId(routerId);
      const res = await fetch(`/api/v1/routers/${routerId}/bootstrap-script`);
      const json = await res.json();
      if (json.success && json.data) {
        setBootstrapScript({
          routerName: json.data.routerName || routerName,
          script: json.data.script,
          quickUnlockCommand: json.data.quickUnlockCommand,
          ntpScript: json.data.ntpScript,
          hotspotScript: json.data.hotspotScript,
          hotspotSubnet: json.data.hotspotSubnet,
          hotspotGateway: json.data.hotspotGateway,
        });
      } else {
        alert(json.error?.message || 'No se pudo obtener el script');
      }
    } catch (e: any) {
      alert(`Error al generar script: ${e.message}`);
    } finally {
      setLoadingScriptId(null);
    }
  };

  const handleApplyZt = async () => {
    const targetRouterId = ztSelectedRouter || routers[0]?.id;
    if (!targetRouterId) {
      alert('Selecciona un router primero');
      return;
    }
    try {
      setApplyingZt(true);
      setZtStatusMsg(null);
      const res = await fetch(`/api/v1/routers/${targetRouterId}/zerotier`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ networkId: ztNetworkId }),
      });
      const json = await res.json();
      if (json.success) {
        setZtStatusMsg({
          success: true,
          text: json.message,
        });
      } else {
        setZtStatusMsg({
          success: false,
          text: json.message || 'Error al configurar ZeroTier',
        });
      }
    } catch (e: any) {
      setZtStatusMsg({ success: false, text: `Fallo: ${e.message}` });
    } finally {
      setApplyingZt(false);
    }
  };

  const handleSetRemoteIp = async () => {
    const targetRouterId = ztSelectedRouter || routers[0]?.id;
    if (!targetRouterId) {
      alert('Selecciona un router primero');
      return;
    }
    if (!ztRemoteIp.trim()) {
      alert('Ingresa la IP privada que le asignó ZeroTier');
      return;
    }
    try {
      setConnectingRemote(true);
      setZtStatusMsg(null);
      const res = await fetch(`/api/v1/routers/${targetRouterId}/set-remote-ip`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ remoteIp: ztRemoteIp }),
      });
      const json = await res.json();
      setZtStatusMsg({
        success: json.success,
        text: json.message,
      });
      fetchRouters();
    } catch (e: any) {
      setZtStatusMsg({ success: false, text: `Error de red: ${e.message}` });
    } finally {
      setConnectingRemote(false);
    }
  };



  return (
    <div className="space-y-6">
      {/* Top Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/90 border border-slate-800 p-4 rounded-xl">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
            <HardDrive className="w-5 h-5 text-cyan-400" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white">Nodos MikroTik Reales</h2>
            <p className="text-xs text-slate-400">
              Conexión por sockets binarios TCP/TLS (Puertos 8728 / 8729) con credenciales cifradas AES-256
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setShowDiscoveryModal(true);
              handleScanNetwork();
            }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-indigo-500/10 border border-indigo-500/30 hover:bg-indigo-500/20 text-indigo-300 text-xs font-semibold transition-colors"
            title="Escanear la red local para detectar MikroTiks automáticamente (Protocolo Winbox Neighbors MNDP)"
          >
            <Radio className="w-3.5 h-3.5 text-indigo-400" />
            Escanear Red (Winbox)
          </button>
          <button
            onClick={() => setShowRemoteGuide(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 hover:bg-emerald-500/20 text-emerald-400 text-xs font-semibold transition-colors"
          >
            <Globe className="w-3.5 h-3.5" />
            Conexión Remota Gratis
          </button>
          <button
            onClick={fetchRouters}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-cyan-400' : ''}`} />
            Actualizar
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold text-xs shadow-md transition-all"
          >
            <Plus className="w-4 h-4" />
            Agregar Router
          </button>
        </div>
      </div>

      {/* Loading State */}
      {loading && routers.length === 0 && (
        <div className="p-12 text-center text-slate-400 bg-slate-900/40 rounded-xl border border-slate-800">
          <RefreshCw className="w-6 h-6 animate-spin mx-auto text-cyan-400 mb-2" />
          <p className="text-xs">Consultando base de datos relacional de routers...</p>
        </div>
      )}

      {/* Empty State */}
      {!loading && routers.length === 0 && (
        <div className="p-12 text-center text-slate-400 bg-slate-900/60 rounded-xl border border-slate-800">
          <Server className="w-10 h-10 mx-auto text-slate-600 mb-3" />
          <h3 className="text-base font-bold text-white mb-1">No hay routers registrados aún</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto mb-4">
            Agrega tu primer MikroTik para comenzar a generar fichas Hotspot y administrar tus usuarios.
          </p>
          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold text-xs rounded-lg"
          >
            Registrar Router Ahora
          </button>
        </div>
      )}

      {/* Routers Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {routers.map((router) => (
          <div
            key={router.id}
            onClick={() => handleOpenRouterDetails(router)}
            className="group cursor-pointer bg-slate-900/90 border border-slate-800 rounded-xl p-5 hover:border-cyan-500/60 hover:shadow-xl hover:shadow-cyan-950/20 transition-all flex flex-col justify-between"
          >
            <div>
              {/* Header Card */}
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-white group-hover:text-cyan-300 transition-colors">{router.name}</h3>
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono font-bold ${
                        router.status === 'ONLINE'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : router.status === 'ERROR'
                          ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          router.status === 'ONLINE' ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'
                        }`}
                      />
                      {router.status}
                    </span>
                  </div>
                  <div className="text-xs font-mono text-slate-400 mt-1 flex items-center gap-2">
                    <span>Identity: {router.identity || 'Sin identificar'}</span>
                    {router.rosVersion && (
                      <>
                        <span>•</span>
                        <span>RouterOS v{router.rosVersion}</span>
                      </>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  {router.useSsl && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono bg-blue-500/10 text-blue-400 border border-blue-500/20">
                      <Shield className="w-3 h-3" /> API-SSL
                    </span>
                  )}
                  <span className="text-[11px] font-semibold text-cyan-400 group-hover:text-cyan-300 flex items-center gap-1 transition-colors bg-cyan-500/10 border border-cyan-500/20 px-2 py-1 rounded-lg">
                    <Zap className="w-3.5 h-3.5" /> Info & Auto-Config →
                  </span>
                </div>
              </div>

              {/* Specs & Connection Info */}
              <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2 bg-slate-950/60 p-3 rounded-lg border border-slate-800/80 text-xs">
                <div>
                  <span className="text-[10px] text-slate-500 uppercase">Host / IP</span>
                  <div className="font-mono text-slate-200 mt-0.5">{router.host}</div>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 uppercase">Puerto API</span>
                  <div className="font-mono text-cyan-400 mt-0.5">{router.apiPort}</div>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 uppercase">Usuario API</span>
                  <div className="font-mono text-slate-300 mt-0.5">{router.username}</div>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 uppercase">Planes / Stock</span>
                  <div className="font-mono text-emerald-400 mt-0.5">
                    {router._count?.plans || 0} p / {router._count?.tickets || 0} f
                  </div>
                </div>
              </div>

              {/* Test Connection Result Banner */}
              {testResult && testResult.id === router.id && (
                <div
                  className={`mt-3 p-2.5 rounded-lg text-xs flex items-center gap-2 ${
                    testResult.success
                      ? 'bg-emerald-950/30 text-emerald-300 border border-emerald-500/30'
                      : 'bg-rose-950/30 text-rose-300 border border-rose-500/30'
                  }`}
                >
                  {testResult.success ? (
                    <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
                  )}
                  <span>{testResult.message}</span>
                </div>
              )}
            </div>

            {/* Actions Footer */}
            <div className="mt-5 pt-4 border-t border-slate-800 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleTestConnection(router.id);
                  }}
                  disabled={testingId === router.id}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition-colors disabled:opacity-50"
                >
                  <RefreshCw
                    className={`w-3.5 h-3.5 ${testingId === router.id ? 'animate-spin text-cyan-400' : ''}`}
                  />
                  {testingId === router.id ? 'Probando...' : 'Probar Conexión'}
                </button>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleShowBootstrap(router.id, router.name);
                  }}
                  disabled={loadingScriptId === router.id}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-950/40 hover:bg-indigo-900/50 text-indigo-300 border border-indigo-500/30 text-xs font-medium transition-colors"
                  title="Configurar Router Desde Cero"
                >
                  <Terminal className="w-3.5 h-3.5 text-indigo-400" />
                  {loadingScriptId === router.id ? 'Generando...' : 'Script Setup'}
                </button>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSyncTickets(router.id, router.name);
                  }}
                  disabled={syncingId === router.id}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-950/40 hover:bg-emerald-900/50 text-emerald-300 border border-emerald-500/30 text-xs font-medium transition-colors disabled:opacity-50"
                  title="Inyectar y sincronizar todas las fichas en este MikroTik"
                >
                  <RefreshCw
                    className={`w-3.5 h-3.5 ${syncingId === router.id ? 'animate-spin text-emerald-400' : ''}`}
                  />
                  {syncingId === router.id ? 'Sincronizando...' : 'Sincronizar Fichas'}
                </button>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleOpenEdit(router);
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-950/40 hover:bg-amber-900/50 text-amber-300 border border-amber-500/30 text-xs font-medium transition-colors"
                  title="Editar IP, Contraseña o Datos del Router"
                >
                  <Edit3 className="w-3.5 h-3.5 text-amber-400" />
                  Editar
                </button>
              </div>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteRouter(router.id, router.name);
                }}
                className="p-1.5 rounded-lg text-rose-400 hover:text-rose-300 hover:bg-rose-950/40 transition-colors"
                title="Eliminar Router"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Modal: Agregar Router */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-lg w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <HardDrive className="w-4 h-4 text-cyan-400" />
                Registrar Nuevo MikroTik
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Selector de Modo: Automático vs Manual */}
            <div className="mb-4 bg-slate-950 p-1.5 rounded-lg border border-slate-800 flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setIpMode('AUTO');
                  if (suggestedIpData) {
                    setFormData((prev) => ({ ...prev, host: suggestedIpData.suggestedHost }));
                  }
                }}
                className={`flex-1 py-1.5 px-3 rounded-md text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                  ipMode === 'AUTO'
                    ? 'bg-cyan-600 text-slate-950 shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Zap className="w-3.5 h-3.5" />
                Modo Automático (0 Colisiones)
              </button>
              <button
                type="button"
                onClick={() => setIpMode('MANUAL')}
                className={`flex-1 py-1.5 px-3 rounded-md text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                  ipMode === 'MANUAL'
                    ? 'bg-slate-800 text-cyan-400 border border-slate-700 shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Sliders className="w-3.5 h-3.5" />
                Modo Manual
              </button>
            </div>

            {ipMode === 'AUTO' && suggestedIpData && (
              <div className="mb-4 p-3 rounded-lg bg-cyan-950/40 border border-cyan-800/40 text-xs space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-cyan-300 font-semibold">⚡ Sugerencia Inteligente:</span>
                  <span className="font-mono text-cyan-400 bg-cyan-900/60 px-2 py-0.5 rounded text-[11px]">
                    Subred: {suggestedIpData.suggestedSubnet}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">
                  IP libre asignada: <strong className="text-white font-mono">{suggestedIpData.suggestedHost}</strong>.
                  Garantiza cero colisiones con otros routers MikroTik.
                </p>
                {suggestedIpData.occupiedHosts.length > 0 && (
                  <p className="text-[10px] text-slate-500 pt-1 font-mono">
                    IPs en uso: {suggestedIpData.occupiedHosts.join(', ')}
                  </p>
                )}
              </div>
            )}

            <form onSubmit={handleCreateRouter} className="space-y-4 text-xs">
              <div>
                <label className="text-slate-300 font-semibold block mb-1">Nombre Descriptivo:</label>
                <input
                  type="text"
                  placeholder="Ej: MikroTik Plaza Central"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-cyan-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 font-semibold block mb-1">IP o Host:</label>
                  <input
                    type="text"
                    placeholder="192.168.88.1"
                    value={formData.host}
                    onChange={(e) => setFormData({ ...formData, host: e.target.value })}
                    className={`w-full bg-slate-950 border rounded-lg px-3 py-2 font-mono text-white focus:outline-none ${
                      suggestedIpData?.occupiedHosts.includes(formData.host.trim())
                        ? 'border-amber-500 text-amber-300'
                        : 'border-slate-800 focus:border-cyan-500'
                    }`}
                    required
                  />
                  {suggestedIpData?.occupiedHosts.includes(formData.host.trim()) && (
                    <span className="text-[10px] text-amber-400 mt-1 block font-medium">
                      ⚠️ Esta IP ya está en uso por otro router.
                    </span>
                  )}
                </div>
                <div>
                  <label className="text-slate-300 font-semibold block mb-1">Puerto API:</label>
                  <input
                    type="number"
                    value={formData.apiPort}
                    onChange={(e) => setFormData({ ...formData, apiPort: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 font-mono text-white focus:outline-none focus:border-cyan-500"
                    required
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="chkSsl"
                  checked={formData.useSsl}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      useSsl: e.target.checked,
                      apiPort: e.target.checked ? 8729 : 8728,
                    })
                  }
                  className="rounded border-slate-800 text-cyan-500 focus:ring-0"
                />
                <label htmlFor="chkSsl" className="text-slate-300">
                  Usar API-SSL Cifrado (Puerto 8729 TLS)
                </label>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="text-slate-300 font-semibold block mb-1">Usuario MikroTik:</label>
                  <input
                    type="text"
                    placeholder="admin"
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-cyan-500"
                    required
                  />
                </div>
                <div>
                  <label className="text-slate-300 font-semibold block mb-1">Contraseña:</label>
                  <input
                    type="password"
                    placeholder="En blanco si es nuevo"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              <p className="text-[11px] text-slate-400 bg-slate-950/60 p-2.5 rounded border border-slate-800/80 leading-relaxed">
                💡 <strong>¿MikroTik nuevo de fábrica?</strong> Deja la contraseña vacía. Los equipos de fábrica vienen sin contraseña.
                Si ya le pusiste contraseña en Winbox, escríbela aquí (se cifra con AES-256-GCM).
              </p>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg font-medium"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold rounded-lg shadow-md transition-all"
                >
                  Guardar Router
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Editar Router y Credenciales */}
      {editingRouter && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-lg w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-amber-400" />
                Editar Router: {editingRouter.name}
              </h3>
              <button
                onClick={() => setEditingRouter(null)}
                className="p-1 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateRouter} className="space-y-4 text-xs">
              <div>
                <label className="text-slate-300 font-semibold block mb-1">Nombre Descriptivo:</label>
                <input
                  type="text"
                  value={editFormData.name}
                  onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-cyan-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 font-semibold block mb-1">IP o Host DNS:</label>
                  <input
                    type="text"
                    value={editFormData.host}
                    onChange={(e) => setEditFormData({ ...editFormData, host: e.target.value })}
                    className={`w-full bg-slate-950 border rounded-lg px-3 py-2 font-mono text-white focus:outline-none ${
                      suggestedIpData?.occupiedHosts.filter((h) => h !== editingRouter.host).includes(editFormData.host.trim())
                        ? 'border-amber-500 text-amber-300'
                        : 'border-slate-800 focus:border-cyan-500'
                    }`}
                    required
                  />
                  {suggestedIpData?.occupiedHosts.filter((h) => h !== editingRouter.host).includes(editFormData.host.trim()) && (
                    <span className="text-[10px] text-amber-400 mt-1 block">
                      ⚠️ Esta IP ya pertenece a otro router.
                    </span>
                  )}
                </div>
                <div>
                  <label className="text-slate-300 font-semibold block mb-1">Puerto API:</label>
                  <input
                    type="number"
                    value={editFormData.apiPort}
                    onChange={(e) => setEditFormData({ ...editFormData, apiPort: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 font-mono text-white focus:outline-none focus:border-cyan-500"
                    required
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="chkEditSsl"
                  checked={editFormData.useSsl}
                  onChange={(e) =>
                    setEditFormData({
                      ...editFormData,
                      useSsl: e.target.checked,
                      apiPort: e.target.checked ? 8729 : 8728,
                    })
                  }
                  className="rounded border-slate-800 text-cyan-500 focus:ring-0"
                />
                <label htmlFor="chkEditSsl" className="text-slate-300">
                  Usar API-SSL Cifrado (Puerto 8729 TLS)
                </label>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="text-slate-300 font-semibold block mb-1">Usuario MikroTik:</label>
                  <input
                    type="text"
                    value={editFormData.username}
                    onChange={(e) => setEditFormData({ ...editFormData, username: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-cyan-500"
                    required
                  />
                </div>
                <div>
                  <label className="text-slate-300 font-semibold block mb-1">Nueva Contraseña:</label>
                  <input
                    type="password"
                    placeholder="Dejar en blanco para no cambiar"
                    value={editFormData.password}
                    onChange={(e) => setEditFormData({ ...editFormData, password: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              <p className="text-[11px] text-slate-400 bg-slate-950/60 p-2.5 rounded border border-slate-800/80 leading-relaxed">
                🔒 Deja la contraseña vacía si quieres mantener la actual. Si escribes una nueva contraseña, será cifrada inmediatamente con AES-256-GCM.
              </p>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingRouter(null)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg font-medium"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg shadow-md transition-all"
                >
                  Actualizar Router
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Bootstrap Script (Configuración Desde Cero con Selección Libre de Fragmentos) */}
      {bootstrapScript && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-3xl w-full p-6 shadow-2xl flex flex-col max-h-[92vh]">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-cyan-400" />
                  Script de Configuración: {bootstrapScript.routerName}
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Puedes copiar comandos individuales o seleccionar libremente cualquier fragmento con el mouse.
                </p>
              </div>
              <button
                onClick={() => {
                  setBootstrapScript(null);
                  setCopiedScript(false);
                }}
                className="p-1 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Acciones Rápidas por Fragmento */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-3">
              {bootstrapScript.quickUnlockCommand && (
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(bootstrapScript.quickUnlockCommand!);
                    setCopiedCmd('quickUnlock');
                    setTimeout(() => setCopiedCmd(null), 2500);
                  }}
                  className="p-2.5 bg-emerald-950/40 border border-emerald-500/30 hover:bg-emerald-900/40 rounded-lg text-left transition-colors flex items-center justify-between"
                >
                  <div>
                    <div className="font-bold text-emerald-400 text-[11px] flex items-center gap-1">
                      <Zap className="w-3 h-3" /> 1. Desbloqueo API
                    </div>
                    <div className="text-[10px] text-slate-400">Pega en Winbox si rechaza</div>
                  </div>
                  <span className="text-[10px] font-bold text-emerald-400 bg-emerald-900/60 px-2 py-0.5 rounded">
                    {copiedCmd === 'quickUnlock' ? '¡Copiado!' : 'Copiar'}
                  </span>
                </button>
              )}

              {bootstrapScript.ntpScript && (
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(bootstrapScript.ntpScript!);
                    setCopiedCmd('ntp');
                    setTimeout(() => setCopiedCmd(null), 2500);
                  }}
                  className="p-2.5 bg-cyan-950/40 border border-cyan-500/30 hover:bg-cyan-900/40 rounded-lg text-left transition-colors flex items-center justify-between"
                >
                  <div>
                    <div className="font-bold text-cyan-400 text-[11px] flex items-center gap-1">
                      <Clock className="w-3 h-3" /> 2. Anti-Apagones (NTP)
                    </div>
                    <div className="text-[10px] text-slate-400">Protege ante corte de luz</div>
                  </div>
                  <span className="text-[10px] font-bold text-cyan-400 bg-cyan-900/60 px-2 py-0.5 rounded">
                    {copiedCmd === 'ntp' ? '¡Copiado!' : 'Copiar'}
                  </span>
                </button>
              )}

              {bootstrapScript.hotspotScript && (
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(bootstrapScript.hotspotScript!);
                    setCopiedCmd('hotspot');
                    setTimeout(() => setCopiedCmd(null), 2500);
                  }}
                  className="p-2.5 bg-indigo-950/40 border border-indigo-500/30 hover:bg-indigo-900/40 rounded-lg text-left transition-colors flex items-center justify-between"
                >
                  <div>
                    <div className="font-bold text-indigo-400 text-[11px] flex items-center gap-1">
                      <Wifi className="w-3 h-3" /> 3. Hotspot y Subred
                    </div>
                    <div className="text-[10px] text-slate-400">{bootstrapScript.hotspotSubnet || 'Subred Única'}</div>
                  </div>
                  <span className="text-[10px] font-bold text-indigo-400 bg-indigo-900/60 px-2 py-0.5 rounded">
                    {copiedCmd === 'hotspot' ? '¡Copiado!' : 'Copiar'}
                  </span>
                </button>
              )}
            </div>

            {/* Contenedor de Script con SELECCIÓN LIBRE (select-text, NO select-all) */}
            <div className="flex-1 bg-slate-950 border border-slate-800 rounded-lg p-3 overflow-y-auto font-mono text-[11px] text-emerald-400 select-text max-h-80 whitespace-pre leading-relaxed">
              {bootstrapScript.script}
            </div>

            <div className="flex items-center justify-between pt-4 mt-4 border-t border-slate-800">
              <span className="text-xs text-slate-500">
                Selecciona cualquier fragmento con el cursor o copia el script completo
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(bootstrapScript.script);
                    setCopiedScript(true);
                    setTimeout(() => setCopiedScript(false), 3000);
                  }}
                  className="flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold text-xs rounded-lg shadow-md transition-all"
                >
                  {copiedScript ? <Check className="w-4 h-4 text-slate-950" /> : <Copy className="w-4 h-4" />}
                  {copiedScript ? '¡Script Completo Copiado!' : 'Copiar Script Completo'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Guía Conexión Remota Gratis */}
      {showRemoteGuide && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-xl w-full p-6 shadow-2xl flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Globe className="w-4 h-4 text-emerald-400" />
                Conexión Remota 100% Gratis y Sin Caídas
              </h3>
              <button
                onClick={() => {
                  setShowRemoteGuide(false);
                  setCopiedCmd(null);
                }}
                className="p-1 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 overflow-y-auto text-xs text-slate-300 pr-1">
              {/* Selector de Router si hay varios */}
              {routers.length > 0 && (
                <div className="bg-slate-950/80 border border-slate-800 p-3 rounded-lg flex items-center justify-between">
                  <span className="text-slate-400 font-medium">Router a conectar remotamente:</span>
                  <select
                    value={ztSelectedRouter || routers[0]?.id}
                    onChange={(e) => setZtSelectedRouter(e.target.value)}
                    className="bg-slate-900 border border-slate-700 text-cyan-400 text-xs rounded px-2 py-1"
                  >
                    {routers.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name} ({r.host})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Status Message Banner */}
              {ztStatusMsg && (
                <div
                  className={`p-3 rounded-lg text-xs flex items-center gap-2 ${
                    ztStatusMsg.success
                      ? 'bg-emerald-950/40 text-emerald-300 border border-emerald-500/30'
                      : 'bg-amber-950/40 text-amber-300 border border-amber-500/30'
                  }`}
                >
                  {ztStatusMsg.success ? (
                    <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0" />
                  )}
                  <span>{ztStatusMsg.text}</span>
                </div>
              )}

              {/* Paso 1: Network ID y Comando */}
              <div className="bg-slate-950/70 border border-slate-800 p-4 rounded-lg space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-cyan-400 text-sm">Paso 1: Tu ZeroTier Network ID</span>
                  <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded font-mono">100% Gratis</span>
                </div>

                <div>
                  <label className="text-slate-400 text-[11px] block mb-1">Network ID de tu Red ZeroTier (16 caracteres):</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={ztNetworkId}
                      onChange={(e) => setZtNetworkId(e.target.value)}
                      placeholder="b9a18a606f03ddb5"
                      className="flex-1 bg-slate-900 border border-slate-700 rounded px-3 py-1.5 font-mono text-cyan-300 focus:outline-none focus:border-cyan-500"
                    />
                    <button
                      type="button"
                      onClick={handleApplyZt}
                      disabled={applyingZt}
                      className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded text-xs transition-colors flex items-center gap-1 disabled:opacity-50"
                    >
                      <Terminal className="w-3.5 h-3.5" />
                      {applyingZt ? 'Enviando...' : '⚡ Configurar en MikroTik'}
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between bg-slate-900 p-2.5 rounded font-mono text-[11px] text-emerald-300">
                  <code>
                    /zerotier interface add network={ztNetworkId.trim() || 'TU_NETWORK_ID'} name=zt1&#10;/zerotier enable zt1
                  </code>
                  <button
                    onClick={() => {
                      const cmd = `/zerotier interface add network=${ztNetworkId.trim()} name=zt1\n/zerotier enable zt1`;
                      navigator.clipboard.writeText(cmd);
                      setCopiedCmd('zt');
                      setTimeout(() => setCopiedCmd(null), 2500);
                    }}
                    className="p-1.5 hover:bg-slate-800 rounded text-slate-400 hover:text-white"
                    title="Copiar comando para MikroTik"
                  >
                    {copiedCmd === 'zt' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              {/* Paso 2: Autorización */}
              <div className="bg-slate-950/70 border border-slate-800 p-3 rounded-lg space-y-1">
                <span className="font-bold text-amber-400 text-xs">Paso 2: Autorizar en la Web de ZeroTier</span>
                <p className="text-slate-400 text-[11px] leading-relaxed">
                  En la página de ZeroTier (<span className="text-cyan-400 font-mono">my.zerotier.com</span>), baja a <strong>Member Devices</strong> y marca la casilla <strong>"Auth"</strong> del MikroTik. ZeroTier le asignará una IP (ej: <span className="font-mono text-emerald-300">10.147.20.10</span>).
                </p>
              </div>

              {/* Paso 3: Conectar Remotamente desde esta App */}
              <div className="bg-slate-950/70 border border-slate-800 p-4 rounded-lg space-y-3">
                <span className="font-bold text-emerald-400 text-sm">Paso 3: Conectar Remotamente a esa IP</span>
                <p className="text-slate-400 text-[11px]">
                  Pega la IP privada que le asignó ZeroTier a tu MikroTik. El sistema guardará la conexión y probará el socket remoto:
                </p>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={ztRemoteIp}
                    onChange={(e) => setZtRemoteIp(e.target.value)}
                    placeholder="Ejemplo: 10.147.18.45"
                    className="flex-1 bg-slate-900 border border-slate-700 rounded px-3 py-1.5 font-mono text-white focus:outline-none focus:border-cyan-500"
                  />
                  <button
                    type="button"
                    onClick={handleSetRemoteIp}
                    disabled={connectingRemote}
                    className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold rounded text-xs transition-colors flex items-center gap-1 disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${connectingRemote ? 'animate-spin' : ''}`} />
                    {connectingRemote ? 'Probando...' : '🚀 Guardar y Conectar'}
                  </button>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-4 mt-4 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowRemoteGuide(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded-lg"
              >
                Cerrar Guía
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL ESCANEO AUTOMÁTICO TIPO WINBOX NEIGHBORS (MNDP) */}
      {showDiscoveryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl p-6 shadow-2xl space-y-5 max-h-[92vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
                  <Radio className="w-5 h-5 text-indigo-400 animate-pulse" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    Escáner de Red MikroTik (Winbox Neighbors)
                    <span className="text-[10px] font-mono bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-2 py-0.5 rounded-full">
                      MNDP UDP 5678
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400">
                    Detecta automáticamente equipos MikroTik en tu red local o Wi-Fi sin ingresar la IP a mano.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleScanNetwork}
                  disabled={scanningDevices}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-all disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${scanningDevices ? 'animate-spin' : ''}`} />
                  {scanningDevices ? 'Escaneando...' : 'Volver a Escanear'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowDiscoveryModal(false)}
                  className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Error banner if any */}
            {scanError && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{scanError}</span>
              </div>
            )}

            {/* Scanning indicator */}
            {scanningDevices && (
              <div className="p-6 bg-slate-950/60 border border-indigo-500/20 rounded-xl text-center space-y-2">
                <Radio className="w-8 h-8 text-indigo-400 animate-spin mx-auto opacity-80" />
                <p className="text-sm font-semibold text-white">Sondeando MikroTiks en la red local...</p>
                <p className="text-xs text-slate-400 max-w-md mx-auto">
                  Enviando paquetes de broadcast MNDP por UDP 5678 y verificando la IP de fábrica 192.168.88.1 (puertos 8728 y 8291).
                </p>
              </div>
            )}

            {/* Devices Table / List */}
            {!scanningDevices && (
              <div className="space-y-4">
                {discoveredDevices.length === 0 ? (
                  <div className="p-8 text-center bg-slate-950/40 rounded-xl border border-slate-800 space-y-3">
                    <Radio className="w-10 h-10 text-slate-600 mx-auto" />
                    <h4 className="text-sm font-bold text-white">No se detectaron MikroTiks en esta red</h4>
                    <p className="text-xs text-slate-400 max-w-lg mx-auto leading-relaxed">
                      💡 <strong>Consejo MikroTik:</strong> Asegúrate de que el cable de red o tu Wi-Fi esté conectado a uno de los puertos <strong>LAN (ether2 a ether5)</strong>. El puerto ether1 (WAN) viene bloqueado con firewall de fábrica y rechaza el descubrimiento.
                    </p>
                    <div className="flex justify-center gap-2 pt-2">
                      <button
                        type="button"
                        onClick={handleScanNetwork}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold"
                      >
                        Reintentar Escaneo
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowDiscoveryModal(false);
                          setShowAddModal(true);
                        }}
                        className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs"
                      >
                        Agregar Manualmente (IP)
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="border border-slate-800 rounded-xl overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-950 text-slate-400 border-b border-slate-800">
                        <tr>
                          <th className="py-2.5 px-3">Identidad / Equipo</th>
                          <th className="py-2.5 px-3">Dirección IP</th>
                          <th className="py-2.5 px-3">Dirección MAC</th>
                          <th className="py-2.5 px-3">Versión RouterOS</th>
                          <th className="py-2.5 px-3">Estado API</th>
                          <th className="py-2.5 px-3 text-right">Conectar</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 bg-slate-900/60">
                        {discoveredDevices.map((d, idx) => {
                          const isSelected = quickConnectDevice?.mac === d.mac || quickConnectDevice?.ipv4 === d.ipv4;
                          return (
                            <tr
                              key={d.mac || d.ipv4 || idx}
                              className={`hover:bg-slate-800/50 transition-colors ${isSelected ? 'bg-indigo-950/30 border-l-2 border-indigo-500' : ''}`}
                            >
                              <td className="py-3 px-3">
                                <div className="font-bold text-white flex items-center gap-1.5">
                                  <HardDrive className="w-3.5 h-3.5 text-indigo-400" />
                                  {d.identity || 'MikroTik'}
                                </div>
                                <div className="text-[10px] text-slate-400">
                                  {d.board || d.platform || 'RouterBOARD'} {d.interfaceName ? `(${d.interfaceName})` : ''}
                                </div>
                              </td>

                              <td className="py-3 px-3">
                                {d.ipv4 ? (
                                  <button
                                    type="button"
                                    onClick={() => handleSelectDeviceToConnect(d, 'ip')}
                                    className="font-mono text-cyan-400 hover:text-cyan-300 hover:underline flex items-center gap-1"
                                    title="Clic para conectar por IP"
                                  >
                                    {d.ipv4}
                                  </button>
                                ) : (
                                  <span className="text-slate-500 font-mono">0.0.0.0 (Sin IP)</span>
                                )}
                              </td>

                              <td className="py-3 px-3">
                                <button
                                  type="button"
                                  onClick={() => handleSelectDeviceToConnect(d, 'mac')}
                                  className="font-mono text-slate-300 hover:text-white hover:underline"
                                  title="Clic para conectar por MAC"
                                >
                                  {d.mac || 'N/A'}
                                </button>
                              </td>

                              <td className="py-3 px-3">
                                <span className="bg-slate-800 text-slate-300 px-2 py-0.5 rounded text-[10px] font-mono">
                                  {d.version ? `v${d.version}` : 'Desconocida'}
                                </span>
                              </td>

                              <td className="py-3 px-3">
                                {d.apiPort === 'open' ? (
                                  <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400 font-semibold bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span> API 8728 OK
                                  </span>
                                ) : d.apiPort === 'refused' ? (
                                  <span className="inline-flex items-center gap-1 text-[10px] text-amber-400 font-semibold bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span> API Apagada
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-[10px] text-slate-400 font-mono bg-slate-800 px-2 py-0.5 rounded-full">
                                    {d.apiPort}
                                  </span>
                                )}
                              </td>

                              <td className="py-3 px-3 text-right">
                                <div className="flex items-center justify-end gap-1.5">
                                  {d.isRegistered ? (
                                    <span className="inline-flex items-center gap-1 text-[10px] text-cyan-400 font-semibold bg-cyan-500/10 px-2 py-1 rounded border border-cyan-500/20">
                                      <CheckCircle className="w-3 h-3" /> Ya Agregado
                                    </span>
                                  ) : (
                                    <>
                                      <button
                                        type="button"
                                        onClick={() => handleSelectDeviceToConnect(d, 'ip')}
                                        className="px-2.5 py-1 bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold rounded text-[11px] transition-all shadow-sm"
                                      >
                                        Por IP
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleSelectDeviceToConnect(d, 'mac')}
                                        className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium rounded text-[11px] transition-all"
                                      >
                                        Por MAC
                                      </button>
                                    </>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* QUICK CONNECT FORM FOR SELECTED DEVICE */}
            {quickConnectDevice && (
              <div className="bg-slate-950 border border-indigo-500/30 rounded-xl p-4 space-y-4 animate-fade-in">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <div className="flex items-center gap-2">
                    <Radio className="w-4 h-4 text-indigo-400" />
                    <h4 className="text-sm font-bold text-white">
                      Conectar a {quickConnectDevice.identity || 'MikroTik'} ({connectVia === 'ip' ? `IP: ${quickConnectDevice.ipv4 || '192.168.88.1'}` : `MAC: ${quickConnectDevice.mac}`})
                    </h4>
                  </div>
                  <div className="flex items-center gap-1 bg-slate-900 p-0.5 rounded-lg border border-slate-800 text-[10px]">
                    <button
                      type="button"
                      onClick={() => setConnectVia('ip')}
                      className={`px-2 py-0.5 rounded font-bold transition-colors ${connectVia === 'ip' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}
                    >
                      Por IP ({quickConnectDevice.ipv4 || '192.168.88.1'})
                    </button>
                    <button
                      type="button"
                      onClick={() => setConnectVia('mac')}
                      className={`px-2 py-0.5 rounded font-bold transition-colors ${connectVia === 'mac' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}
                    >
                      Por MAC ({quickConnectDevice.mac})
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                  <div>
                    <label className="block text-slate-400 mb-1 font-medium">Nombre en el Sistema:</label>
                    <input
                      type="text"
                      value={quickConnectName}
                      onChange={(e) => setQuickConnectName(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-400 mb-1 font-medium">Usuario MikroTik:</label>
                    <input
                      type="text"
                      value={quickConnectUser}
                      onChange={(e) => setQuickConnectUser(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500 font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-400 mb-1 font-medium">
                      Contraseña:
                    </label>
                    <input
                      type="password"
                      value={quickConnectPass}
                      onChange={(e) => setQuickConnectPass(e.target.value)}
                      placeholder="(Vacía si es de fábrica)"
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500 font-mono"
                    />
                  </div>
                </div>

                <div className="p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-lg text-amber-300 text-[11px] flex items-center gap-2">
                  <span>💡</span>
                  <span>
                    <strong>MikroTik Nuevo de Fábrica:</strong> La contraseña viene completamente <strong>VACÍA</strong>. No escribas nada si el equipo es nuevo o recién reseteado.
                  </span>
                </div>

                {quickConnectError && (
                  <div className="p-3 bg-red-500/15 border border-red-500/30 rounded-lg text-red-300 text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{quickConnectError}</span>
                  </div>
                )}

                {quickConnectSuccess && (
                  <div className="p-3 bg-emerald-500/15 border border-emerald-500/30 rounded-lg text-emerald-300 text-xs flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 shrink-0" />
                    <span>{quickConnectSuccess}</span>
                  </div>
                )}

                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setQuickConnectDevice(null)}
                    disabled={quickConnecting}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleExecuteQuickConnect}
                    disabled={quickConnecting}
                    className="flex items-center gap-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-lg shadow-md transition-all disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${quickConnecting ? 'animate-spin' : ''}`} />
                    {quickConnecting ? 'Probando y Conectando...' : '⚡ Probar y Agregar Router'}
                  </button>
                </div>
              </div>
            )}

            {/* Modal Footer */}
            <div className="flex items-center justify-between pt-3 border-t border-slate-800 text-xs text-slate-400">
              <span>Protocolo Winbox compatible con RouterOS v6 y v7</span>
              <button
                type="button"
                onClick={() => setShowDiscoveryModal(false)}
                className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg font-medium"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Detalles del MikroTik & Auto-Configuración 1-Clic */}
      {selectedRouterDetails && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-700/80 rounded-2xl max-w-3xl w-full shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
                  <HardDrive className="w-5 h-5 text-cyan-400" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-white">{selectedRouterDetails.name}</h3>
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono font-bold ${
                        (telemetryData?.online ?? selectedRouterDetails.status === 'ONLINE')
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                      }`}
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      {telemetryData?.online ? 'ONLINE' : selectedRouterDetails.status}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 font-mono flex items-center gap-2 mt-0.5">
                    <span>{selectedRouterDetails.host}:{selectedRouterDetails.apiPort}</span>
                    <span>•</span>
                    <span>Identity: {telemetryData?.identity || selectedRouterDetails.identity || 'MikroTik'}</span>
                    <span>•</span>
                    <span className="text-cyan-400">{telemetryData?.boardName || 'RouterBOARD'} (ROS v{telemetryData?.rosVersion || selectedRouterDetails.rosVersion || '6/7'})</span>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => fetchRouterTelemetry(selectedRouterDetails.id)}
                  disabled={loadingTelemetry}
                  className="p-2 text-slate-400 hover:text-white bg-slate-800/80 hover:bg-slate-700 rounded-lg transition-colors"
                  title="Refrescar telemetría en vivo"
                >
                  <RefreshCw className={`w-4 h-4 ${loadingTelemetry ? 'animate-spin text-cyan-400' : ''}`} />
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedRouterDetails(null)}
                  className="p-2 text-slate-400 hover:text-white bg-slate-800/80 hover:bg-slate-700 rounded-lg transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Modal Body (Scrollable) */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs">
              {/* 🌟 1. BANNER DESTACADO: Auto-Configuración en 1 Clic */}
              <div className="bg-gradient-to-br from-cyan-950/40 via-slate-900 to-indigo-950/50 border border-cyan-500/30 rounded-xl p-5 shadow-lg relative overflow-hidden">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="p-1 rounded bg-cyan-500/20 text-cyan-400">
                        <Zap className="w-4 h-4" />
                      </span>
                      <h4 className="text-sm font-bold text-white">
                        Auto-Configurar Hotspot en 1 Clic (Sin Terminal Winbox)
                      </h4>
                    </div>
                    <p className="text-slate-300 text-xs leading-relaxed max-w-xl">
                      Configura automáticamente el reloj y guardián anti-apagones, el servidor Hotspot, perfiles (1 ficha por celular garantizado), portal cautivo Sarmientos y reglas NAT directamente por la API del MikroTik.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleExecuteAutoProvision(selectedRouterDetails.id)}
                    disabled={autoProvisioning}
                    className="flex-shrink-0 flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-teal-400 hover:from-cyan-400 hover:to-teal-300 text-slate-950 font-extrabold text-xs shadow-lg shadow-cyan-500/20 transition-all disabled:opacity-50"
                  >
                    <RefreshCw className={`w-4 h-4 ${autoProvisioning ? 'animate-spin' : ''}`} />
                    {autoProvisioning ? 'Configurando MikroTik vía API...' : '⚡ Auto-Configurar Hotspot'}
                  </button>
                </div>

                {/* Checklist de Auto-Configuración */}
                {autoProvisionResult && (
                  <div className="mt-5 pt-4 border-t border-cyan-800/40 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-emerald-400 flex items-center gap-1.5 text-xs">
                        <CheckCircle className="w-4 h-4" /> {autoProvisionResult.summary}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {autoProvisionResult.steps.map((step) => (
                        <div
                          key={step.id}
                          className="bg-slate-950/70 border border-slate-800 p-2.5 rounded-lg flex items-start gap-2"
                        >
                          {step.status === 'SUCCESS' ? (
                            <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                          ) : step.status === 'WARNING' ? (
                            <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                          ) : (
                            <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
                          )}
                          <div>
                            <div className="font-semibold text-white text-[11px]">{step.title}</div>
                            <div className="text-[10px] text-slate-400 mt-0.5">{step.detail}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {autoProvisionError && (
                  <div className="mt-4 p-3 bg-rose-950/50 border border-rose-500/40 rounded-lg text-rose-300 text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
                    <span>{autoProvisionError}</span>
                  </div>
                )}
              </div>

              {/* 📊 2. TELEMETRÍA EN VIVO (Métricas de Hardware) */}
              <div>
                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5 text-cyan-400" /> Telemetría del Hardware en Vivo
                </h4>

                {loadingTelemetry && !telemetryData ? (
                  <div className="p-8 text-center bg-slate-950/50 rounded-xl border border-slate-800 text-slate-400">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto text-cyan-400 mb-2" />
                    <p className="text-xs">Consultando procesador, memoria y uptime vía socket RouterOS...</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {/* CPU */}
                    <div className="bg-slate-950/80 border border-slate-800 p-3 rounded-xl space-y-1">
                      <div className="flex items-center justify-between text-slate-400">
                        <span className="text-[10px] uppercase font-semibold">Carga de CPU</span>
                        <Cpu className="w-3.5 h-3.5 text-cyan-400" />
                      </div>
                      <div className="text-lg font-bold font-mono text-white">
                        {telemetryData?.cpuLoad ?? 0}%
                      </div>
                      <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                        <div
                          className={`h-full transition-all duration-500 ${
                            (telemetryData?.cpuLoad || 0) > 80
                              ? 'bg-rose-500'
                              : (telemetryData?.cpuLoad || 0) > 50
                              ? 'bg-amber-400'
                              : 'bg-emerald-400'
                          }`}
                          style={{ width: `${Math.min(telemetryData?.cpuLoad || 0, 100)}%` }}
                        />
                      </div>
                    </div>

                    {/* RAM */}
                    <div className="bg-slate-950/80 border border-slate-800 p-3 rounded-xl space-y-1">
                      <div className="flex items-center justify-between text-slate-400">
                        <span className="text-[10px] uppercase font-semibold">Memoria RAM</span>
                        <Layers className="w-3.5 h-3.5 text-emerald-400" />
                      </div>
                      <div className="text-lg font-bold font-mono text-white">
                        {telemetryData?.freeMemoryMb ?? 0} MB <span className="text-[11px] font-normal text-slate-400">libres</span>
                      </div>
                      <div className="text-[10px] text-slate-400">
                        Total: {telemetryData?.totalMemoryMb ?? 0} MB ({telemetryData?.memoryUsedPercent ?? 0}% uso)
                      </div>
                      <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-emerald-400 transition-all duration-500"
                          style={{ width: `${Math.min(telemetryData?.memoryUsedPercent || 0, 100)}%` }}
                        />
                      </div>
                    </div>

                    {/* Uptime */}
                    <div className="bg-slate-950/80 border border-slate-800 p-3 rounded-xl space-y-1">
                      <div className="flex items-center justify-between text-slate-400">
                        <span className="text-[10px] uppercase font-semibold">Tiempo Encendido</span>
                        <Clock className="w-3.5 h-3.5 text-amber-400" />
                      </div>
                      <div className="text-lg font-bold font-mono text-white truncate" title={telemetryData?.uptime}>
                        {telemetryData?.uptime ?? '--'}
                      </div>
                      <div className="text-[10px] text-emerald-400 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span> Reloj sincronizado
                      </div>
                    </div>

                    {/* Latencia */}
                    <div className="bg-slate-950/80 border border-slate-800 p-3 rounded-xl space-y-1">
                      <div className="flex items-center justify-between text-slate-400">
                        <span className="text-[10px] uppercase font-semibold">Latencia Socket</span>
                        <Wifi className="w-3.5 h-3.5 text-indigo-400" />
                      </div>
                      <div className="text-lg font-bold font-mono text-white">
                        {telemetryData?.latencyMs ?? '--'} ms
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        Puerto {selectedRouterDetails.apiPort}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* 🌐 3. ESTADO DEL HOTSPOT Y RED */}
              <div className="bg-slate-950/60 border border-slate-800 p-4 rounded-xl space-y-3">
                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Server className="w-3.5 h-3.5 text-cyan-400" /> Estado de Red & Hotspot
                </h4>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase font-semibold">Gateway / LAN IP</span>
                    <div className="font-mono text-slate-200 mt-0.5">{telemetryData?.lanIp || selectedRouterDetails.host}</div>
                  </div>

                  <div>
                    <span className="text-[10px] text-slate-500 uppercase font-semibold">Servidor Hotspot</span>
                    <div className="font-mono text-emerald-400 mt-0.5">
                      {telemetryData?.hotspotServerConfigured ? `🟢 Activo (${telemetryData.hotspotServerName || 'hs-clientes'})` : '🟡 Sin servidor'}
                    </div>
                  </div>

                  <div>
                    <span className="text-[10px] text-slate-500 uppercase font-semibold">Fichas en Router</span>
                    <div className="font-mono text-cyan-400 mt-0.5">
                      {telemetryData?.hotspotUsersCount ?? selectedRouterDetails._count?.tickets ?? 0} usuarios
                    </div>
                  </div>

                  <div>
                    <span className="text-[10px] text-slate-500 uppercase font-semibold">Clientes en Línea</span>
                    <div className="font-mono text-amber-300 mt-0.5">
                      {telemetryData?.activeHotspotCount ?? 0} conectados
                    </div>
                  </div>
                </div>

                {/* Sesiones activas si existen */}
                {telemetryData?.activeHotspotSessions && telemetryData.activeHotspotSessions.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-slate-800">
                    <span className="text-[11px] font-semibold text-slate-300 block mb-2">
                      Usuarios Navegando Actualmente ({telemetryData.activeHotspotSessions.length}):
                    </span>
                    <div className="max-h-36 overflow-y-auto border border-slate-800 rounded-lg">
                      <table className="w-full text-[11px] text-left">
                        <thead className="bg-slate-900 text-slate-400 sticky top-0">
                          <tr>
                            <th className="py-1 px-2">PIN / Usuario</th>
                            <th className="py-1 px-2">IP Asignada</th>
                            <th className="py-1 px-2">Dirección MAC</th>
                            <th className="py-1 px-2">Tiempo</th>
                            <th className="py-1 px-2">Tráfico</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800">
                          {telemetryData.activeHotspotSessions.map((s: any) => (
                            <tr key={s.id} className="hover:bg-slate-800/40">
                              <td className="py-1 px-2 font-mono text-white font-bold">{s.user}</td>
                              <td className="py-1 px-2 font-mono text-cyan-300">{s.address}</td>
                              <td className="py-1 px-2 font-mono text-slate-400">{s.macAddress}</td>
                              <td className="py-1 px-2 font-mono text-slate-300">{s.uptime}</td>
                              <td className="py-1 px-2 font-mono text-emerald-400">↓{s.bytesOut} ↑{s.bytesIn}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>

              {/* 📋 4. SECCIÓN COLAPSABLE: Script Manual para Terminal */}
              <div className="border border-slate-800 rounded-xl overflow-hidden">
                <button
                  type="button"
                  onClick={() => setShowManualInModal(!showManualInModal)}
                  className="w-full px-4 py-3 bg-slate-950/60 hover:bg-slate-950 flex items-center justify-between text-left text-slate-300 font-semibold transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Terminal className="w-4 h-4 text-indigo-400" />
                    <span>¿Prefieres ver los comandos manuales para Winbox? (Opcional)</span>
                  </div>
                  {showManualInModal ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>

                {showManualInModal && (
                  <div className="p-4 bg-slate-950/90 border-t border-slate-800 space-y-3">
                    <p className="text-slate-400 text-xs">
                      Con la auto-configuración de 1 clic ya no necesitas estos comandos, pero si deseas copiarlos para otra instalación manual en Winbox:
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          const r = selectedRouterDetails;
                          setSelectedRouterDetails(null);
                          handleShowBootstrap(r.id, r.name);
                        }}
                        className="px-3 py-1.5 rounded-lg bg-indigo-950/50 hover:bg-indigo-900/60 text-indigo-300 border border-indigo-500/30 text-xs font-semibold transition-colors flex items-center gap-1.5"
                      >
                        <Copy className="w-3.5 h-3.5" />
                        Abrir Visor de Scripts Completo
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3.5 bg-slate-950/80 border-t border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const r = selectedRouterDetails;
                    setSelectedRouterDetails(null);
                    handleOpenEdit(r);
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-950/40 hover:bg-amber-900/50 text-amber-300 border border-amber-500/30 text-xs font-medium transition-colors"
                >
                  <Edit3 className="w-3.5 h-3.5 text-amber-400" />
                  Editar Conexión
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const r = selectedRouterDetails;
                    setSelectedRouterDetails(null);
                    handleDeleteRouter(r.id, r.name);
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-rose-400 hover:text-rose-300 hover:bg-rose-950/40 text-xs transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Eliminar
                </button>
              </div>

              <button
                type="button"
                onClick={() => setSelectedRouterDetails(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-lg transition-colors"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};


