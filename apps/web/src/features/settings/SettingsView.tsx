import { ShieldCheck, Save, CheckCircle } from 'lucide-react';

export const SettingsView: React.FC = () => {
  return (
    <div className="space-y-6 max-w-4xl">
      <div className="bg-slate-900/90 border border-slate-800 p-5 rounded-xl">
        <div className="flex items-center gap-3 border-b border-slate-800 pb-3 mb-4">
          <ShieldCheck className="w-5 h-5 text-cyan-400" />
          <div>
            <h2 className="text-sm font-bold text-white">Parámetros de Seguridad y API</h2>
            <p className="text-xs text-slate-400">
              Configuración de cifrado AES-256-GCM y puertos de conexión con RouterOS
            </p>
          </div>
        </div>

        <div className="space-y-4 text-xs">
          <div>
            <label className="text-slate-300 font-semibold block mb-1">
              Puerto API Estándar (Sin SSL):
            </label>
            <input
              type="number"
              defaultValue={8728}
              className="w-48 bg-slate-950 border border-slate-800 rounded px-3 py-1.5 font-mono text-white focus:outline-none focus:border-cyan-500"
            />
            <span className="text-[11px] text-slate-400 block mt-1">
              Puerto TCP predeterminado en RouterOS para LAN privada.
            </span>
          </div>

          <div className="pt-3 border-t border-slate-800">
            <label className="text-slate-300 font-semibold block mb-1">
              Puerto API-SSL (Cifrado TLS):
            </label>
            <input
              type="number"
              defaultValue={8729}
              className="w-48 bg-slate-950 border border-slate-800 rounded px-3 py-1.5 font-mono text-white focus:outline-none focus:border-cyan-500"
            />
            <span className="text-[11px] text-slate-400 block mt-1">
              Recomendado para enlaces remotos o a través de Internet.
            </span>
          </div>

          <div className="pt-3 border-t border-slate-800">
            <div className="flex items-center gap-2 text-emerald-400 font-semibold">
              <CheckCircle className="w-4 h-4" />
              Cifrado en Reposo Activo
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Todas las credenciales de MikroTik se almacenan cifradas con AES-256-GCM utilizando un vector de inicialización (IV) único de 96 bits por router.
            </p>
          </div>
        </div>

        <div className="mt-6 pt-4 border-t border-slate-800 flex justify-end">
          <button
            onClick={() => alert('Parámetros guardados.')}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold text-xs shadow-md transition-all"
          >
            <Save className="w-4 h-4" />
            Guardar Configuración
          </button>
        </div>
      </div>
    </div>
  );
};
