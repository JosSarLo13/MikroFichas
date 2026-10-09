package com.example.mikrofichas.util

import android.content.Context
import android.print.PrintAttributes
import android.print.PrintManager
import android.webkit.WebView
import android.webkit.WebViewClient
import com.example.mikrofichas.data.model.SaleResponse

object TicketPrintHelper {

    /**
     * Imprime una sola ficha térmica desde Android
     */
    /**
     * Imprime una sola ficha térmica desde Android
     */
    fun printSingleTicket(
        context: Context,
        sale: SaleResponse,
        brandName: String = "Fichas Sarmientos"
    ) {
        val qrBitmap = QrGenerator.generateQrBitmap(sale.qrData, 300, 300)
        val qrBase64 = qrBitmap?.let { QrGenerator.bitmapToBase64(it) } ?: ""

        val html = buildTicketHtml(
            brandName = brandName,
            planName = sale.planName,
            price = sale.price,
            duration = sale.durationFormatted,
            username = sale.pin,
            password = sale.password,
            qrBase64 = qrBase64
        )

        dispatchPrintJob(context, "Ficha_${sale.pin}", html)
    }

    /**
     * Imprime una tira continua de múltiples fichas generadas en lote
     */
    fun printBatchTickets(
        context: Context,
        planName: String,
        price: Double,
        duration: String,
        tickets: List<com.example.mikrofichas.data.model.TicketPinDto>,
        brandName: String = "Fichas Sarmientos"
    ) {
        val ticketsHtml = StringBuilder()

        for (t in tickets) {
            val u = t.username ?: t.pin
            val p = t.password ?: t.pin
            val qrData = "http://hotspot.local/login?username=$u&password=$p"
            val qrBitmap = QrGenerator.generateQrBitmap(qrData, 260, 260)
            val qrBase64 = qrBitmap?.let { QrGenerator.bitmapToBase64(it) } ?: ""

            val credBox = if (!t.password.isNullOrEmpty() && t.password != u) {
                """
                <div class="pin-box" style="padding: 4px;">
                    <div class="pin-title">CREDENCIALES DE ACCESO</div>
                    <table style="width: 100%; border-collapse: collapse; margin-top: 3px;">
                        <tr>
                            <td style="width: 50%; padding: 4px; border: 1px solid #000; text-align: center;">
                                <div style="font-size: 8px; color: #555;">USUARIO</div>
                                <div style="font-size: 16px; font-weight: 900;">$u</div>
                            </td>
                            <td style="width: 50%; padding: 4px; border: 1px solid #000; text-align: center;">
                                <div style="font-size: 8px; color: #555;">CONTRASEÑA</div>
                                <div style="font-size: 16px; font-weight: 900;">$p</div>
                            </td>
                        </tr>
                    </table>
                </div>
                """.trimIndent()
            } else {
                """
                <div class="pin-box">
                    <div class="pin-title">PIN DE ACCESO</div>
                    <div class="pin-code">$u</div>
                </div>
                """.trimIndent()
            }

            ticketsHtml.append(
                """
                <div class="ticket">
                    <div class="brand">📶 $brandName</div>
                    <div class="subtitle">INTERNET WI-FI POR TIEMPO</div>
                    
                    <div class="plan-box">
                        <div class="plan-name">$planName ($duration)</div>
                        <div class="plan-price">$${String.format("%.2f", price)} MXN</div>
                    </div>

                    ${if (qrBase64.isNotEmpty()) """<div class="qr-container"><img src="$qrBase64" class="qr-img"/><div class="qr-label">Escanea con tu cámara para conectar directo</div></div>""" else ""}

                    $credBox

                    <div class="instructions">
                        1. Conéctate a la red Wi-Fi.<br/>
                        2. Ingresa a: <strong>http://hotspot.local</strong><br/>
                        3. Escribe tus datos y pulsa Conectar.
                    </div>

                    <div class="footer">¡Gracias por su compra!</div>
                </div>
                """.trimIndent()
            )
        }

        val fullHtml = wrapInThermalDocument(ticketsHtml.toString())
        dispatchPrintJob(context, "Lote_${planName.replace(" ", "_")}", fullHtml)
    }

    private fun buildTicketHtml(
        brandName: String,
        planName: String,
        price: Double,
        duration: String,
        username: String,
        password: String?,
        qrBase64: String
    ): String {
        val credBox = if (!password.isNullOrEmpty() && password != username) {
            """
            <div class="pin-box" style="padding: 4px;">
                <div class="pin-title">CREDENCIALES DE ACCESO</div>
                <table style="width: 100%; border-collapse: collapse; margin-top: 3px;">
                    <tr>
                        <td style="width: 50%; padding: 4px; border: 1px solid #000; text-align: center;">
                            <div style="font-size: 8px; color: #555;">USUARIO</div>
                            <div style="font-size: 18px; font-weight: 900;">$username</div>
                        </td>
                        <td style="width: 50%; padding: 4px; border: 1px solid #000; text-align: center;">
                            <div style="font-size: 8px; color: #555;">CONTRASEÑA</div>
                            <div style="font-size: 18px; font-weight: 900;">$password</div>
                        </td>
                    </tr>
                </table>
            </div>
            """.trimIndent()
        } else {
            """
            <div class="pin-box">
                <div class="pin-title">PIN / CLAVE DE ACCESO</div>
                <div class="pin-code">$username</div>
            </div>
            """.trimIndent()
        }

        val body = """
            <div class="ticket">
                <div class="brand">📶 $brandName</div>
                <div class="subtitle">INTERNET WI-FI POR TIEMPO</div>

                <div class="plan-box">
                    <div class="plan-name">$planName ($duration)</div>
                    <div class="plan-price">$${String.format("%.2f", price)} MXN</div>
                </div>

                ${if (qrBase64.isNotEmpty()) """<div class="qr-container"><img src="$qrBase64" class="qr-img"/><div class="qr-label">Escanea con tu cámara para conectar directo</div></div>""" else ""}

                $credBox

                <div class="instructions">
                    1. Conéctate a la red Wi-Fi.<br/>
                    2. Ingresa a: <strong>http://hotspot.local</strong><br/>
                    3. Escribe tus datos y pulsa Conectar.
                </div>

                <div class="footer">¡Gracias por su preferencia!</div>
            </div>
        """.trimIndent()

        return wrapInThermalDocument(body)
    }

    private fun wrapInThermalDocument(content: String): String {
        return """
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8"/>
                <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
                <style>
                    body {
                        margin: 0;
                        padding: 0;
                        background: #ffffff;
                        color: #000000;
                        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Courier New", monospace;
                        font-size: 11px;
                        line-height: 1.25;
                    }
                    .ticket {
                        width: 54mm;
                        margin: 0 auto;
                        padding: 2mm;
                        border-bottom: 2px dashed #000000;
                        page-break-inside: avoid;
                        text-align: center;
                    }
                    .brand {
                        font-size: 13px;
                        font-weight: 900;
                        letter-spacing: 0.5px;
                        text-transform: uppercase;
                    }
                    .subtitle {
                        font-size: 8px;
                        letter-spacing: 1px;
                        margin-bottom: 4px;
                        color: #444444;
                    }
                    .plan-box {
                        border: 1px solid #000000;
                        border-radius: 4px;
                        padding: 4px;
                        margin: 4px 0;
                        background: #f7f7f7;
                    }
                    .plan-name {
                        font-weight: 800;
                        font-size: 11px;
                    }
                    .plan-price {
                        font-weight: 900;
                        font-size: 13px;
                    }
                    .qr-container {
                        margin: 4px 0;
                    }
                    .qr-img {
                        width: 32mm;
                        height: 32mm;
                        display: block;
                        margin: 0 auto;
                    }
                    .qr-label {
                        font-size: 8px;
                        color: #555555;
                        margin-top: 1px;
                    }
                    .pin-box {
                        border: 2px solid #000000;
                        border-radius: 4px;
                        padding: 4px;
                        margin: 4px 0;
                        background: #fcfcfc;
                    }
                    .pin-title {
                        font-size: 8px;
                        font-weight: 700;
                        letter-spacing: 1px;
                    }
                    .pin-code {
                        font-size: 18px;
                        font-weight: 900;
                        letter-spacing: 2px;
                        padding: 2px 0;
                        font-family: monospace;
                    }
                    .instructions {
                        text-align: left;
                        font-size: 8px;
                        border-top: 1px solid #cccccc;
                        padding-top: 4px;
                        margin-top: 4px;
                        color: #222222;
                    }
                    .footer {
                        font-size: 7px;
                        color: #666666;
                        margin-top: 4px;
                    }
                    @media print {
                        body { margin: 0; padding: 0; }
                        .ticket { page-break-inside: avoid; }
                    }
                </style>
            </head>
            <body>
                $content
            </body>
            </html>
        """.trimIndent()
    }

    private fun dispatchPrintJob(context: Context, jobName: String, html: String) {
        val webView = WebView(context)
        webView.webViewClient = object : WebViewClient() {
            override fun onPageFinished(view: WebView?, url: String?) {
                val printManager = context.getSystemService(Context.PRINT_SERVICE) as? PrintManager
                if (printManager != null) {
                    val printAdapter = webView.createPrintDocumentAdapter(jobName)
                    val printAttributes = PrintAttributes.Builder()
                        .setColorMode(PrintAttributes.COLOR_MODE_MONOCHROME)
                        .setMediaSize(PrintAttributes.MediaSize.ISO_A4)
                        .setMinMargins(PrintAttributes.Margins.NO_MARGINS)
                        .build()
                    printManager.print(jobName, printAdapter, printAttributes)
                }
            }
        }
        webView.loadDataWithBaseURL(null, html, "text/html", "UTF-8", null)
    }
}
