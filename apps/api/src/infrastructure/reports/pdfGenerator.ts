import PDFDocument from 'pdfkit';

export interface PdfSaleTransaction {
  id: string;
  formattedDate: string;
  formattedTime: string;
  vendor: string;
  routerName: string;
  planName: string;
  username: string;
  password?: string;
  amount: number;
  paymentMethod: string;
}

export interface PdfReportOptions {
  periodLabel: string;
  operatorName?: string;
  totalRevenue: number;
  totalTickets: number;
  paymentMethods: Record<string, number>;
  byRouter: Array<{ routerName: string; revenue: number; tickets: number }>;
  byPlan: Array<{ planName: string; price: number; revenue: number; tickets: number }>;
  transactions: PdfSaleTransaction[];
}

export function generateCortePdfBuffer(data: PdfReportOptions): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        margin: 36,
        size: 'A4',
        info: {
          Title: 'Corte de Caja - MikroFichas',
          Author: 'MikroFichas Hotspot System',
          Subject: 'Auditoría y Arqueo Financiero',
        },
      });

      const chunks: Buffer[] = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', (err) => reject(err));

      const pageWidth = doc.page.width; // 595.28
      const margin = 36;
      const contentWidth = pageWidth - margin * 2; // 523.28

      // 1. BANNER DE CABECERA
      doc.rect(margin, margin, contentWidth, 54).fill('#0f172a'); // slate-900
      doc.rect(margin, margin + 50, contentWidth, 4).fill('#06b6d4'); // cyan-500 accent

      doc.fillColor('#ffffff').fontSize(16).font('Helvetica-Bold');
      doc.text('MIKROFICHAS - CORTE DE CAJA OFICIAL', margin + 14, margin + 12);

      doc.fontSize(8.5).font('Helvetica').fillColor('#94a3b8');
      doc.text(
        `Control Financiero Hotspot MikroTik  |  Periodo: ${data.periodLabel}  |  Emisión: ${new Date().toLocaleString('es-MX')}`,
        margin + 14,
        margin + 32
      );

      let currentY = margin + 68;

      // 2. TARJETAS DE RESUMEN EJECUTIVO
      const cardWidth = (contentWidth - 16) / 3;
      const cardHeight = 48;

      // Tarjeta 1: Total Recaudado
      doc.rect(margin, currentY, cardWidth, cardHeight).fillAndStroke('#f8fafc', '#e2e8f0');
      doc.fillColor('#64748b').fontSize(7.5).font('Helvetica-Bold').text('TOTAL RECAUDADO', margin + 8, currentY + 7);
      doc.fillColor('#059669').fontSize(15).font('Helvetica-Bold').text(
        `$${data.totalRevenue.toFixed(2)} MXN`,
        margin + 8,
        currentY + 20
      );

      // Tarjeta 2: Total Fichas Vendidas
      const x2 = margin + cardWidth + 8;
      doc.rect(x2, currentY, cardWidth, cardHeight).fillAndStroke('#f8fafc', '#e2e8f0');
      doc.fillColor('#64748b').fontSize(7.5).font('Helvetica-Bold').text('FICHAS VENDIDAS', x2 + 8, currentY + 7);
      doc.fillColor('#0f172a').fontSize(15).font('Helvetica-Bold').text(
        `${data.totalTickets} fichas`,
        x2 + 8,
        currentY + 20
      );

      // Tarjeta 3: Operador / Auditor
      const x3 = margin + (cardWidth + 8) * 2;
      doc.rect(x3, currentY, cardWidth, cardHeight).fillAndStroke('#f8fafc', '#e2e8f0');
      doc.fillColor('#64748b').fontSize(7.5).font('Helvetica-Bold').text('RESPONSABLE DE TURNO', x3 + 8, currentY + 7);
      doc.fillColor('#0284c7').fontSize(11).font('Helvetica-Bold').text(
        data.operatorName || 'Administrador General',
        x3 + 8,
        currentY + 23
      );

      currentY += cardHeight + 14;

      // 3. TABLA DE MÉTODOS DE PAGO Y VENTAS POR PLAN
      const colWidthHalf = (contentWidth - 10) / 2;

      // Columna Izquierda: Métodos de Pago
      doc.rect(margin, currentY, colWidthHalf, 18).fill('#1e293b');
      doc.fillColor('#ffffff').fontSize(8.5).font('Helvetica-Bold').text('DESGLOSE DE PAGO', margin + 6, currentY + 5);

      let payY = currentY + 20;
      const methods = [
        { label: 'Efectivo en Caja (Cash)', amount: data.paymentMethods['CASH'] || 0 },
        { label: 'Transferencia (SPEI)', amount: data.paymentMethods['TRANSFER'] || 0 },
        { label: 'Tarjeta / Terminal', amount: data.paymentMethods['CARD'] || 0 },
      ];
      for (const m of methods) {
        doc.rect(margin, payY, colWidthHalf, 16).fillAndStroke('#ffffff', '#f1f5f9');
        doc.fillColor('#334155').fontSize(7.5).font('Helvetica').text(m.label, margin + 6, payY + 4);
        doc.fillColor('#0f172a').font('Helvetica-Bold').text(`$${m.amount.toFixed(2)}`, margin + colWidthHalf - 50, payY + 4, {
          width: 44,
          align: 'right',
        });
        payY += 16;
      }

      // Columna Derecha: Ventas por Plan
      const colRightX = margin + colWidthHalf + 10;
      doc.rect(colRightX, currentY, colWidthHalf, 18).fill('#1e293b');
      doc.fillColor('#ffffff').fontSize(8.5).font('Helvetica-Bold').text('VENTAS POR PLAN', colRightX + 6, currentY + 5);

      let planY = currentY + 20;
      const topPlans = data.byPlan.slice(0, 3);
      if (topPlans.length === 0) {
        doc.rect(colRightX, planY, colWidthHalf, 16).fillAndStroke('#ffffff', '#f1f5f9');
        doc.fillColor('#94a3b8').fontSize(7.5).font('Helvetica').text('Sin planes registrados', colRightX + 6, planY + 4);
        planY += 16;
      } else {
        for (const p of topPlans) {
          doc.rect(colRightX, planY, colWidthHalf, 16).fillAndStroke('#ffffff', '#f1f5f9');
          doc.fillColor('#334155').fontSize(7.5).font('Helvetica').text(`${p.planName} (${p.tickets} vtas)`, colRightX + 6, planY + 4);
          doc.fillColor('#0f172a').font('Helvetica-Bold').text(`$${p.revenue.toFixed(2)}`, colRightX + colWidthHalf - 50, planY + 4, {
            width: 44,
            align: 'right',
          });
          planY += 16;
        }
      }

      currentY = Math.max(payY, planY) + 12;

      // 4. TABLA DE TRANSACCIONES DETALLADAS
      doc.rect(margin, currentY, contentWidth, 18).fill('#0f172a');
      doc.fillColor('#ffffff').fontSize(8.5).font('Helvetica-Bold').text('DETALLE DE OPERACIONES REGISTRADAS', margin + 6, currentY + 5);
      currentY += 18;

      // Cabecera de columnas
      doc.rect(margin, currentY, contentWidth, 14).fill('#e2e8f0');
      doc.fillColor('#475569').fontSize(7).font('Helvetica-Bold');
      doc.text('HORA', margin + 4, currentY + 3.5, { width: 35 });
      doc.text('ROUTER', margin + 42, currentY + 3.5, { width: 95 });
      doc.text('PLAN', margin + 140, currentY + 3.5, { width: 110 });
      doc.text('USUARIO / PIN', margin + 255, currentY + 3.5, { width: 85 });
      doc.text('MÉTODO', margin + 345, currentY + 3.5, { width: 65 });
      doc.text('VENDEDOR', margin + 415, currentY + 3.5, { width: 55 });
      doc.text('TOTAL', margin + 475, currentY + 3.5, { width: 44, align: 'right' });
      currentY += 14;

      const rowsToShow = data.transactions.slice(0, 24);
      let isEven = false;
      for (const t of rowsToShow) {
        // Salto de página si nos acercamos al final y dejamos espacio para firmas
        if (currentY > 680) {
          doc.addPage();
          currentY = margin;
          // Sub-cabecera repetida
          doc.rect(margin, currentY, contentWidth, 14).fill('#e2e8f0');
          doc.fillColor('#475569').fontSize(7).font('Helvetica-Bold');
          doc.text('HORA', margin + 4, currentY + 3.5, { width: 35 });
          doc.text('ROUTER', margin + 42, currentY + 3.5, { width: 95 });
          doc.text('PLAN', margin + 140, currentY + 3.5, { width: 110 });
          doc.text('USUARIO / PIN', margin + 255, currentY + 3.5, { width: 85 });
          doc.text('MÉTODO', margin + 345, currentY + 3.5, { width: 65 });
          doc.text('VENDEDOR', margin + 415, currentY + 3.5, { width: 55 });
          doc.text('TOTAL', margin + 475, currentY + 3.5, { width: 44, align: 'right' });
          currentY += 14;
        }

        const bg = isEven ? '#f8fafc' : '#ffffff';
        doc.rect(margin, currentY, contentWidth, 14).fillAndStroke(bg, '#f1f5f9');
        doc.fillColor('#334155').fontSize(7).font('Helvetica');
        doc.text(t.formattedTime || 'N/A', margin + 4, currentY + 3.5, { width: 35 });
        doc.text(t.routerName || 'MikroTik', margin + 42, currentY + 3.5, { width: 95 });
        doc.text(t.planName || 'Plan', margin + 140, currentY + 3.5, { width: 110 });
        doc.font('Helvetica-Bold').fillColor('#0284c7').text(t.username || 'N/A', margin + 255, currentY + 3.5, { width: 85 });
        doc.font('Helvetica').fillColor('#334155').text(t.paymentMethod || 'CASH', margin + 345, currentY + 3.5, { width: 65 });
        doc.text(t.vendor || 'Kiosco', margin + 415, currentY + 3.5, { width: 55 });
        doc.font('Helvetica-Bold').fillColor('#0f172a').text(`$${t.amount.toFixed(2)}`, margin + 475, currentY + 3.5, {
          width: 44,
          align: 'right',
        });

        currentY += 14;
        isEven = !isEven;
      }

      if (data.transactions.length === 0) {
        doc.rect(margin, currentY, contentWidth, 20).fillAndStroke('#ffffff', '#e2e8f0');
        doc.fillColor('#94a3b8').fontSize(8).font('Helvetica').text('No se registraron transacciones en este periodo.', margin + 10, currentY + 6);
        currentY += 20;
      }

      // 5. BLOQUE DE FIRMAS FORMALES DE ARQUEO
      const signaturesY = Math.max(currentY + 25, 720);
      const sigWidth = 190;

      // Firma Operador
      const sig1X = margin + 30;
      doc.moveTo(sig1X, signaturesY).lineTo(sig1X + sigWidth, signaturesY).strokeColor('#0f172a').lineWidth(1).stroke();
      doc.fillColor('#0f172a').fontSize(8).font('Helvetica-Bold').text('Firma del Operador / Cajero', sig1X, signaturesY + 4, {
        width: sigWidth,
        align: 'center',
      });
      doc.fillColor('#64748b').fontSize(7).font('Helvetica').text('Entregó Valores en Efectivo', sig1X, signaturesY + 14, {
        width: sigWidth,
        align: 'center',
      });

      // Firma Administrador
      const sig2X = pageWidth - margin - 30 - sigWidth;
      doc.moveTo(sig2X, signaturesY).lineTo(sig2X + sigWidth, signaturesY).strokeColor('#0f172a').lineWidth(1).stroke();
      doc.fillColor('#0f172a').fontSize(8).font('Helvetica-Bold').text('Firma del Administrador / Auditor', sig2X, signaturesY + 4, {
        width: sigWidth,
        align: 'center',
      });
      doc.fillColor('#64748b').fontSize(7).font('Helvetica').text('Recibió y Validó Arqueo Contable', sig2X, signaturesY + 14, {
        width: sigWidth,
        align: 'center',
      });

      // 6. PIE DE PÁGINA
      doc.fontSize(6.5).font('Helvetica').fillColor('#94a3b8').text(
        'Documento contable generado automáticamente por MikroFichas Hotspot System. Válido para arqueo diario.',
        margin,
        805,
        { width: contentWidth, align: 'center' }
      );

      doc.end();
    } catch (e) {
      reject(e);
    }
  });
}
