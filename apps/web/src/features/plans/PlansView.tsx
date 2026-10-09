import React, { useState, useEffect } from 'react';
import {
  Layers,
  Plus,
  Clock,
  ArrowDownCircle,
  ArrowUpCircle,
  Users,
  RefreshCw,
  X,
  Server,
} from 'lucide-react';

interface PlanItem {
  id: string;
  name: string;
  price: number;
  durationSeconds: number;
  durationFormatted: string;
  downloadSpeedKbps: number;
  uploadSpeedKbps: number;
  validityType: string;
  sharedUsers: number;
  routerId: string;
  routerName: string;
  availableStock: number;
}

interface RouterOption {
  id: string;
  name: string;
}

export const PlansView: React.FC = () => {
  const [plans, setPlans] = useState<PlanItem[]>([]);
  const [routers, setRouters] = useState<RouterOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    price: 15.0,
    durationHours: 3,
    validityType: 'UPTIME_ACCUMULATED',
    downloadSpeedMbps: 5,
    uploadSpeedMbps: 2,
    sharedUsers: 1,
    routerId: '',
  });

  const fetchPlansAndRouters = async () => {
    try {
      setLoading(true);
      const [plansRes, routersRes] = await Promise.all([
        fetch('/api/v1/plans').then((r) => r.json()),
        fetch('/api/v1/routers').then((r) => r.json()),
      ]);

      if (plansRes.success && plansRes.data) {
        setPlans(plansRes.data);
      }
      if (routersRes.success && routersRes.data) {
        setRouters(routersRes.data);
        if (routersRes.data.length > 0 && !formData.routerId) {
          setFormData((prev) => ({ ...prev, routerId: routersRes.data[0].id }));
        }
      }
    } catch (e) {
      console.error('Error al cargar planes:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPlansAndRouters();
  }, []);

  const handleCreatePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.routerId) {
      alert('Completa todos los campos requeridos');
      return;
    }

    try {
      const payload = {
        name: formData.name,
        price: Number(formData.price),
        durationSeconds: Number(formData.durationHours) * 3600,
        validityType: formData.validityType,
        downloadSpeedKbps: Number(formData.downloadSpeedMbps) * 1024,
        uploadSpeedKbps: Number(formData.uploadSpeedMbps) * 1024,
        sharedUsers: Number(formData.sharedUsers),
        routerId: formData.routerId,
        hotspotProfileName: `PLAN_${formData.durationHours}H`,
      };

      const res = await fetch('/api/v1/plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (json.success) {
        setShowAddModal(false);
        setFormData({
          name: '',
          price: 15.0,
          durationHours: 3,
          validityType: 'UPTIME_ACCUMULATED',
          downloadSpeedMbps: 5,
          uploadSpeedMbps: 2,
          sharedUsers: 1,
          routerId: routers[0]?.id || '',
        });
        fetchPlansAndRouters();
      } else {
        alert(json.error?.message || 'Error al crear plan');
      }
    } catch (err: any) {
      alert(`Error al crear plan: ${err.message}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top action header */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-900/90 border border-slate-800 p-4 rounded-xl">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
            <Layers className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white">Catálogo de Planes y Tarifas</h2>
            <p className="text-xs text-slate-400">
              Perfiles sincronizados con /ip/hotspot/user/profile de RouterOS
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchPlansAndRouters}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-cyan-400' : ''}`} />
            Actualizar
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold text-xs shadow-md transition-all"
          >
            <Plus className="w-4 h-4" />
            Nuevo Plan
          </button>
        </div>
      </div>

      {/* Loading State */}
      {loading && plans.length === 0 && (
        <div className="p-12 text-center text-slate-400 bg-slate-900/40 rounded-xl border border-slate-800">
          <RefreshCw className="w-6 h-6 animate-spin mx-auto text-cyan-400 mb-2" />
          <p className="text-xs">Cargando planes desde la base de datos...</p>
        </div>
      )}

      {/* Empty State */}
      {!loading && plans.length === 0 && (
        <div className="p-12 text-center text-slate-400 bg-slate-900/60 rounded-xl border border-slate-800">
          <Server className="w-10 h-10 mx-auto text-slate-600 mb-3" />
          <h3 className="text-base font-bold text-white mb-1">No hay planes creados aún</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto mb-4">
            Crea tu primer plan (ej: 2 Horas $10, 1 Día $30) para que aparezca disponible en el Punto de Venta y en la App Android de tus vendedores.
          </p>
          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold text-xs rounded-lg"
          >
            Crear Plan Ahora
          </button>
        </div>
      )}

      {/* Plans Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {plans.map((p) => (
          <div
            key={p.id}
            className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 hover:border-slate-700 transition-all flex flex-col justify-between shadow-sm"
          >
            <div>
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-base font-bold text-white">{p.name}</h3>
                  <span className="text-[10px] font-mono text-cyan-400 bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-800/40">
                    {p.routerName}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-2xl font-extrabold text-emerald-400 font-mono">
                    ${p.price.toFixed(2)}
                  </span>
                  <div className="text-[10px] text-slate-500">MXN</div>
                </div>
              </div>

              <div className="mt-4 space-y-2 text-xs">
                <div className="flex items-center justify-between text-slate-300">
                  <span className="flex items-center gap-1.5 text-slate-400">
                    <Clock className="w-3.5 h-3.5" /> Duración:
                  </span>
                  <span className="font-semibold">{p.durationFormatted}</span>
                </div>

                <div className="flex items-center justify-between text-slate-300">
                  <span className="flex items-center gap-1.5 text-slate-400">
                    <ArrowDownCircle className="w-3.5 h-3.5 text-emerald-400" /> Descarga:
                  </span>
                  <span className="font-mono text-emerald-400 font-bold">
                    {(p.downloadSpeedKbps / 1024).toFixed(0)} Mbps
                  </span>
                </div>

                <div className="flex items-center justify-between text-slate-300">
                  <span className="flex items-center gap-1.5 text-slate-400">
                    <ArrowUpCircle className="w-3.5 h-3.5 text-cyan-400" /> Subida:
                  </span>
                  <span className="font-mono text-cyan-400 font-bold">
                    {(p.uploadSpeedKbps / 1024).toFixed(0)} Mbps
                  </span>
                </div>

                <div className="flex items-center justify-between text-slate-300">
                  <span className="flex items-center gap-1.5 text-slate-400">
                    <Users className="w-3.5 h-3.5" /> Dispositivos:
                  </span>
                  <span>{p.sharedUsers} usuario</span>
                </div>
              </div>
            </div>

            <div className="mt-5 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
              <span className="text-slate-400">Fichas en Stock:</span>
              <span className="font-mono font-bold text-cyan-400 px-2 py-0.5 rounded bg-slate-950 border border-slate-800">
                {p.availableStock} disponibles
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Modal: Nuevo Plan */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-md w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Layers className="w-4 h-4 text-cyan-400" />
                Crear Nuevo Plan de Internet
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreatePlan} className="space-y-4 text-xs">
              <div>
                <label className="text-slate-300 font-semibold block mb-1">Nombre del Plan:</label>
                <input
                  type="text"
                  placeholder="Ej: 3 Horas Alta Velocidad"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-cyan-500"
                  required
                />
              </div>

              <div>
                <label className="text-slate-300 font-semibold block mb-1">Asignar a Router MikroTik:</label>
                <select
                  value={formData.routerId}
                  onChange={(e) => setFormData({ ...formData, routerId: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-cyan-500"
                  required
                >
                  {routers.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 font-semibold block mb-1">Precio ($ MXN):</label>
                  <input
                    type="number"
                    step="0.5"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 font-mono text-emerald-400 font-bold focus:outline-none focus:border-cyan-500"
                    required
                  />
                </div>
                <div>
                  <label className="text-slate-300 font-semibold block mb-1">Duración (Horas):</label>
                  <input
                    type="number"
                    value={formData.durationHours}
                    onChange={(e) => setFormData({ ...formData, durationHours: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 font-mono text-white focus:outline-none focus:border-cyan-500"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 font-semibold block mb-1">Descarga (Mbps):</label>
                  <input
                    type="number"
                    value={formData.downloadSpeedMbps}
                    onChange={(e) => setFormData({ ...formData, downloadSpeedMbps: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 font-mono text-cyan-400 focus:outline-none focus:border-cyan-500"
                    required
                  />
                </div>
                <div>
                  <label className="text-slate-300 font-semibold block mb-1">Subida (Mbps):</label>
                  <input
                    type="number"
                    value={formData.uploadSpeedMbps}
                    onChange={(e) => setFormData({ ...formData, uploadSpeedMbps: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 font-mono text-cyan-400 focus:outline-none focus:border-cyan-500"
                    required
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold rounded-lg"
                >
                  Guardar Plan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
