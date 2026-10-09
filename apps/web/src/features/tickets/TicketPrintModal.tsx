import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import {
  Printer,
  X,
  QrCode,
  LayoutGrid,
  FileText,
  Scissors,
  Wifi,
} from 'lucide-react';

export interface PrintableTicket {
  pin: string;
  username?: string;
  password?: string;
  planName: string;
  price: number;
  durationFormatted?: string;
  durationSeconds?: number;
  speed?: string;
  routerName?: string;
}

interface TicketPrintModalProps {
  tickets: PrintableTicket[];
  onClose: () => void;
  brandName?: string;
}

export const TicketPrintModal: React.FC<TicketPrintModalProps> = ({
  tickets,
  onClose,
  brandName = 'Fichas Sarmientos',
}) => {
  const [printFormat, setPrintFormat] = useState<'thermal58' | 'thermal80' | 'gridA4'>('thermal58');
  const [showQr, setShowQr] = useState<boolean>(true);
  const [showPrice, setShowPrice] = useState<boolean>(true);
  const [showInstructions, setShowInstructions] = useState<boolean>(true);
  const [qrCodes, setQrCodes] = useState<Record<string, string>>({});
  const [isGeneratingQr, setIsGeneratingQr] = useState<boolean>(true);

  const getTicketKey = (t: PrintableTicket, idx: number) => `${t.pin}_${t.username || ''}_${t.password || ''}_${idx}`;

  // Generate QR codes for all tickets offline via qrcode canvas/data-url
  useEffect(() => {
    let isMounted = true;
    const generateAllQrs = async () => {
      setIsGeneratingQr(true);
      const generated: Record<string, string> = {};

      for (let i = 0; i < tickets.length; i++) {
        const ticket = tickets[i];
        const key = getTicketKey(ticket, i);
        try {
          const u = ticket.username || ticket.pin;
          const p = ticket.password || ticket.pin;
          // Direct login URL for MikroTik captive portal
          const loginUrl = `http://hotspot.local/login?username=${encodeURIComponent(u)}&password=${encodeURIComponent(p)}`;
          
          const url = await QRCode.toDataURL(loginUrl, {
            width: 140,
            margin: 1,
            color: {
              dark: '#000000',
              light: '#ffffff',
            },
          });
          generated[key] = url;
        } catch (err) {
          console.error('Error generating QR for', ticket.pin, err);
        }
      }

      if (isMounted) {
        setQrCodes(generated);
        setIsGeneratingQr(false);
      }
    };

    generateAllQrs();
    return () => {
      isMounted = false;
    };
  }, [tickets]);

  const handlePrint = () => {
    window.print();
  };

  const formatDuration = (t: PrintableTicket) => {
    if (t.durationFormatted) return t.durationFormatted;
    if (t.durationSeconds) {
      const hours = Math.floor(t.durationSeconds / 3600);
      const mins = Math.floor((t.durationSeconds % 3600) / 60);
      if (hours > 0 && mins > 0) return `${hours}h ${mins}m`;
      if (hours > 0) return `${hours} hora${hours > 1 ? 's' : ''}`;
      return `${mins} min`;
    }
    return '1 Sesión';
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex flex-col justify-between overflow-y-auto">
      {/* Top Bar (Hidden during window.print) */}
      <div className="no-print sticky top-0 z-10 bg-slate-900 border-b border-slate-800 px-6 py-4 flex flex-wrap items-center justify-between gap-4 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
            <Printer className="w-5 h-5 text-cyan-400" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              Centro de Impresión • {brandName}
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-cyan-500/20 text-cyan-300">
                {tickets.length} {tickets.length === 1 ? 'ficha' : 'fichas'}
              </span>
            </h2>
            <p className="text-xs text-slate-400">
              Formato profesional para tickets térmicos (58mm/80mm) y planillas recortables
            </p>
          </div>
        </div>

        {/* Options */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Format selector */}
          <div className="flex bg-slate-950 p-1 rounded-lg border border-slate-800">
            <button
              onClick={() => setPrintFormat('thermal58')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all ${
                printFormat === 'thermal58'
                  ? 'bg-cyan-600 text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              Térmica 58mm
            </button>
            <button
              onClick={() => setPrintFormat('thermal80')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all ${
                printFormat === 'thermal80'
                  ? 'bg-cyan-600 text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              Térmica 80mm
            </button>
            <button
              onClick={() => setPrintFormat('gridA4')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all ${
                printFormat === 'gridA4'
                  ? 'bg-cyan-600 text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              Planilla A4 / Carta
            </button>
          </div>

          {/* Toggle Switches */}
          <label className="flex items-center gap-1.5 text-xs text-slate-300 bg-slate-800/80 px-2.5 py-1.5 rounded-lg border border-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={showQr}
              onChange={(e) => setShowQr(e.target.checked)}
              className="rounded accent-cyan-500"
            />
            <QrCode className="w-3.5 h-3.5 text-cyan-400" />
            Código QR
          </label>

          <label className="flex items-center gap-1.5 text-xs text-slate-300 bg-slate-800/80 px-2.5 py-1.5 rounded-lg border border-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={showPrice}
              onChange={(e) => setShowPrice(e.target.checked)}
              className="rounded accent-cyan-500"
            />
            Precio
          </label>

          <label className="flex items-center gap-1.5 text-xs text-slate-300 bg-slate-800/80 px-2.5 py-1.5 rounded-lg border border-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={showInstructions}
              onChange={(e) => setShowInstructions(e.target.checked)}
              className="rounded accent-cyan-500"
            />
            Instrucciones
          </label>

          {/* Actions */}
          <button
            onClick={handlePrint}
            disabled={isGeneratingQr}
            className="flex items-center gap-2 px-5 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs shadow-lg transition-all disabled:opacity-50"
          >
            <Printer className="w-4 h-4" />
            Imprimir Ahora
          </button>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Main Print Preview Area */}
      <div className="flex-1 py-8 px-4 flex justify-center items-start bg-slate-950/80">
        <style dangerouslySetInnerHTML={{ __html: `
          @media print {
            body {
              background: white !important;
              color: black !important;
              margin: 0 !important;
              padding: 0 !important;
            }
            .no-print {
              display: none !important;
            }
            .print-container {
              width: 100% !important;
              margin: 0 !important;
              padding: 0 !important;
              background: white !important;
            }
            .ticket-thermal-58 {
              width: 54mm !important;
              max-width: 54mm !important;
              page-break-inside: avoid !important;
              margin: 0 auto 4mm auto !important;
              padding: 2mm !important;
              border-bottom: 1px dashed #000 !important;
              font-family: monospace, sans-serif !important;
              color: #000 !important;
            }
            .ticket-thermal-80 {
              width: 74mm !important;
              max-width: 74mm !important;
              page-break-inside: avoid !important;
              margin: 0 auto 4mm auto !important;
              padding: 3mm !important;
              border-bottom: 1px dashed #000 !important;
              font-family: monospace, sans-serif !important;
              color: #000 !important;
            }
            .ticket-grid-a4 {
              display: grid !important;
              grid-template-columns: repeat(3, 1fr) !important;
              gap: 3mm !important;
              width: 100% !important;
            }
            .ticket-card-a4 {
              border: 1px dashed #666 !important;
              padding: 3mm !important;
              page-break-inside: avoid !important;
              color: #000 !important;
              background: #fff !important;
            }
          }
        `}} />

        {/* Format: 58mm Thermal Tape */}
        {printFormat === 'thermal58' && (
          <div className="print-container bg-white text-black p-4 rounded-xl shadow-2xl flex flex-col items-center max-w-[280px] w-full border border-slate-200">
            <div className="no-print text-center mb-3 pb-2 border-b border-gray-200 w-full">
              <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                Vista Previa Tira Térmica 58mm
              </span>
            </div>

            {tickets.map((t, idx) => (
              <div
                key={idx}
                className="ticket-thermal-58 w-full border-b-2 border-dashed border-gray-400 pb-4 mb-4 text-center font-mono"
              >
                {/* Brand */}
                <div className="flex items-center justify-center gap-1 font-black text-sm tracking-tight text-gray-950 uppercase">
                  <span>📶</span> {brandName}
                </div>
                <div className="text-[9px] uppercase tracking-widest text-gray-600 mb-1">
                  Internet Wi-Fi de Alta Velocidad
                </div>

                {/* Plan Name & Price */}
                <div className="bg-gray-100 border border-gray-300 rounded py-1 my-1">
                  <div className="font-extrabold text-xs text-gray-900 uppercase">
                    {t.planName} ({formatDuration(t)})
                  </div>
                  {showPrice && (
                    <div className="font-black text-sm text-gray-950">
                      ${t.price.toFixed(2)} MXN
                    </div>
                  )}
                  {t.speed && (
                    <div className="text-[9px] text-gray-600">
                      ⚡ Velocidad: {t.speed}
                    </div>
                  )}
                </div>

                {/* QR Code */}
                {showQr && qrCodes[getTicketKey(t, idx)] && (
                  <div className="my-2 flex flex-col items-center justify-center">
                    <img
                      src={qrCodes[getTicketKey(t, idx)]}
                      alt={`QR ${t.pin}`}
                      className="w-28 h-28 mx-auto"
                    />
                    <span className="text-[8px] text-gray-600 mt-0.5">
                      Escanea con tu cámara para conectar directo
                    </span>
                  </div>
                )}

                {/* Credentials Box */}
                {t.username && t.password && t.username !== t.password ? (
                  <div className="border-2 border-black rounded p-1.5 my-1.5 bg-gray-50 text-center">
                    <div className="text-[8px] text-gray-600 font-bold uppercase tracking-wider mb-1">
                      Credenciales de Acceso
                    </div>
                    <div className="grid grid-cols-2 gap-1.5">
                      <div className="bg-white border border-gray-300 rounded p-1">
                        <div className="text-[7px] text-gray-500 font-bold uppercase">USUARIO</div>
                        <div className="text-sm font-black tracking-wider text-gray-950">{t.username}</div>
                      </div>
                      <div className="bg-white border border-gray-300 rounded p-1">
                        <div className="text-[7px] text-gray-500 font-bold uppercase">CONTRASEÑA</div>
                        <div className="text-sm font-black tracking-wider text-gray-950">{t.password}</div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="border-2 border-black rounded p-1.5 my-1.5 bg-gray-50">
                    <div className="text-[8px] text-gray-600 font-bold uppercase tracking-wider">
                      PIN / Clave de Acceso
                    </div>
                    <div className="text-xl font-black tracking-widest text-gray-950 py-0.5">
                      {t.pin}
                    </div>
                  </div>
                )}

                {/* Instructions */}
                {showInstructions && (
                  <div className="text-[8px] text-gray-700 leading-tight text-left mt-2 border-t border-gray-200 pt-1">
                    <div>1. Conéctate al Wi-Fi del lugar</div>
                    <div>2. Abre tu navegador: <strong>http://hotspot.local</strong></div>
                    <div>3. Ingresa tus datos y pulsa <strong>Conectar</strong></div>
                  </div>
                )}

                <div className="text-[7px] text-gray-500 mt-2">
                  ¡Gracias por su preferencia!
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Format: 80mm Thermal Tape */}
        {printFormat === 'thermal80' && (
          <div className="print-container bg-white text-black p-6 rounded-xl shadow-2xl flex flex-col items-center max-w-[360px] w-full border border-slate-200">
            <div className="no-print text-center mb-3 pb-2 border-b border-gray-200 w-full">
              <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                Vista Previa Tira Térmica 80mm (Estándar POS)
              </span>
            </div>

            {tickets.map((t, idx) => (
              <div
                key={idx}
                className="ticket-thermal-80 w-full border-b-2 border-dashed border-gray-400 pb-5 mb-5 text-center font-mono"
              >
                {/* Brand */}
                <div className="flex items-center justify-center gap-1.5 font-black text-base tracking-tight text-gray-950 uppercase">
                  <span>📶</span> {brandName}
                </div>
                <div className="text-[10px] uppercase tracking-widest text-gray-600 mb-1.5">
                  Acceso a Internet Wi-Fi Prepago
                </div>

                {/* Plan info */}
                <div className="bg-gray-100 border border-gray-300 rounded-lg p-2 my-2 flex justify-between items-center">
                  <div className="text-left">
                    <div className="font-extrabold text-xs text-gray-900 uppercase">
                      {t.planName}
                    </div>
                    <div className="text-[10px] text-gray-600">
                      Tiempo: {formatDuration(t)} {t.speed ? `• ${t.speed}` : ''}
                    </div>
                  </div>
                  {showPrice && (
                    <div className="font-black text-base text-gray-950">
                      ${t.price.toFixed(2)}
                    </div>
                  )}
                </div>

                {/* QR Code */}
                {showQr && qrCodes[getTicketKey(t, idx)] && (
                  <div className="my-2.5 flex flex-col items-center justify-center">
                    <img
                      src={qrCodes[getTicketKey(t, idx)]}
                      alt={`QR ${t.pin}`}
                      className="w-32 h-32 mx-auto"
                    />
                    <span className="text-[9px] text-gray-600 mt-1 font-bold">
                      Escanea este código QR para entrar al instante
                    </span>
                  </div>
                )}

                {/* Credentials Box */}
                {t.username && t.password && t.username !== t.password ? (
                  <div className="border-2 border-black rounded-lg p-2.5 my-2 bg-gray-50 text-center">
                    <div className="text-[9px] text-gray-600 font-bold uppercase tracking-wider mb-1.5">
                      CREDENCIALES DE ACCESO
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="bg-white border border-gray-300 rounded-md p-1.5">
                        <div className="text-[8px] text-gray-500 font-bold uppercase">USUARIO</div>
                        <div className="text-lg font-black tracking-wider text-gray-950">{t.username}</div>
                      </div>
                      <div className="bg-white border border-gray-300 rounded-md p-1.5">
                        <div className="text-[8px] text-gray-500 font-bold uppercase">CONTRASEÑA</div>
                        <div className="text-lg font-black tracking-wider text-gray-950">{t.password}</div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="border-2 border-black rounded-lg p-2 my-2 bg-gray-50">
                    <div className="text-[9px] text-gray-600 font-bold uppercase tracking-wider">
                      PIN / CÓDIGO DE NAVEGACIÓN
                    </div>
                    <div className="text-2xl font-black tracking-widest text-gray-950 py-1">
                      {t.pin}
                    </div>
                  </div>
                )}

                {/* Instructions */}
                {showInstructions && (
                  <div className="text-[9px] text-gray-700 leading-normal text-left mt-2.5 border-t border-gray-200 pt-1.5">
                    <div><strong>Instrucciones de Conexión:</strong></div>
                    <div>1. Conéctate a la red Wi-Fi de este establecimiento.</div>
                    <div>2. Si no abre el portal, ingresa a: <strong>http://hotspot.local</strong></div>
                    <div>3. Escribe tus credenciales y presiona <strong>CONECTAR</strong>.</div>
                  </div>
                )}

                <div className="text-[8px] text-gray-500 mt-3">
                  {t.routerName ? `Servidor: ${t.routerName} • ` : ''}Fichas Sarmientos
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Format: A4 / Letter Cuttable Sheet (Grid) */}
        {printFormat === 'gridA4' && (
          <div className="print-container bg-white text-black p-6 rounded-xl shadow-2xl max-w-4xl w-full border border-slate-200">
            <div className="no-print flex items-center justify-between mb-4 pb-2 border-b border-gray-200">
              <span className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
                <Scissors className="w-4 h-4 text-cyan-600" />
                Planilla de Tarjetas Recortables (Formato Carta / A4)
              </span>
              <span className="text-xs text-gray-500">
                Líneas punteadas para cortar fácilmente con tijera o guillotina
              </span>
            </div>

            <div className="ticket-grid-a4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {tickets.map((t, idx) => (
                <div
                  key={idx}
                  className="ticket-card-a4 border-2 border-dashed border-gray-300 rounded-lg p-3 flex flex-col justify-between font-mono bg-white relative hover:border-gray-500 transition-colors"
                >
                  <div className="flex items-center justify-between border-b border-gray-200 pb-1.5 mb-1.5">
                    <div className="flex items-center gap-1">
                      <Wifi className="w-3.5 h-3.5 text-blue-600" />
                      <span className="font-extrabold text-[11px] uppercase tracking-tight text-gray-900">
                        {brandName}
                      </span>
                    </div>
                    {showPrice && (
                      <span className="font-black text-xs text-gray-950 bg-gray-100 px-1.5 py-0.5 rounded">
                        ${t.price.toFixed(2)}
                      </span>
                    )}
                  </div>

                  <div className="text-[10px] font-bold text-gray-800 uppercase mb-1">
                    {t.planName} • {formatDuration(t)}
                  </div>

                  <div className="flex items-center gap-2 my-1">
                    {showQr && qrCodes[getTicketKey(t, idx)] && (
                      <img
                        src={qrCodes[getTicketKey(t, idx)]}
                        alt={`QR ${t.pin}`}
                        className="w-16 h-16 border border-gray-200 p-0.5 rounded"
                      />
                    )}

                    <div className="flex-1 text-center bg-gray-50 border border-gray-200 rounded p-1">
                      {t.username && t.password && t.username !== t.password ? (
                        <div>
                          <div className="text-[7px] text-gray-500 font-bold uppercase">U: <span className="text-xs text-gray-950">{t.username}</span></div>
                          <div className="text-[7px] text-gray-500 font-bold uppercase">P: <span className="text-xs text-gray-950">{t.password}</span></div>
                        </div>
                      ) : (
                        <div>
                          <div className="text-[8px] text-gray-500 font-bold uppercase">PIN</div>
                          <div className="text-sm font-black tracking-widest text-gray-950">{t.pin}</div>
                        </div>
                      )}
                      {t.speed && (
                        <div className="text-[7px] text-gray-500">
                          {t.speed}
                        </div>
                      )}
                    </div>
                  </div>

                  {showInstructions && (
                    <div className="text-[7px] text-gray-600 mt-1 leading-tight border-t border-gray-100 pt-1">
                      Conéctate al Wi-Fi e ingresa tu PIN en http://hotspot.local
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
