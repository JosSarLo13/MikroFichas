import { Users, Plus, Shield, UserCheck } from 'lucide-react';

export const OperatorsView: React.FC = () => {
  const users = [
    {
      id: '1',
      username: 'admin',
      role: 'SUPERADMIN',
      email: 'admin@mikromanager.local',
      status: 'ACTIVO',
      lastLogin: '2026-10-04 21:05',
    },
    {
      id: '2',
      username: 'cajero_plaza',
      role: 'OPERADOR',
      email: 'caja1@mikromanager.local',
      status: 'ACTIVO',
      lastLogin: '2026-10-04 18:40',
    },
    {
      id: '3',
      username: 'supervisor_red',
      role: 'ADMIN',
      email: 'supervisor@mikromanager.local',
      status: 'ACTIVO',
      lastLogin: '2026-10-04 14:12',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-900/90 border border-slate-800 p-4 rounded-xl">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
            <Users className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white">Operadores y Roles (RBAC)</h2>
            <p className="text-xs text-slate-400">
              Control de acceso granular: SuperAdmin, Admin, Operador y Consulta
            </p>
          </div>
        </div>

        <button
          onClick={() => alert('Gestión de operadores disponible en Fase 10.')}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold text-xs shadow-md transition-all"
        >
          <Plus className="w-4 h-4" />
          Nuevo Operador
        </button>
      </div>

      <div className="bg-slate-900/90 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-950/60 text-slate-400 uppercase font-semibold border-b border-slate-800">
            <tr>
              <th className="py-3.5 px-4">Usuario</th>
              <th className="py-3.5 px-4">Rol Asignado</th>
              <th className="py-3.5 px-4">Correo Electrónico</th>
              <th className="py-3.5 px-4">Último Acceso</th>
              <th className="py-3.5 px-4">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/80">
            {users.map((u) => (
              <tr key={u.id} className="hover:bg-slate-800/30 transition-colors">
                <td className="py-3 px-4 font-bold text-white flex items-center gap-2">
                  <UserCheck className="w-4 h-4 text-slate-400" />
                  {u.username}
                </td>
                <td className="py-3 px-4">
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                      u.role === 'SUPERADMIN'
                        ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                        : u.role === 'ADMIN'
                        ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                        : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    }`}
                  >
                    <Shield className="w-3 h-3" />
                    {u.role}
                  </span>
                </td>
                <td className="py-3 px-4 text-slate-400">{u.email}</td>
                <td className="py-3 px-4 text-slate-400 font-mono">{u.lastLogin}</td>
                <td className="py-3 px-4">
                  <span className="text-[11px] text-emerald-400 font-medium">● Activo</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
