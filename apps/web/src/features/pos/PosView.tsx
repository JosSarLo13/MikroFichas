import React, { useState, useEffect } from 'react';
import {
  ShoppingCart,
  Printer,
  CreditCard,
  Banknote,
  CheckCircle2,
  Receipt,
  RotateCcw,
  RefreshCw,
} from 'lucide-react';
import { TicketPrintModal, PrintableTicket } from '../tickets/TicketPrintModal';

interface PosPlan {
  id: string;
  name: string;
  price: number;
  durationFormatted: string;
  availableStock: number;
  routerId: string;
  routerName: string;
  downloadSpeedKbps?: number;
  uploadSpeedKbps?: number;
}

export const PosView: React.FC = () => {
  const [plans, setPlans] = useState<PosPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPlanId, setSelectedPlanId] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'TRANSFER'>('CASH');
  const [amountPaid, setAmountPaid] = useState<number>(50);
  const [selling, setSelling] = useState(false);
  const [lastSale, setLastSale] = useState<any | null>(null);
  const [printTickets, setPrintTickets] = useState<PrintableTicket[] | null>(null);

  const fetchPlans = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/v1/plans');
      const json = await res.json();
      if (json.success && json.data) {
        setPlans(json.data);
        if (json.data.length > 0 && !selectedPlanId) {
          setSelectedPlanId(json.data[0].id);
        }
      }
    } catch (e) {
      console.error('Error cargando planes POS:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPlans();
  }, []);

  const currentPlan = plans.find((p) => p.id === selectedPlanId) || plans[0];
  const change = currentPlan && amountPaid > currentPlan.price ? amountPaid - currentPlan.price : 0;

  const handleCompleteSale = async () => {
    if (!currentPlan) return;
    setSelling(true);

    try {
      const res = await fetch('/api/v1/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          routerId: currentPlan.routerId,
          planId: currentPlan.id,
          paymentMethod,
          receivedAmount: amountPaid,
          notes: 'Venta rápida desde Panel Web POS',
        }),
      });

      const json = await res.json();
      if (json.success && json.data) {
        setLastSale(json.data);
        fetchPlans(); // Actualizar stock de planes

        setPrintTickets([
          {
            pin: json.data.pin,
            planName: json.data.planName,
            price: json.data.price,
            durationFormatted: json.data.durationFormatted,
            routerName: currentPlan.routerName,
            speed:
              currentPlan.downloadSpeedKbps && currentPlan.uploadSpeedKbps
                ? `${currentPlan.downloadSpeedKbps / 1024}M / ${currentPlan.uploadSpeedKbps / 1024}M`
                : undefined,
          },
        ]);
      } else {
        alert(json.error?.message || 'Error al procesar cobro');
      }
    } catch (e: any) {
      alert(`Fallo al procesar venta: ${e.message}`);
    } finally {
      setSelling(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Left 2 Cols: Plan Selection */}
      <div className="lg:col-span-2 space-y-4">
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <ShoppingCart className="w-4 h-4 text-cyan-400" />
              Selecciona el Plan de Internet
            </h2>
            <button
              onClick={fetchPlans}
              className="text-xs text-slate-400 hover:text-cyan-400 flex items-center gap-1"
            >
              <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
              Actualizar
            </button>
          </div>

          {loading && plans.length === 0 && (
            <p className="text-xs text-slate-400 py-6 text-center">Cargando planes disponibles...</p>
          )}

          {!loading && plans.length === 0 && (
            <div className="p-8 text-center text-slate-400">
              <p className="text-sm font-semibold text-white">No hay planes registrados</p>
              <p className="text-xs mt-1">Crea primero un plan en la sección "Planes y Tarifas".</p>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {plans.map((p) => {
              const isSelected = selectedPlanId === p.id;
              return (
                <button
                  key={p.id}
                  onClick={() => setSelectedPlanId(p.id)}
                  className={`p-4 rounded-xl text-left transition-all border relative flex flex-col justify-between ${
                    isSelected
                      ? 'bg-gradient-to-br from-cyan-950/40 to-blue-950/20 border-cyan-500 shadow-md shadow-cyan-950/50'
                      : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-base font-bold text-white">{p.name}</span>
                      <span className="text-lg font-mono font-extrabold text-emerald-400">
                        ${p.price.toFixed(2)}
                      </span>
                    </div>
                    <div className="text-xs text-slate-400 mt-1">{p.durationFormatted}</div>
                  </div>

                  <div className="mt-4 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px]">
                    <span className="text-slate-400">{p.routerName}</span>
                    <span className="font-mono text-cyan-400 font-bold">
                      {p.availableStock} en stock
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Payment Method Selector */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5">
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
            Método de Pago
          </h3>

          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={() => setPaymentMethod('CASH')}
              className={`p-3.5 rounded-lg border text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                paymentMethod === 'CASH'
                  ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400'
                  : 'bg-slate-950 border-slate-800 text-slate-400'
              }`}
            >
              <Banknote className="w-4 h-4" />
              Efectivo
            </button>
            <button
              onClick={() => setPaymentMethod('TRANSFER')}
              className={`p-3.5 rounded-lg border text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                paymentMethod === 'TRANSFER'
                  ? 'bg-cyan-500/10 border-cyan-500/40 text-cyan-400'
                  : 'bg-slate-950 border-slate-800 text-slate-400'
              }`}
            >
              <CreditCard className="w-4 h-4" />
              Transferencia / Depósito
            </button>
          </div>
        </div>
      </div>

      {/* Right Col: Ticket Receipt Summary & Print */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <Receipt className="w-4 h-4 text-emerald-400" />
              Resumen de Cobro
            </h2>
            <span className="text-[10px] font-mono text-slate-400">Transacción Real</span>
          </div>

          {currentPlan ? (
            <div className="space-y-3 text-xs">
              <div className="flex justify-between text-slate-300">
                <span className="text-slate-400">Plan Seleccionado:</span>
                <span className="font-bold text-white">{currentPlan.name}</span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span className="text-slate-400">Total a Cobrar:</span>
                <span className="font-mono text-xl font-extrabold text-emerald-400">
                  ${currentPlan.price.toFixed(2)} MXN
                </span>
              </div>

              {paymentMethod === 'CASH' && (
                <div className="pt-2 border-t border-slate-800">
                  <label className="text-[11px] text-slate-400 block mb-1">
                    Monto Recibido en Efectivo:
                  </label>
                  <div className="flex items-center gap-2">
                    <span className="text-slate-500 font-mono">$</span>
                    <input
                      type="number"
                      value={amountPaid}
                      onChange={(e) => setAmountPaid(Number(e.target.value))}
                      className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                  <div className="flex justify-between mt-2 text-xs">
                    <span className="text-slate-400">Cambio a Entregar:</span>
                    <span className="font-mono font-bold text-cyan-400">${change.toFixed(2)}</span>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <p className="text-xs text-slate-500">Selecciona un plan para ver el desglose.</p>
          )}

          {/* Último ticket emitido */}
          {lastSale && (
            <div className="mt-5 p-4 rounded-xl bg-emerald-950/20 border border-emerald-500/40 text-xs">
              <div className="flex items-center gap-1.5 text-emerald-400 font-bold mb-1">
                <CheckCircle2 className="w-4 h-4" /> Venta Registrada con Éxito
              </div>
              <div className="text-slate-200 mt-2 font-mono text-sm">
                PIN Hotspot: <strong className="text-white text-lg font-bold">{lastSale.pin}</strong>
              </div>
              <div className="text-[11px] text-slate-400 mt-1">
                {lastSale.planName} • ${lastSale.price.toFixed(2)} MXN
              </div>
              <div className="text-[10px] text-cyan-400 font-mono mt-1 break-all">
                {lastSale.qrData}
              </div>

              <button
                onClick={() => {
                  setPrintTickets([
                    {
                      pin: lastSale.pin,
                      planName: lastSale.planName,
                      price: lastSale.price,
                      durationFormatted: lastSale.durationFormatted,
                      routerName: currentPlan?.routerName,
                    },
                  ]);
                }}
                className="mt-3 w-full flex items-center justify-center gap-1.5 py-1.5 px-3 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 rounded-lg font-bold text-xs transition-colors"
              >
                <Printer className="w-3.5 h-3.5" /> Re-imprimir Ticket Térmico
              </button>
            </div>
          )}
        </div>

        <div className="mt-6 space-y-2">
          <button
            onClick={handleCompleteSale}
            disabled={!currentPlan || selling}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-extrabold text-sm shadow-lg shadow-emerald-950/50 transition-all active:scale-[0.98] disabled:opacity-50"
          >
            <Printer className={`w-4 h-4 ${selling ? 'animate-spin' : ''}`} />
            {selling ? 'Procesando Venta...' : 'Cobrar e Imprimir Ficha'}
          </button>

          {lastSale && (
            <button
              onClick={() => setLastSale(null)}
              className="w-full flex items-center justify-center gap-1.5 py-2 text-xs text-slate-400 hover:text-slate-200"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Nueva Operación
            </button>
          )}
        </div>
      </div>

      {/* Modal de Impresión de Fichas Térmicas */}
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
