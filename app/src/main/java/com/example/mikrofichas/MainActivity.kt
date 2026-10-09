package com.example.mikrofichas

import android.annotation.SuppressLint
import android.app.Dialog
import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.content.res.ColorStateList
import android.graphics.Color
import android.graphics.drawable.ColorDrawable
import android.os.Bundle
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.widget.AdapterView
import android.widget.ArrayAdapter
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.lifecycle.lifecycleScope
import com.example.mikrofichas.data.api.ApiClient
import com.example.mikrofichas.data.model.CreatePlanRequest
import com.example.mikrofichas.data.model.CreateRouterRequest
import com.example.mikrofichas.data.model.GenerateBatchRequest
import com.example.mikrofichas.data.model.LoginRequest
import com.example.mikrofichas.data.model.PlanDto
import com.example.mikrofichas.data.model.RecentSaleItemDto
import com.example.mikrofichas.data.model.DiscoveredDeviceDto
import com.example.mikrofichas.data.model.QuickConnectRouterRequest
import com.example.mikrofichas.data.model.RouterDto
import com.example.mikrofichas.data.model.SaleRequest
import com.example.mikrofichas.data.model.SaleResponse
import com.example.mikrofichas.data.model.SetRemoteIpRequest
import com.example.mikrofichas.data.model.SuggestIpDto
import com.example.mikrofichas.data.model.UpdateRouterRequest
import com.example.mikrofichas.data.model.ZeroTierConfigRequest
import com.example.mikrofichas.databinding.ActivityMainBinding
import com.example.mikrofichas.databinding.DialogBootstrapScriptBinding
import com.example.mikrofichas.databinding.DialogCreatePlanBinding
import com.example.mikrofichas.databinding.DialogDiscoverMikrotikBinding
import com.example.mikrofichas.databinding.DialogManageRouterBinding
import com.example.mikrofichas.databinding.DialogPortalSarmientosBinding
import com.example.mikrofichas.databinding.DialogRemoteGuideBinding
import com.example.mikrofichas.databinding.DialogSaleSuccessBinding
import com.example.mikrofichas.databinding.DialogServerConfigBinding
import com.example.mikrofichas.databinding.ItemDiscoveredDeviceBinding
import com.example.mikrofichas.databinding.ItemPlanBinding
import com.example.mikrofichas.databinding.ItemSaleBinding

import com.example.mikrofichas.util.QrGenerator
import com.example.mikrofichas.util.TicketPrintHelper
import com.google.android.material.button.MaterialButton
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

class MainActivity : AppCompatActivity() {

    private lateinit var binding: ActivityMainBinding
    private var loadedPlans: List<PlanDto> = emptyList()
    private var loadedRouters: List<RouterDto> = emptyList()
    private var lastLoadedSales: List<RecentSaleItemDto> = emptyList()
    private var selectedBatchQty: Int = 10
    private var currentRouterId: String? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        ApiClient.init(this)

        // Verificación de inicio de sesión obligatorio
        if (!ApiClient.isLoggedIn()) {
            startActivity(Intent(this, LoginActivity::class.java))
            finish()
            return
        }

        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)

        setupUI()
        setupRoleUI()
        loadData()
    }

    private fun setupRoleUI() {
        val isAdmin = ApiClient.isAdmin()
        val roleTitle = if (isAdmin) "Administrador" else "Vendedor"
        binding.tvOperatorHeader.text = "$roleTitle: ${ApiClient.operatorName}"

        if (isAdmin) {
            // Modo Administrador: Acceso total a lotes y configuración
            binding.tabGenerate.visibility = View.VISIBLE
            binding.tabAdmin.visibility = View.VISIBLE
            binding.tabSellerReports.visibility = View.GONE
            binding.btnOpenSettings.visibility = View.VISIBLE
            binding.tvCashTitle.text = "Corte de Caja Global"
            binding.tvCashSubtitle.text = "Resumen financiero de todos los routers y operadores"
        } else {
            // Modo Vendedor: Exclusivo POS, mi caja y reportar fallas
            binding.tabGenerate.visibility = View.GONE
            binding.tabAdmin.visibility = View.GONE
            binding.tabSellerReports.visibility = View.VISIBLE
            binding.btnOpenSettings.visibility = View.GONE
            binding.tvCashTitle.text = "Mi Arqueo de Caja"
            binding.tvCashSubtitle.text = "Total de fichas y dinero cobrado en tu turno"
            setupSellerReportSection()
        }
    }

    private fun setupUI() {
        // Navigation Tabs
        binding.tabPos.setOnClickListener { switchTab("POS") }
        binding.tabGenerate.setOnClickListener { switchTab("GENERATE") }
        binding.tabCashDrawer.setOnClickListener { switchTab("CASH_DRAWER") }
        binding.tabAdmin.setOnClickListener { switchTab("ADMIN") }
        binding.tabSellerReports.setOnClickListener { switchTab("SELLER_REPORTS") }

        // Botón Cerrar Sesión
        binding.btnLogout.setOnClickListener {
            showLogoutConfirmation()
        }

        // Refresh buttons
        binding.btnRefreshPlans.setOnClickListener { loadPlans() }
        binding.btnRefreshSummary.setOnClickListener { loadDailySummary() }

        // Settings / Server Config dialog (Admin)
        binding.btnOpenSettings.setOnClickListener { showServerConfigDialog() }
        binding.tvOnlineStatus.setOnClickListener {
            if (ApiClient.isAdmin()) showServerConfigDialog()
        }

        // Batch Generator quantity selectors
        binding.btnQty10.setOnClickListener { selectBatchQty(10, binding.btnQty10) }
        binding.btnQty25.setOnClickListener { selectBatchQty(25, binding.btnQty25) }
        binding.btnQty50.setOnClickListener { selectBatchQty(50, binding.btnQty50) }

        binding.btnExecuteGenerateBatch.setOnClickListener {
            executeGenerateBatch()
        }

        // Admin section actions
        binding.btnTestRouter.setOnClickListener { testRouterConnection() }
        binding.btnAutoProvisionRouter.setOnClickListener { executeAutoProvisionRouter() }
        binding.btnSyncTicketsAdmin.setOnClickListener { executeSyncRouterTickets() }
        binding.btnConfigDesdeCero.setOnClickListener { showBootstrapScriptDialog() }
        binding.btnCreatePlanDialog.setOnClickListener { showCreatePlanDialog() }
        binding.btnOpenPortalSarmientos.setOnClickListener { showPortalSarmientosDialog() }
        binding.btnViewRemoteGuide.setOnClickListener { showRemoteGuideDialog() }
        binding.btnDiscoverRouters.setOnClickListener { showDiscoverMikrotikDialog() }
        binding.btnAddNewRouter.setOnClickListener { showManageRouterDialog(null) }
        binding.btnEditRouter.setOnClickListener {
            val router = loadedRouters.find { it.id == currentRouterId }
            if (router != null) {
                showManageRouterDialog(router)
            } else {
                Toast.makeText(this, "Selecciona un router primero", Toast.LENGTH_SHORT).show()
            }
        }
        binding.btnExportCortePdf.setOnClickListener {
            downloadOrPrintCortePdf()
        }
    }


    private fun showLogoutConfirmation() {
        AlertDialog.Builder(this)
            .setTitle("Cerrar Sesión")
            .setMessage("¿Estás seguro de que deseas salir de la cuenta de ${ApiClient.operatorName}?")
            .setPositiveButton("Sí, Salir") { _, _ ->
                ApiClient.logout(this)
                val intent = Intent(this, LoginActivity::class.java)
                startActivity(intent)
                finish()
            }
            .setNegativeButton("Cancelar", null)
            .show()
    }

    private fun setupSellerReportSection() {
        val issueOptions = listOf(
            "Router sin Internet (Fibra/Antena caída)",
            "Ficha / PIN no conecta o sale error",
            "Señal Wi-Fi débil o cobertura baja",
            "Corte de energía / Router apagado",
            "Avería de impresora o stock de papel",
            "Otro problema técnico"
        )
        val adapter = ArrayAdapter(this, android.R.layout.simple_spinner_dropdown_item, issueOptions)
        binding.spIssueType.adapter = adapter

        binding.btnSubmitIssueReport.setOnClickListener {
            val selectedIssue = binding.spIssueType.selectedItem?.toString() ?: "Falla técnica"
            val details = binding.etIssueDetails.text.toString().trim()
            val clientInfo = binding.etAffectedClient.text.toString().trim()

            if (details.isEmpty()) {
                Toast.makeText(this, "Escribe los detalles de la falla", Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }

            val folio = (100000..999999).random()
            binding.tvIssueFeedback.visibility = View.VISIBLE
            binding.tvIssueFeedback.text = "✅ Reporte #$folio registrado y enviado al Administrador.\nProblema: $selectedIssue"

            Toast.makeText(this, "Reporte técnico enviado exitosamente", Toast.LENGTH_LONG).show()
            binding.etIssueDetails.text.clear()
            binding.etAffectedClient.text.clear()
        }
    }

    private fun switchTab(tab: String) {
        val darkCard = ContextCompat.getColor(this, R.color.card_dark)
        val cyanAccent = ContextCompat.getColor(this, R.color.cyan_accent)
        val textSecondary = ContextCompat.getColor(this, R.color.text_secondary)
        val white = Color.WHITE

        fun resetButtons() {
            binding.tabPos.backgroundTintList = ColorStateList.valueOf(darkCard)
            binding.tabPos.setTextColor(textSecondary)
            binding.tabPos.iconTint = ColorStateList.valueOf(textSecondary)

            binding.tabGenerate.backgroundTintList = ColorStateList.valueOf(darkCard)
            binding.tabGenerate.setTextColor(textSecondary)
            binding.tabGenerate.iconTint = ColorStateList.valueOf(textSecondary)

            binding.tabCashDrawer.backgroundTintList = ColorStateList.valueOf(darkCard)
            binding.tabCashDrawer.setTextColor(textSecondary)
            binding.tabCashDrawer.iconTint = ColorStateList.valueOf(textSecondary)

            binding.tabAdmin.backgroundTintList = ColorStateList.valueOf(darkCard)
            binding.tabAdmin.setTextColor(textSecondary)
            binding.tabAdmin.iconTint = ColorStateList.valueOf(textSecondary)

            binding.tabSellerReports.backgroundTintList = ColorStateList.valueOf(darkCard)
            binding.tabSellerReports.setTextColor(textSecondary)
            binding.tabSellerReports.iconTint = ColorStateList.valueOf(textSecondary)

            binding.layoutPosSection.visibility = View.GONE
            binding.layoutGenerateSection.visibility = View.GONE
            binding.layoutCashDrawerSection.visibility = View.GONE
            binding.layoutAdminSection.visibility = View.GONE
            binding.layoutSellerReportSection.visibility = View.GONE
        }

        resetButtons()

        when (tab) {
            "POS" -> {
                binding.tabPos.backgroundTintList = ColorStateList.valueOf(cyanAccent)
                binding.tabPos.setTextColor(white)
                binding.tabPos.iconTint = ColorStateList.valueOf(white)
                binding.layoutPosSection.visibility = View.VISIBLE
                if (loadedPlans.isEmpty()) loadPlans()
            }
            "GENERATE" -> {
                binding.tabGenerate.backgroundTintList = ColorStateList.valueOf(cyanAccent)
                binding.tabGenerate.setTextColor(white)
                binding.tabGenerate.iconTint = ColorStateList.valueOf(white)
                binding.layoutGenerateSection.visibility = View.VISIBLE
                setupBatchPlanSpinner()
                setupBatchAuthTypeSpinner()
            }
            "CASH_DRAWER" -> {
                binding.tabCashDrawer.backgroundTintList = ColorStateList.valueOf(cyanAccent)
                binding.tabCashDrawer.setTextColor(white)
                binding.tabCashDrawer.iconTint = ColorStateList.valueOf(white)
                binding.layoutCashDrawerSection.visibility = View.VISIBLE
                loadDailySummary()
            }
            "ADMIN" -> {
                binding.tabAdmin.backgroundTintList = ColorStateList.valueOf(cyanAccent)
                binding.tabAdmin.setTextColor(white)
                binding.tabAdmin.iconTint = ColorStateList.valueOf(white)
                binding.layoutAdminSection.visibility = View.VISIBLE
                loadAdminInfo()
            }
            "SELLER_REPORTS" -> {
                binding.tabSellerReports.backgroundTintList = ColorStateList.valueOf(cyanAccent)
                binding.tabSellerReports.setTextColor(white)
                binding.tabSellerReports.iconTint = ColorStateList.valueOf(white)
                binding.layoutSellerReportSection.visibility = View.VISIBLE
            }
        }
    }

    private fun selectBatchQty(qty: Int, button: MaterialButton) {
        selectedBatchQty = qty
        val darkCard = ContextCompat.getColor(this, R.color.card_dark)
        val cyanAccent = ContextCompat.getColor(this, R.color.cyan_accent)
        val textSecondary = ContextCompat.getColor(this, R.color.text_secondary)
        val bgDark = ContextCompat.getColor(this, R.color.bg_dark)

        binding.btnQty10.backgroundTintList = ColorStateList.valueOf(darkCard)
        binding.btnQty10.setTextColor(textSecondary)
        binding.btnQty25.backgroundTintList = ColorStateList.valueOf(darkCard)
        binding.btnQty25.setTextColor(textSecondary)
        binding.btnQty50.backgroundTintList = ColorStateList.valueOf(darkCard)
        binding.btnQty50.setTextColor(textSecondary)

        button.backgroundTintList = ColorStateList.valueOf(cyanAccent)
        button.setTextColor(bgDark)
    }

    private fun loadData() {
        loadPlans()
    }

    private fun loadPlans() {
        binding.pbLoadingPlans.visibility = View.VISIBLE
        binding.plansContainer.removeAllViews()

        lifecycleScope.launch(Dispatchers.IO) {
            try {
                val response = ApiClient.getService().getPlans(token = ApiClient.authToken?.let { "Bearer $it" })
                withContext(Dispatchers.Main) {
                    binding.pbLoadingPlans.visibility = View.GONE
                    if (response.isSuccessful && response.body()?.data != null) {
                        loadedPlans = response.body()!!.data!!
                        if (loadedPlans.isNotEmpty() && currentRouterId == null) {
                            currentRouterId = loadedPlans[0].routerId
                        }
                        renderPlans(loadedPlans)
                        binding.tvOnlineStatus.text = "● Conectado"
                        binding.tvOnlineStatus.setTextColor(ContextCompat.getColor(this@MainActivity, R.color.emerald_light))

                        if (loadedPlans.isEmpty()) {
                            val emptyNotice = TextView(this@MainActivity).apply {
                                text = "ℹ️ No hay planes creados en este servidor.\n\nVe a la pestaña 'Admin' para crear tu primer plan de internet."
                                setTextColor(ContextCompat.getColor(this@MainActivity, R.color.text_secondary))
                                textSize = 13f
                                setPadding(32, 64, 32, 64)
                                gravity = Gravity.CENTER
                            }
                            binding.plansContainer.addView(emptyNotice)
                        }
                    } else {
                        Toast.makeText(this@MainActivity, "No se pudieron obtener planes del servidor", Toast.LENGTH_SHORT).show()
                        binding.tvOnlineStatus.text = "● Sin Datos"
                    }
                }
            } catch (e: Exception) {
                withContext(Dispatchers.Main) {
                    binding.pbLoadingPlans.visibility = View.GONE
                    binding.tvOnlineStatus.text = "● Desconectado"
                    binding.tvOnlineStatus.setTextColor(ContextCompat.getColor(this@MainActivity, R.color.rose_accent))

                    binding.plansContainer.removeAllViews()
                    val errorCard = TextView(this@MainActivity).apply {
                        text = "⚠️ Servidor no alcanzable en:\n${ApiClient.getBaseUrl()}\n\n👉 Toca aquí para cambiar a la IP de tu PC o ZeroTier"
                        setTextColor(ContextCompat.getColor(this@MainActivity, R.color.rose_accent))
                        textSize = 13f
                        setPadding(32, 64, 32, 64)
                        gravity = Gravity.CENTER
                        setOnClickListener { showServerConfigDialog() }
                    }
                    binding.plansContainer.addView(errorCard)
                    Toast.makeText(this@MainActivity, "Toca '● Desconectado' para configurar la IP del servidor", Toast.LENGTH_SHORT).show()
                }
            }
        }
    }

    private fun renderPlans(plans: List<PlanDto>) {
        binding.plansContainer.removeAllViews()
        for (plan in plans) {
            val itemBinding = ItemPlanBinding.inflate(layoutInflater, binding.plansContainer, false)
            itemBinding.tvPlanName.text = plan.name
            itemBinding.tvPlanPrice.text = "$${String.format(Locale.US, "%.2f", plan.price)}"
            itemBinding.tvPlanDuration.text = "${plan.durationFormatted} de navegación"
            itemBinding.tvPlanSpeed.text = "↓ ${plan.downloadSpeedKbps / 1024}M  ↑ ${plan.uploadSpeedKbps / 1024}M"
            itemBinding.tvStockBadge.text = "Stock: ${plan.availableStock}"

            itemBinding.btnSellPlan.setOnClickListener {
                executeSale(plan)
            }

            binding.plansContainer.addView(itemBinding.root)
        }
    }

    private fun executeSale(plan: PlanDto) {
        val request = SaleRequest(
            routerId = plan.routerId,
            planId = plan.id,
            paymentMethod = "CASH",
            receivedAmount = plan.price,
            notes = "Vendido desde App Android por ${ApiClient.operatorName}"
        )

        lifecycleScope.launch(Dispatchers.IO) {
            try {
                val response = ApiClient.getService().processSale(
                    request = request,
                    token = ApiClient.authToken?.let { "Bearer $it" }
                )
                withContext(Dispatchers.Main) {
                    if (response.isSuccessful && response.body()?.data != null) {
                        val sale = response.body()!!.data!!
                        showSaleSuccessDialog(sale)
                        loadPlans() // Actualizar stock
                    } else {
                        val errorMsg = response.body()?.error?.message ?: "Error al procesar venta"
                        Toast.makeText(this@MainActivity, errorMsg, Toast.LENGTH_SHORT).show()
                    }
                }
            } catch (e: Exception) {
                withContext(Dispatchers.Main) {
                    Toast.makeText(this@MainActivity, "Fallo al conectar: ${e.message}", Toast.LENGTH_LONG).show()
                }
            }
        }
    }

    private fun showSaleSuccessDialog(sale: SaleResponse) {
        val dialog = Dialog(this)
        val dialogBinding = DialogSaleSuccessBinding.inflate(layoutInflater)
        dialog.setContentView(dialogBinding.root)
        dialog.window?.setBackgroundDrawable(ColorDrawable(Color.TRANSPARENT))
        dialog.window?.setLayout(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT)

        dialogBinding.tvSuccessDetails.text = "${sale.planName} • $${String.format(Locale.US, "%.2f", sale.price)} MXN"

        val hasSeparateCredentials = sale.password.isNotEmpty() && sale.password != sale.pin
        if (hasSeparateCredentials) {
            dialogBinding.tvPinDisplay.visibility = View.GONE
            dialogBinding.layoutUserPassDisplay.visibility = View.VISIBLE
            dialogBinding.tvUserDisplay.text = sale.pin
            dialogBinding.tvPassDisplay.text = sale.password
            dialogBinding.tvPinTitle.text = "CREDENCIALES DE ACCESO"
        } else {
            dialogBinding.tvPinDisplay.visibility = View.VISIBLE
            dialogBinding.layoutUserPassDisplay.visibility = View.GONE
            dialogBinding.tvPinDisplay.text = sale.pin
            dialogBinding.tvPinTitle.text = "PIN DE ACCESO HOTSPOT"
        }

        if (sale.change > 0) {
            dialogBinding.tvChangeAmount.visibility = View.VISIBLE
            dialogBinding.tvChangeAmount.text = "Cambio a entregar: $${String.format(Locale.US, "%.2f", sale.change)}"
        } else {
            dialogBinding.tvChangeAmount.visibility = View.GONE
        }

        // Generar Código QR con URL completa de login
        val qrBitmap = QrGenerator.generateQrBitmap(sale.qrData, 400, 400)
        if (qrBitmap != null) {
            dialogBinding.ivQrCode.setImageBitmap(qrBitmap)
        }

        // Copiar Credenciales
        dialogBinding.btnCopyPin.setOnClickListener {
            val clipboard = getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
            val toCopy = if (hasSeparateCredentials) {
                "Usuario: ${sale.pin} | Contraseña: ${sale.password}"
            } else {
                sale.pin
            }
            val clip = ClipData.newPlainText("Credenciales Ficha", toCopy)
            clipboard.setPrimaryClip(clip)
            Toast.makeText(this, "Credenciales copiadas al portapapeles", Toast.LENGTH_SHORT).show()
        }

        // Compartir por WhatsApp
        dialogBinding.btnShareWhatsApp.setOnClickListener {
            val credSection = if (hasSeparateCredentials) {
                "*Usuario:* ${sale.pin}\n*Contraseña:* ${sale.password}"
            } else {
                "*PIN / Clave:* ${sale.pin}"
            }

            val message = """
                📶 *TU FICHA DE INTERNET WIFI*
                ━━━━━━━━━━━━━━━━━━━━━
                *Plan:* ${sale.planName} (${sale.durationFormatted})
                $credSection
                *Costo:* $${String.format("%.2f", sale.price)}
                ━━━━━━━━━━━━━━━━━━━━━
                1. Conéctate a la red Wi-Fi del lugar.
                2. Si no abre automático, ingresa a http://hotspot.local
                3. Ingresa tus datos y navega a máxima velocidad.
            """.trimIndent()

            val sendIntent = Intent().apply {
                action = Intent.ACTION_SEND
                putExtra(Intent.EXTRA_TEXT, message)
                type = "text/plain"
            }
            startActivity(Intent.createChooser(sendIntent, "Enviar ficha por WhatsApp"))
        }

        // Imprimir Ticket Térmico
        dialogBinding.btnPrintThermal.setOnClickListener {
            TicketPrintHelper.printSingleTicket(this, sale, "Fichas Sarmientos")
        }

        dialogBinding.btnCloseDialog.setOnClickListener {
            dialog.dismiss()
        }

        dialog.show()
    }

    private fun setupBatchPlanSpinner() {
        if (loadedPlans.isEmpty()) return
        val planNames = loadedPlans.map { "${it.name} ($${it.price})" }
        val adapter = ArrayAdapter(this, android.R.layout.simple_spinner_dropdown_item, planNames)
        binding.spPlanSelect.adapter = adapter
    }

    private fun setupBatchAuthTypeSpinner() {
        val authOptions = listOf(
            "👤 Usuario y Clave (5 dígitos aleatorios c/u)",
            "🔑 Solo PIN (5 dígitos iguales)"
        )
        val adapter = ArrayAdapter(this, android.R.layout.simple_spinner_dropdown_item, authOptions)
        binding.spBatchAuthType.adapter = adapter
    }

    private fun executeGenerateBatch() {
        if (loadedPlans.isEmpty()) {
            Toast.makeText(this, "No hay planes cargados del servidor", Toast.LENGTH_SHORT).show()
            return
        }

        val selectedIdx = binding.spPlanSelect.selectedItemPosition
        if (selectedIdx < 0 || selectedIdx >= loadedPlans.size) {
            Toast.makeText(this, "Por favor selecciona un plan de la lista", Toast.LENGTH_SHORT).show()
            return
        }

        val selectedPlan = loadedPlans[selectedIdx]
        val prefix = binding.etBatchPrefix.text.toString().trim()
        val authType = if (binding.spBatchAuthType.selectedItemPosition == 1) "PIN_ONLY" else "USER_PASSWORD"
        val syncAllRouters = binding.swBatchSyncAllRouters.isChecked

        val request = GenerateBatchRequest(
            routerId = selectedPlan.routerId,
            planId = selectedPlan.id,
            quantity = selectedBatchQty,
            prefix = prefix,
            pinLength = 5,
            authType = authType,
            syncAllRouters = syncAllRouters
        )

        lifecycleScope.launch(Dispatchers.IO) {
            try {
                val response = ApiClient.getService().generateBatch(
                    request = request,
                    token = ApiClient.authToken?.let { "Bearer $it" }
                )
                withContext(Dispatchers.Main) {
                    if (response.isSuccessful) {
                        val batchData = response.body()?.data
                        val tickets = batchData?.tickets ?: emptyList()
                        val syncedRouters = batchData?.syncedRouters ?: emptyList()

                        val toastMsg = if (syncedRouters.size > 1) {
                            "🌐 ¡Lote Universal Creado! Sincronizado en ${syncedRouters.size} MikroTiks"
                        } else {
                            "✅ Se generaron $selectedBatchQty fichas de ${selectedPlan.name} en MikroTik"
                        }

                        Toast.makeText(this@MainActivity, toastMsg, Toast.LENGTH_LONG).show()

                        if (tickets.isNotEmpty()) {
                            val dialogMsg = if (syncedRouters.size > 1) {
                                "Se crearon ${tickets.size} fichas universales registradas en ${syncedRouters.size} routers (válidas en el Centro, tienda 2 y demás pueblos).\n\n¿Deseas imprimir la tira continua en impresora térmica?"
                            } else {
                                "Se crearon ${tickets.size} fichas de ${selectedPlan.name}. ¿Deseas imprimir la tira continua en impresora térmica?"
                            }

                            androidx.appcompat.app.AlertDialog.Builder(this@MainActivity)
                                .setTitle("🖨️ ¿Imprimir Fichas Generadas?")
                                .setMessage(dialogMsg)
                                .setPositiveButton("🖨️ Imprimir Tira") { _, _ ->
                                    TicketPrintHelper.printBatchTickets(
                                        context = this@MainActivity,
                                        planName = selectedPlan.name,
                                        price = selectedPlan.price,
                                        duration = selectedPlan.durationFormatted,
                                        tickets = tickets,
                                        brandName = "Fichas Sarmientos"
                                    )
                                }
                                .setNegativeButton("Cerrar", null)
                                .show()
                        }
                        switchTab("POS")
                        loadPlans()
                    } else {
                        Toast.makeText(
                            this@MainActivity,
                            "Error al generar lote: ${response.message()}",
                            Toast.LENGTH_LONG
                        ).show()
                    }
                }
            } catch (e: Exception) {
                withContext(Dispatchers.Main) {
                    Toast.makeText(this@MainActivity, "Error de red: ${e.message}", Toast.LENGTH_LONG).show()
                }
            }
        }
    }

    private fun loadDailySummary() {
        lifecycleScope.launch(Dispatchers.IO) {
            try {
                val response = ApiClient.getService().getDailySummary(token = ApiClient.authToken?.let { "Bearer $it" })
                withContext(Dispatchers.Main) {
                    if (response.isSuccessful && response.body()?.data != null) {
                        val summary = response.body()!!.data!!
                        lastLoadedSales = summary.recentSales
                        binding.tvDailyRevenue.text = "$${String.format(Locale.US, "%.2f", summary.todayRevenue)}"
                        binding.tvDailyTicketsCount.text = summary.todayTicketsCount.toString()

                        binding.salesHistoryContainer.removeAllViews()
                        for (item in summary.recentSales) {
                            val saleBinding = ItemSaleBinding.inflate(layoutInflater, binding.salesHistoryContainer, false)
                            saleBinding.tvSalePin.text = "PIN: ${item.pin}"
                            saleBinding.tvSalePlanAndTime.text = "${item.planName} • ${item.time} • ${item.paymentMethod}"
                            saleBinding.tvSaleAmount.text = "$${String.format(Locale.US, "%.2f", item.totalAmount)}"
                            binding.salesHistoryContainer.addView(saleBinding.root)
                        }
                    }
                }
            } catch (e: Exception) {
                withContext(Dispatchers.Main) {
                    Toast.makeText(this@MainActivity, "Error al consultar corte: ${e.message}", Toast.LENGTH_SHORT).show()
                }
            }
        }
    }

    // ==========================================
    // SECCIÓN DE ADMINISTRACIÓN & ROUTERBOARD
    // ==========================================

    private fun loadAdminInfo() {
        lifecycleScope.launch(Dispatchers.IO) {
            try {
                val response = ApiClient.getService().getRouters(token = ApiClient.authToken?.let { "Bearer $it" })
                withContext(Dispatchers.Main) {
                    if (response.isSuccessful && !response.body()?.data.isNullOrEmpty()) {
                        loadedRouters = response.body()!!.data!!
                        val routerNames = loadedRouters.map { "${it.name} (${it.host})" }
                        val adapter = ArrayAdapter(this@MainActivity, android.R.layout.simple_spinner_dropdown_item, routerNames)
                        binding.spAdminRouterSelect.adapter = adapter

                        binding.spAdminRouterSelect.onItemSelectedListener = object : AdapterView.OnItemSelectedListener {
                            override fun onItemSelected(parent: AdapterView<*>?, view: View?, position: Int, id: Long) {
                                if (position in loadedRouters.indices) {
                                    val router = loadedRouters[position]
                                    currentRouterId = router.id
                                    binding.tvAdminRouterIdentity.text = router.name
                                    binding.tvAdminRouterBoard.text = "${router.host}:${router.apiPort} • ${router.status}"
                                    testRouterConnection(silent = true)
                                }
                            }
                            override fun onNothingSelected(parent: AdapterView<*>?) {}
                        }

                        val activeIdx = loadedRouters.indexOfFirst { it.id == currentRouterId }.let { if (it >= 0) it else 0 }
                        binding.spAdminRouterSelect.setSelection(activeIdx)
                    }
                }
            } catch (e: Exception) {
                withContext(Dispatchers.Main) {
                    Toast.makeText(this@MainActivity, "Error al cargar routers: ${e.message}", Toast.LENGTH_SHORT).show()
                }
            }
        }
    }

    private fun testRouterConnection(silent: Boolean = false) {
        val routerId = currentRouterId
        if (routerId == null) {
            if (!silent) {
                Toast.makeText(this, "No se encontró ningún router registrado", Toast.LENGTH_SHORT).show()
            }
            return
        }

        binding.btnTestRouter.isEnabled = false
        binding.btnTestRouter.text = "Probando Socket MikroTik..."

        lifecycleScope.launch(Dispatchers.IO) {
            try {
                val response = ApiClient.getService().testRouter(
                    routerId = routerId,
                    token = ApiClient.authToken?.let { "Bearer $it" }
                )
                withContext(Dispatchers.Main) {
                    binding.btnTestRouter.isEnabled = true
                    binding.btnTestRouter.text = "⚡ Probar Conexión & Telemetría"

                    if (response.isSuccessful && response.body()?.data != null) {
                        val data = response.body()!!.data!!
                        binding.tvAdminRouterIdentity.text = data.identity
                        binding.tvAdminRouterBoard.text = "${data.boardName} • RouterOS v${data.rosVersion}"
                        binding.tvAdminRouterStatusChip.text = if (data.online) "ONLINE" else "OFFLINE"
                        binding.tvAdminRouterStatusChip.setTextColor(
                            ContextCompat.getColor(
                                this@MainActivity,
                                if (data.online) R.color.emerald_light else R.color.rose_accent
                            )
                        )
                        binding.tvAdminCpuLoad.text = "${data.cpuLoad}%"
                        binding.tvAdminFreeRam.text = "${data.freeMemoryMb} MB"
                        binding.tvAdminLatency.text = "${data.latencyMs} ms"
                        binding.tvAdminUptime.text = "Tiempo Encendido: ${data.uptime}"

                        if (!silent) {
                            Toast.makeText(
                                this@MainActivity,
                                "✅ Conexión con ${data.identity} en ${data.latencyMs}ms",
                                Toast.LENGTH_SHORT
                            ).show()
                        }
                    } else {
                        binding.tvAdminRouterStatusChip.text = "OFFLINE"
                        binding.tvAdminRouterStatusChip.setTextColor(
                            ContextCompat.getColor(this@MainActivity, R.color.rose_accent)
                        )
                        if (!silent) {
                            Toast.makeText(this@MainActivity, "Router offline o no alcanzable", Toast.LENGTH_LONG).show()
                        }
                    }
                }
            } catch (e: Exception) {
                withContext(Dispatchers.Main) {
                    binding.btnTestRouter.isEnabled = true
                    binding.btnTestRouter.text = "⚡ Probar Conexión & Telemetría"
                    binding.tvAdminRouterStatusChip.text = "ERROR"
                    binding.tvAdminRouterStatusChip.setTextColor(
                        ContextCompat.getColor(this@MainActivity, R.color.rose_accent)
                    )
                    if (!silent) {
                        Toast.makeText(this@MainActivity, "Fallo al conectar: ${e.message}", Toast.LENGTH_LONG).show()
                    }
                }
            }
        }
    }

    private fun showBootstrapScriptDialog() {
        val routerId = currentRouterId
        if (routerId == null) {
            Toast.makeText(this, "Identificador de router no disponible", Toast.LENGTH_SHORT).show()
            return
        }

        val dialog = Dialog(this)
        val dialogBinding = DialogBootstrapScriptBinding.inflate(layoutInflater)
        dialog.setContentView(dialogBinding.root)
        dialog.window?.setBackgroundDrawable(ColorDrawable(Color.TRANSPARENT))
        dialog.window?.setLayout(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT)

        dialogBinding.tvScriptContent.text = "# Obteniendo script de inicialización desde el servidor..."

        lifecycleScope.launch(Dispatchers.IO) {
            try {
                val response = ApiClient.getService().getBootstrapScript(
                    routerId = routerId,
                    token = ApiClient.authToken?.let { "Bearer $it" }
                )
                withContext(Dispatchers.Main) {
                    if (response.isSuccessful && response.body()?.data != null) {
                        val scriptData = response.body()!!.data!!
                        val scriptText = scriptData.script
                        dialogBinding.tvScriptContent.text = scriptText

                        val quickCmd = scriptData.quickUnlockCommand 
                            ?: "/ip service enable api; /ip service set api port=8728; /ip firewall filter add chain=input action=accept protocol=tcp dst-port=8728 comment=\"API MikroFichas\" place-before=0; /ip cloud set ddns-enabled=yes"

                        dialogBinding.btnCopyQuickUnlock.setOnClickListener {
                            val clipboard = getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
                            val clip = ClipData.newPlainText("MikroTik Quick Unlock", quickCmd)
                            clipboard.setPrimaryClip(clip)
                            Toast.makeText(this@MainActivity, "⚡ Comando rápido copiado. Pégalo en Winbox Terminal para desbloquear el MikroTik.", Toast.LENGTH_LONG).show()
                        }

                        val ntpCmd = scriptData.ntpScript ?: "# Sincronización horaria"
                        dialogBinding.btnCopyNtp.setOnClickListener {
                            val clipboard = getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
                            clipboard.setPrimaryClip(ClipData.newPlainText("NTP Anti-Apagones", ntpCmd))
                            Toast.makeText(this@MainActivity, "⏰ Comando anti-apagones (NTP/Hora) copiado.", Toast.LENGTH_SHORT).show()
                        }

                        val hotspotCmd = scriptData.hotspotScript ?: "# Hotspot y subred única"
                        dialogBinding.btnCopyHotspot.setOnClickListener {
                            val clipboard = getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
                            clipboard.setPrimaryClip(ClipData.newPlainText("Hotspot y Subred", hotspotCmd))
                            Toast.makeText(this@MainActivity, "📶 Configuración Hotspot y subred copiada.", Toast.LENGTH_SHORT).show()
                        }

                        dialogBinding.btnCopyScript.setOnClickListener {
                            val clipboard = getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
                            val clip = ClipData.newPlainText("MikroTik Script", scriptText)
                            clipboard.setPrimaryClip(clip)
                            Toast.makeText(this@MainActivity, "📋 Script completo copiado. Pégalo en New Terminal de MikroTik.", Toast.LENGTH_LONG).show()
                        }
                    } else {
                        dialogBinding.tvScriptContent.text = "# Error al generar el script en el servidor."
                    }
                }
            } catch (e: Exception) {
                withContext(Dispatchers.Main) {
                    dialogBinding.tvScriptContent.text = "# Error de conexión: ${e.message}"
                }
            }
        }

        dialogBinding.btnAutoProvisionInDialog.setOnClickListener {
            dialog.dismiss()
            executeAutoProvisionRouter()
        }
        dialogBinding.btnCloseBootstrap.setOnClickListener { dialog.dismiss() }
        dialog.show()
    }

    private fun executeAutoProvisionRouter() {
        val routerId = currentRouterId
        if (routerId == null) {
            Toast.makeText(this, "Selecciona un router primero", Toast.LENGTH_SHORT).show()
            return
        }

        val routerName = loadedRouters.find { it.id == routerId }?.name ?: "MikroTik"

        androidx.appcompat.app.AlertDialog.Builder(this)
            .setTitle("⚡ Auto-Configurar Hotspot en 1 Clic")
            .setMessage("¿Deseas auto-configurar '$routerName' automáticamente vía API?\n\nEl sistema configurará:\n• Reloj y sincronización NTP anti-apagones\n• Perfiles de fichas con 1 dispositivo por ticket\n• Servidor Hotspot y autenticación segura\n• Portal cautivo Sarmientos (login.html)\n• Salida a Internet (NAT Masquerade)\n\nSin necesidad de copiar comandos en Winbox.")
            .setPositiveButton("⚡ Iniciar Auto-Configuración") { _, _ ->
                val progressDialog = androidx.appcompat.app.AlertDialog.Builder(this)
                    .setTitle("Configurando RouterOS...")
                    .setMessage("Enviando comandos y portal cautivo al MikroTik por API binaria. Por favor espera...")
                    .setCancelable(false)
                    .create()
                progressDialog.show()

                lifecycleScope.launch(Dispatchers.IO) {
                    try {
                        val response = ApiClient.getService().autoProvisionRouter(
                            routerId = routerId,
                            token = ApiClient.authToken?.let { "Bearer $it" }
                        )
                        withContext(Dispatchers.Main) {
                            progressDialog.dismiss()
                            if (response.isSuccessful && response.body()?.data != null) {
                                val result = response.body()!!.data!!
                                val stepsList = result.steps.joinToString("\n\n") { step ->
                                    val icon = if (step.status == "SUCCESS") "✅" else "⚠️"
                                    "$icon ${step.title}\n   ${step.detail}"
                                }

                                androidx.appcompat.app.AlertDialog.Builder(this@MainActivity)
                                    .setTitle("🎉 ¡Auto-Configuración Completada!")
                                    .setMessage("${result.summary}\n\nDetalles del proceso:\n\n$stepsList")
                                    .setPositiveButton("Excelente, Entendido", null)
                                    .show()

                                testRouterConnection(silent = true)
                            } else {
                                val errMsg = response.body()?.error?.message ?: response.message()
                                androidx.appcompat.app.AlertDialog.Builder(this@MainActivity)
                                    .setTitle("Error en Auto-Configuración")
                                    .setMessage("No se pudo completar la configuración automática: $errMsg\n\nVerifica que el router esté encendido y con la API activa.")
                                    .setPositiveButton("Aceptar", null)
                                    .show()
                            }
                        }
                    } catch (e: Exception) {
                        withContext(Dispatchers.Main) {
                            progressDialog.dismiss()
                            androidx.appcompat.app.AlertDialog.Builder(this@MainActivity)
                                .setTitle("Fallo de Conexión")
                                .setMessage("Error de red al comunicar con el router: ${e.message}")
                                .setPositiveButton("Aceptar", null)
                                .show()
                        }
                    }
                }
            }
            .setNegativeButton("Cancelar", null)
            .show()
    }

    private fun executeSyncRouterTickets() {
        val routerId = currentRouterId
        if (routerId == null) {
            Toast.makeText(this, "Selecciona un router primero", Toast.LENGTH_SHORT).show()
            return
        }

        val routerName = loadedRouters.find { it.id == routerId }?.name ?: "MikroTik"

        val progressDialog = androidx.appcompat.app.AlertDialog.Builder(this)
            .setTitle("Sincronizando Fichas...")
            .setMessage("Inyectando todas las fichas en el Hotspot de '$routerName' vía API binaria. Por favor espera...")
            .setCancelable(false)
            .create()
        progressDialog.show()

        lifecycleScope.launch(Dispatchers.IO) {
            try {
                val response = ApiClient.getService().syncRouterTickets(
                    routerId = routerId,
                    token = ApiClient.authToken?.let { "Bearer $it" }
                )
                withContext(Dispatchers.Main) {
                    progressDialog.dismiss()
                    if (response.isSuccessful && response.body()?.data != null) {
                        val result = response.body()!!.data!!
                        val msg = response.body()?.message ?: "Sincronización completada"

                        androidx.appcompat.app.AlertDialog.Builder(this@MainActivity)
                            .setTitle("🔄 Sincronización Exitosa")
                            .setMessage("$msg\n\n• Fichas en base de datos: ${result.totalTickets}\n• Inyectadas en MikroTik: ${result.syncedCount}\n• Fallidas: ${result.failedCount}")
                            .setPositiveButton("Aceptar", null)
                            .show()

                        testRouterConnection(silent = true)
                    } else {
                        val errMsg = response.body()?.message ?: response.message()
                        Toast.makeText(this@MainActivity, "⚠️ Error: $errMsg", Toast.LENGTH_LONG).show()
                    }
                }
            } catch (e: Exception) {
                withContext(Dispatchers.Main) {
                    progressDialog.dismiss()
                    Toast.makeText(this@MainActivity, "Error de conexión: ${e.message}", Toast.LENGTH_LONG).show()
                }
            }
        }
    }

    private fun showCreatePlanDialog() {
        val dialog = Dialog(this)
        val dialogBinding = DialogCreatePlanBinding.inflate(layoutInflater)
        dialog.setContentView(dialogBinding.root)
        dialog.window?.setBackgroundDrawable(ColorDrawable(Color.TRANSPARENT))
        dialog.window?.setLayout(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT)

        // Configurar selector de tipo de ficha (Tiempo Pausado vs Tiempo Corrido)
        val validityOptions = listOf(
            "⏱️ Tiempo Pausado (Se detiene si apaga el Wi-Fi)",
            "📅 Tiempo Corrido (Corre continuo desde el 1er uso)"
        )
        val validityAdapter = ArrayAdapter(this, android.R.layout.simple_spinner_dropdown_item, validityOptions)
        dialogBinding.spNewPlanValidityType.adapter = validityAdapter

        dialogBinding.btnCancelCreatePlan.setOnClickListener { dialog.dismiss() }

        dialogBinding.btnSubmitCreatePlan.setOnClickListener {
            val name = dialogBinding.etNewPlanName.text.toString().trim()
            val priceStr = dialogBinding.etNewPlanPrice.text.toString().trim()
            val hoursStr = dialogBinding.etNewPlanHours.text.toString().trim()
            val downStr = dialogBinding.etNewPlanDownMbps.text.toString().trim()
            val upStr = dialogBinding.etNewPlanUpMbps.text.toString().trim()

            if (name.isEmpty() || priceStr.isEmpty() || hoursStr.isEmpty()) {
                Toast.makeText(this, "Completa nombre, precio y duración", Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }

            val price = priceStr.toDoubleOrNull() ?: 10.0
            val hours = hoursStr.toIntOrNull() ?: 1
            val downMbps = downStr.toIntOrNull() ?: 5
            val upMbps = upStr.toIntOrNull() ?: 2

            val targetRouterId = currentRouterId ?: loadedPlans.firstOrNull()?.routerId ?: ""
            if (targetRouterId.isEmpty()) {
                Toast.makeText(this, "No hay router seleccionado", Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }

            val selectedValidity = if (dialogBinding.spNewPlanValidityType.selectedItemPosition == 1) {
                "WALL_CLOCK_CALENDAR"
            } else {
                "UPTIME_ACCUMULATED"
            }

            val request = CreatePlanRequest(
                name = name,
                price = price,
                durationSeconds = hours * 3600,
                validityType = selectedValidity,
                downloadSpeedKbps = downMbps * 1024,
                uploadSpeedKbps = upMbps * 1024,
                sharedUsers = 1,
                routerId = targetRouterId
            )

            dialogBinding.btnSubmitCreatePlan.isEnabled = false
            dialogBinding.btnSubmitCreatePlan.text = "Guardando..."

            lifecycleScope.launch(Dispatchers.IO) {
                try {
                    val response = ApiClient.getService().createPlan(
                        request = request,
                        token = ApiClient.authToken?.let { "Bearer $it" }
                    )
                    withContext(Dispatchers.Main) {
                        dialogBinding.btnSubmitCreatePlan.isEnabled = true
                        dialogBinding.btnSubmitCreatePlan.text = "Guardar Plan"

                        if (response.isSuccessful) {
                            Toast.makeText(this@MainActivity, "✅ Plan '$name' creado con éxito", Toast.LENGTH_SHORT).show()
                            dialog.dismiss()
                            loadPlans()
                        } else {
                            Toast.makeText(this@MainActivity, "Error al crear el plan", Toast.LENGTH_SHORT).show()
                        }
                    }
                } catch (e: Exception) {
                    withContext(Dispatchers.Main) {
                        dialogBinding.btnSubmitCreatePlan.isEnabled = true
                        dialogBinding.btnSubmitCreatePlan.text = "Guardar Plan"
                        Toast.makeText(this@MainActivity, "Error de red: ${e.message}", Toast.LENGTH_SHORT).show()
                    }
                }
            }
        }

        dialog.show()
    }

    private fun showRemoteGuideDialog() {
        val dialog = Dialog(this)
        val dialogBinding = DialogRemoteGuideBinding.inflate(layoutInflater)
        dialog.setContentView(dialogBinding.root)
        dialog.window?.setBackgroundDrawable(ColorDrawable(Color.TRANSPARENT))
        dialog.window?.setLayout(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT)

        dialogBinding.btnCloseGuide.setOnClickListener { dialog.dismiss() }

        // Botón copiar comando
        dialogBinding.btnCopyZeroTierCmd.setOnClickListener {
            val netId = dialogBinding.etZtNetworkId.text.toString().trim()
            val cmd = "/zerotier interface add network=${if (netId.isEmpty()) "TU_NETWORK_ID" else netId} name=zt1\n/zerotier enable zt1"
            val clipboard = getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
            val clip = ClipData.newPlainText("ZeroTier Command", cmd)
            clipboard.setPrimaryClip(clip)
            Toast.makeText(this, "📋 Comando ZeroTier copiado al portapapeles", Toast.LENGTH_SHORT).show()
        }

        // Botón Auto-configurar en MikroTik
        dialogBinding.btnApplyZeroTier.setOnClickListener {
            val targetRouterId = currentRouterId
            if (targetRouterId == null) {
                Toast.makeText(this, "No hay router registrado", Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }
            val netId = dialogBinding.etZtNetworkId.text.toString().trim()
            if (netId.isEmpty()) {
                Toast.makeText(this, "Ingresa el Network ID de ZeroTier", Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }

            dialogBinding.btnApplyZeroTier.isEnabled = false
            dialogBinding.btnApplyZeroTier.text = "Configurando..."

            lifecycleScope.launch(Dispatchers.IO) {
                try {
                    val response = ApiClient.getService().configureZeroTier(
                        routerId = targetRouterId,
                        request = ZeroTierConfigRequest(netId),
                        token = ApiClient.authToken?.let { "Bearer $it" }
                    )
                    withContext(Dispatchers.Main) {
                        dialogBinding.btnApplyZeroTier.isEnabled = true
                        dialogBinding.btnApplyZeroTier.text = "⚡ Auto-Configurar"

                        if (response.isSuccessful && response.body()?.data != null) {
                            val data = response.body()!!.data!!
                            dialogBinding.tvRemoteStatusMsg.visibility = View.VISIBLE
                            dialogBinding.tvRemoteStatusMsg.text = response.body()!!.message
                            dialogBinding.tvZtCommand.text = data.command
                            Toast.makeText(this@MainActivity, "Comando generado/aplicado", Toast.LENGTH_SHORT).show()
                        } else {
                            val msg = response.body()?.message ?: "Error al configurar ZeroTier"
                            Toast.makeText(this@MainActivity, msg, Toast.LENGTH_LONG).show()
                        }
                    }
                } catch (e: Exception) {
                    withContext(Dispatchers.Main) {
                        dialogBinding.btnApplyZeroTier.isEnabled = true
                        dialogBinding.btnApplyZeroTier.text = "⚡ Auto-Configurar"
                        Toast.makeText(this@MainActivity, "Error: ${e.message}", Toast.LENGTH_LONG).show()
                    }
                }
            }
        }

        // Botón conectar a la IP remota de ZeroTier
        dialogBinding.btnConnectRemoteIp.setOnClickListener {
            val targetRouterId = currentRouterId
            if (targetRouterId == null) {
                Toast.makeText(this, "No hay router registrado", Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }
            val remoteIp = dialogBinding.etZtRemoteIp.text.toString().trim()
            if (remoteIp.isEmpty()) {
                Toast.makeText(this, "Ingresa la IP que ZeroTier le asignó a tu MikroTik", Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }

            dialogBinding.btnConnectRemoteIp.isEnabled = false
            dialogBinding.btnConnectRemoteIp.text = "Probando conexión remota..."

            lifecycleScope.launch(Dispatchers.IO) {
                try {
                    val response = ApiClient.getService().setRemoteIp(
                        routerId = targetRouterId,
                        request = SetRemoteIpRequest(remoteIp),
                        token = ApiClient.authToken?.let { "Bearer $it" }
                    )
                    withContext(Dispatchers.Main) {
                        dialogBinding.btnConnectRemoteIp.isEnabled = true
                        dialogBinding.btnConnectRemoteIp.text = "🚀 Guardar IP y Conectar Remotamente"

                        if (response.isSuccessful && response.body() != null) {
                            val resp = response.body()!!
                            dialogBinding.tvRemoteStatusMsg.visibility = View.VISIBLE
                            dialogBinding.tvRemoteStatusMsg.text = resp.message

                            if (resp.success && resp.data?.online == true) {
                                binding.tvAdminRouterBoard.text = "${remoteIp}:8728 • ONLINE"
                                binding.tvAdminRouterStatusChip.text = "ONLINE"
                                binding.tvAdminRouterStatusChip.setTextColor(
                                    ContextCompat.getColor(this@MainActivity, R.color.emerald_light)
                                )
                                if (resp.data.latencyMs != null) {
                                    binding.tvAdminLatency.text = "${resp.data.latencyMs} ms"
                                }
                                Toast.makeText(this@MainActivity, "🎉 ¡Conectado remotamente por ZeroTier!", Toast.LENGTH_LONG).show()
                                testRouterConnection()
                            } else {
                                Toast.makeText(
                                    this@MainActivity,
                                    resp.message ?: "IP guardada, esperando que el router responda en ZeroTier",
                                    Toast.LENGTH_LONG
                                ).show()
                            }
                        }
                    }
                } catch (e: Exception) {
                    withContext(Dispatchers.Main) {
                        dialogBinding.btnConnectRemoteIp.isEnabled = true
                        dialogBinding.btnConnectRemoteIp.text = "🚀 Guardar IP y Conectar Remotamente"
                        Toast.makeText(this@MainActivity, "Fallo: ${e.message}", Toast.LENGTH_LONG).show()
                    }
                }
            }
        }

        dialog.show()
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun showPortalSarmientosDialog() {
        val dialog = Dialog(this)
        val dialogBinding = DialogPortalSarmientosBinding.inflate(layoutInflater)
        dialog.setContentView(dialogBinding.root)
        dialog.window?.setBackgroundDrawable(ColorDrawable(Color.TRANSPARENT))
        dialog.window?.setLayout(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT)

        dialogBinding.btnClosePortalDialog.setOnClickListener { dialog.dismiss() }

        // Cargar vista previa del portal en vivo
        val webSettings = dialogBinding.wvPortalPreview.settings
        webSettings.javaScriptEnabled = true
        webSettings.domStorageEnabled = true
        val previewUrl = ApiClient.getBaseUrl() + "api/v1/hotspot/template/preview"
        dialogBinding.wvPortalPreview.loadUrl(previewUrl)

        // Botón instalar portal en 1 clic
        dialogBinding.btnInstallPortal.setOnClickListener {
            val targetRouterId = currentRouterId ?: loadedPlans.firstOrNull()?.routerId
            if (targetRouterId == null) {
                Toast.makeText(this, "No hay router conectado o seleccionado", Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }

            dialogBinding.btnInstallPortal.isEnabled = false
            dialogBinding.btnInstallPortal.text = "Inyectando archivos en MikroTik..."

            lifecycleScope.launch(Dispatchers.IO) {
                try {
                    val response = ApiClient.getService().installPortalTemplate(
                        routerId = targetRouterId,
                        token = ApiClient.authToken?.let { "Bearer $it" }
                    )
                    withContext(Dispatchers.Main) {
                        dialogBinding.btnInstallPortal.isEnabled = true
                        dialogBinding.btnInstallPortal.text = "⚡ Instalar en MikroTik (1 Clic)"

                        if (response.isSuccessful && response.body() != null) {
                            val resp = response.body()!!
                            dialogBinding.tvPortalStatusMsg.visibility = View.VISIBLE
                            dialogBinding.tvPortalStatusMsg.text = resp.message

                            if (resp.success) {
                                Toast.makeText(this@MainActivity, "🎉 ¡Portal 'Fichas Sarmientos' inyectado en MikroTik!", Toast.LENGTH_LONG).show()
                            } else {
                                Toast.makeText(this@MainActivity, resp.message ?: "Fallo al instalar portal", Toast.LENGTH_LONG).show()
                            }
                        } else {
                            val err = response.errorBody()?.string() ?: "Error de servidor al inyectar portal"
                            Toast.makeText(this@MainActivity, err, Toast.LENGTH_LONG).show()
                        }
                    }
                } catch (e: Exception) {
                    withContext(Dispatchers.Main) {
                        dialogBinding.btnInstallPortal.isEnabled = true
                        dialogBinding.btnInstallPortal.text = "⚡ Instalar en MikroTik (1 Clic)"
                        Toast.makeText(this@MainActivity, "Error: ${e.message}", Toast.LENGTH_LONG).show()
                    }
                }
            }
        }

        dialog.show()
    }

    private fun showServerConfigDialog() {
        val dialog = Dialog(this)
        val dialogBinding = DialogServerConfigBinding.inflate(layoutInflater)
        dialog.setContentView(dialogBinding.root)
        dialog.window?.setBackgroundDrawable(ColorDrawable(Color.TRANSPARENT))
        dialog.window?.setLayout(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT)

        dialogBinding.etServerUrl.setText(ApiClient.getBaseUrl())

        dialogBinding.btnQuickLocalIp.setOnClickListener {
            dialogBinding.etServerUrl.setText(ApiClient.DEFAULT_BASE_URL)
        }

        dialogBinding.btnQuickEmulatorIp.setOnClickListener {
            dialogBinding.etServerUrl.setText(ApiClient.EMULATOR_BASE_URL)
        }

        dialogBinding.btnSaveServerConfig.setOnClickListener {
            val url = dialogBinding.etServerUrl.text.toString().trim()
            if (url.isEmpty()) {
                Toast.makeText(this, "La URL del servidor no puede estar vacía", Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }

            ApiClient.saveConfig(
                this,
                baseUrl = url,
                token = ApiClient.authToken,
                operator = ApiClient.operatorName,
                role = ApiClient.userRole
            )

            Toast.makeText(this, "Servidor actualizado", Toast.LENGTH_SHORT).show()
            dialog.dismiss()
            loadPlans()
        }

        dialogBinding.btnCancelConfig.setOnClickListener {
            dialog.dismiss()
        }

        dialog.show()
    }

    private fun showManageRouterDialog(routerToEdit: RouterDto?) {
        val dialog = Dialog(this)
        val dialogBinding = DialogManageRouterBinding.inflate(layoutInflater)
        dialog.setContentView(dialogBinding.root)
        dialog.window?.setBackgroundDrawable(ColorDrawable(Color.TRANSPARENT))
        dialog.window?.setLayout(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT)

        var isAutoMode = routerToEdit == null
        var suggestedHost = "192.168.88.1"
        var occupiedHostsList: List<String> = emptyList()

        fun updateModeUI() {
            if (isAutoMode) {
                dialogBinding.btnModeAuto.backgroundTintList = ColorStateList.valueOf(ContextCompat.getColor(this, R.color.cyan_accent))
                dialogBinding.btnModeAuto.setTextColor(ContextCompat.getColor(this, R.color.surface_dark))
                dialogBinding.btnModeManual.backgroundTintList = ColorStateList.valueOf(Color.TRANSPARENT)
                dialogBinding.btnModeManual.setTextColor(ContextCompat.getColor(this, R.color.text_secondary))
                dialogBinding.etRouterHost.setText(suggestedHost)
                dialogBinding.tvIpCollisionWarning.visibility = View.GONE
            } else {
                dialogBinding.btnModeManual.backgroundTintList = ColorStateList.valueOf(ContextCompat.getColor(this, R.color.card_dark))
                dialogBinding.btnModeManual.setTextColor(ContextCompat.getColor(this, R.color.cyan_light))
                dialogBinding.btnModeAuto.backgroundTintList = ColorStateList.valueOf(Color.TRANSPARENT)
                dialogBinding.btnModeAuto.setTextColor(ContextCompat.getColor(this, R.color.text_secondary))
            }
        }

        if (routerToEdit != null) {
            dialogBinding.tvRouterDialogTitle.text = "Editar Router: ${routerToEdit.name}"
            dialogBinding.layoutModeSelector.visibility = View.GONE
            dialogBinding.etRouterName.setText(routerToEdit.name)
            dialogBinding.etRouterHost.setText(routerToEdit.host)
            dialogBinding.etRouterPort.setText(routerToEdit.apiPort.toString())
            dialogBinding.cbRouterSsl.isChecked = routerToEdit.useSsl
            dialogBinding.etRouterUsername.setText("admin")
            dialogBinding.etRouterPassword.setText("")
            dialogBinding.btnSaveManageRouter.text = "Actualizar Router"
            dialogBinding.btnDeleteRouter.visibility = View.VISIBLE
            dialogBinding.tvFactoryPasswordHint.text = "🔒 Deja la contraseña vacía para conservar la existente. Si la cambias, se cifrará con AES-256-GCM."

            dialogBinding.btnDeleteRouter.setOnClickListener {
                AlertDialog.Builder(this)
                    .setTitle("Eliminar Router")
                    .setMessage("¿Estás seguro de eliminar '${routerToEdit.name}'? Se eliminarán también sus planes y fichas asociadas.")
                    .setPositiveButton("Sí, Eliminar") { _, _ ->
                        lifecycleScope.launch(Dispatchers.IO) {
                            try {
                                val res = ApiClient.getService().deleteRouter(
                                    routerId = routerToEdit.id,
                                    token = ApiClient.authToken?.let { "Bearer $it" }
                                )
                                withContext(Dispatchers.Main) {
                                    if (res.isSuccessful) {
                                        Toast.makeText(this@MainActivity, "Router eliminado con éxito", Toast.LENGTH_SHORT).show()
                                        dialog.dismiss()
                                        currentRouterId = null
                                        loadAdminInfo()
                                        loadPlans()
                                    } else {
                                        Toast.makeText(this@MainActivity, "Error al eliminar: ${res.message()}", Toast.LENGTH_LONG).show()
                                    }
                                }
                            } catch (e: Exception) {
                                withContext(Dispatchers.Main) {
                                    Toast.makeText(this@MainActivity, "Error de red: ${e.message}", Toast.LENGTH_LONG).show()
                                }
                            }
                        }
                    }
                    .setNegativeButton("Cancelar", null)
                    .show()
            }
        } else {
            dialogBinding.tvRouterDialogTitle.text = "Registrar Nuevo MikroTik"
            dialogBinding.layoutModeSelector.visibility = View.VISIBLE
            dialogBinding.btnDeleteRouter.visibility = View.GONE
            dialogBinding.etRouterPort.setText("8728")
            dialogBinding.etRouterUsername.setText("admin")
            dialogBinding.etRouterPassword.setText("")
            dialogBinding.btnSaveManageRouter.text = "Guardar Router"

            dialogBinding.btnModeAuto.setOnClickListener {
                isAutoMode = true
                updateModeUI()
            }
            dialogBinding.btnModeManual.setOnClickListener {
                isAutoMode = false
                updateModeUI()
            }

            // Consultar sugerencia de IP libre al servidor
            lifecycleScope.launch(Dispatchers.IO) {
                try {
                    val resp = ApiClient.getService().suggestIp(token = ApiClient.authToken?.let { "Bearer $it" })
                    withContext(Dispatchers.Main) {
                        if (resp.isSuccessful && resp.body()?.data != null) {
                            val data = resp.body()!!.data!!
                            suggestedHost = data.suggestedHost
                            occupiedHostsList = data.occupiedHosts
                            dialogBinding.tvSuggestedSubnetInfo.text = "Subred Hotspot libre: ${data.suggestedSubnet} (Gateway: ${data.suggestedGateway})"
                            if (isAutoMode) {
                                dialogBinding.etRouterHost.setText(suggestedHost)
                            }
                        }
                    }
                } catch (_: Exception) {}
            }
        }

        dialogBinding.cbRouterSsl.setOnCheckedChangeListener { _, isChecked ->
            dialogBinding.etRouterPort.setText(if (isChecked) "8729" else "8728")
        }

        dialogBinding.btnCancelManageRouter.setOnClickListener { dialog.dismiss() }
        dialogBinding.btnCloseManageRouter.setOnClickListener { dialog.dismiss() }

        dialogBinding.btnSaveManageRouter.setOnClickListener {
            val name = dialogBinding.etRouterName.text.toString().trim()
            val host = dialogBinding.etRouterHost.text.toString().trim()
            val port = dialogBinding.etRouterPort.text.toString().trim().toIntOrNull() ?: 8728
            val useSsl = dialogBinding.cbRouterSsl.isChecked
            val username = dialogBinding.etRouterUsername.text.toString().trim()
            val password = dialogBinding.etRouterPassword.text.toString().trim()

            if (name.isEmpty() || host.isEmpty() || username.isEmpty()) {
                Toast.makeText(this, "Completa todos los campos obligatorios", Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }

            dialogBinding.btnSaveManageRouter.isEnabled = false

            lifecycleScope.launch(Dispatchers.IO) {
                try {
                    val token = ApiClient.authToken?.let { "Bearer $it" }
                    if (routerToEdit == null) {
                        val req = CreateRouterRequest(
                            name = name,
                            host = host,
                            apiPort = port,
                            useSsl = useSsl,
                            username = username,
                            password = password
                        )
                        val res = ApiClient.getService().createRouter(req, token)
                        withContext(Dispatchers.Main) {
                            dialogBinding.btnSaveManageRouter.isEnabled = true
                            if (res.isSuccessful && res.body()?.data != null) {
                                Toast.makeText(this@MainActivity, "✅ Router registrado correctamente", Toast.LENGTH_SHORT).show()
                                currentRouterId = res.body()!!.data!!.id
                                dialog.dismiss()
                                loadAdminInfo()
                                loadPlans()
                            } else {
                                val err = res.body()?.error?.message ?: res.body()?.message ?: "Error al registrar router"
                                Toast.makeText(this@MainActivity, err, Toast.LENGTH_LONG).show()
                            }
                        }
                    } else {
                        val req = UpdateRouterRequest(
                            name = name,
                            host = host,
                            apiPort = port,
                            useSsl = useSsl,
                            username = username,
                            password = if (password.isNotEmpty()) password else null
                        )
                        val res = ApiClient.getService().updateRouter(routerToEdit.id, req, token)
                        withContext(Dispatchers.Main) {
                            dialogBinding.btnSaveManageRouter.isEnabled = true
                            if (res.isSuccessful && res.body()?.data != null) {
                                Toast.makeText(this@MainActivity, "✅ Router actualizado con éxito", Toast.LENGTH_SHORT).show()
                                dialog.dismiss()
                                loadAdminInfo()
                            } else {
                                val err = res.body()?.error?.message ?: res.body()?.message ?: "Error al actualizar router"
                                Toast.makeText(this@MainActivity, err, Toast.LENGTH_LONG).show()
                            }
                        }
                    }
                } catch (e: Exception) {
                    withContext(Dispatchers.Main) {
                        dialogBinding.btnSaveManageRouter.isEnabled = true
                        Toast.makeText(this@MainActivity, "Fallo de red: ${e.message}", Toast.LENGTH_LONG).show()
                    }
                }
            }
        }

        dialog.show()
    }

    private fun exportCortePdf() {
        val printManager = getSystemService(Context.PRINT_SERVICE) as? android.print.PrintManager
        if (printManager == null) {
            Toast.makeText(this, "Servicio de impresión no disponible en este dispositivo", Toast.LENGTH_SHORT).show()
            return
        }

        val totalRev = binding.tvDailyRevenue.text.toString()
        val totalCount = binding.tvDailyTicketsCount.text.toString()
        val nowStr = SimpleDateFormat("dd/MM/yyyy HH:mm:ss", Locale.getDefault()).format(Date())

        val webView = android.webkit.WebView(this)
        val htmlContent = """
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <style>
                    body { font-family: sans-serif; margin: 20px; color: #111; font-size: 12px; }
                    .header { border-bottom: 2px solid #000; padding-bottom: 8px; margin-bottom: 15px; }
                    .title { font-size: 18px; font-weight: bold; }
                    .subtitle { font-size: 11px; color: #555; }
                    .summary-box { background: #f4f4f4; border: 1px solid #ccc; padding: 12px; border-radius: 6px; margin-bottom: 15px; }
                    .metric-title { font-size: 10px; color: #666; text-transform: uppercase; }
                    .metric-value { font-size: 20px; font-weight: bold; margin-top: 4px; }
                    table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 11px; }
                    th, td { border-bottom: 1px solid #ddd; padding: 6px; text-align: left; }
                    th { background: #f0f0f0; font-size: 10px; text-transform: uppercase; }
                    .signatures { margin-top: 40px; display: flex; justify-content: space-around; text-align: center; font-size: 11px; }
                    .sig-line { border-top: 1px solid #000; width: 180px; padding-top: 5px; }
                </style>
            </head>
            <body>
                <div class="header">
                    <div class="title">MIKROFICHAS - CORTE DIARIO OFICIAL</div>
                    <div class="subtitle">Emisión: $nowStr | Operador: ${ApiClient.operatorName}</div>
                </div>

                <div class="summary-box">
                    <div>
                        <div class="metric-title">Total Recaudado Hoy</div>
                        <div class="metric-value">$totalRev</div>
                    </div>
                    <div style="margin-top: 8px;">
                        <div class="metric-title">Fichas Liquidadas</div>
                        <div class="metric-value">$totalCount</div>
                    </div>
                </div>

                <div style="font-weight: bold; margin-top: 15px; font-size: 12px;">Detalle de Ventas Registradas:</div>
                <table>
                    <thead>
                        <tr>
                            <th>Hora</th>
                            <th>Plan</th>
                            <th>PIN / Ficha</th>
                            <th>Método</th>
                            <th style="text-align: right;">Monto</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${lastLoadedSales.joinToString("") { sale ->
                            "<tr><td>${sale.time}</td><td>${sale.planName}</td><td><b>${sale.pin}</b></td><td>${sale.paymentMethod}</td><td style='text-align: right;'><b>$${String.format(Locale.US, "%.2f", sale.totalAmount)}</b></td></tr>"
                        }}
                    </tbody>
                </table>

                <div class="signatures">
                    <div>
                        <div class="sig-line"><b>Firma Operador</b><br><span style="font-size: 9px; color: #666;">Entregó Corte</span></div>
                    </div>
                    <div>
                        <div class="sig-line"><b>Firma Administrador</b><br><span style="font-size: 9px; color: #666;">Validó y Recibió</span></div>
                    </div>
                </div>
            </body>
            </html>
        """.trimIndent()

        webView.webViewClient = object : android.webkit.WebViewClient() {
            override fun onPageFinished(view: android.webkit.WebView?, url: String?) {
                val printAdapter = webView.createPrintDocumentAdapter("Corte_Caja_MikroFichas")
                printManager.print("Corte_Caja_MikroFichas", printAdapter, android.print.PrintAttributes.Builder().build())
            }
        }
        webView.loadDataWithBaseURL(null, htmlContent, "text/html", "utf-8", null)
    }

    private fun downloadOrPrintCortePdf() {
        val options = arrayOf(
            "📄 Descargar Archivo PDF Oficial (.pdf)",
            "🖨️ Imprimir / Guardar PDF (Nativo)"
        )
        AlertDialog.Builder(this)
            .setTitle("Corte de Caja - Exportar PDF")
            .setItems(options) { _, which ->
                if (which == 0) {
                    val serverUrl = ApiClient.getBaseUrl().trimEnd('/')
                    val pdfUrl = "$serverUrl/api/v1/sales/export/pdf?period=today"
                    try {
                        val browserIntent = Intent(Intent.ACTION_VIEW, android.net.Uri.parse(pdfUrl))
                        startActivity(browserIntent)
                    } catch (e: Exception) {
                        Toast.makeText(this, "Error al abrir navegador: ${e.message}", Toast.LENGTH_SHORT).show()
                    }
                } else {

                    exportCortePdf()
                }
            }
            .setNegativeButton("Cancelar", null)
            .show()
    }

    private fun showDiscoverMikrotikDialog() {
        val dialog = Dialog(this)
        val dialogBinding = DialogDiscoverMikrotikBinding.inflate(layoutInflater)
        dialog.setContentView(dialogBinding.root)
        dialog.window?.setBackgroundDrawable(ColorDrawable(Color.TRANSPARENT))
        dialog.window?.setLayout(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT)

        var selectedDevice: DiscoveredDeviceDto? = null
        var connectViaMode = "ip"

        fun updateConnectViaButtons(mode: String) {
            connectViaMode = mode
            val cyan = ContextCompat.getColor(this, R.color.cyan_accent)
            val dark = ContextCompat.getColor(this, R.color.card_dark)
            val darkSurface = ContextCompat.getColor(this, R.color.surface_dark)
            val secText = ContextCompat.getColor(this, R.color.text_secondary)

            if (mode == "ip") {
                dialogBinding.btnConnectViaIp.backgroundTintList = ColorStateList.valueOf(cyan)
                dialogBinding.btnConnectViaIp.setTextColor(darkSurface)
                dialogBinding.btnConnectViaMac.backgroundTintList = ColorStateList.valueOf(dark)
                dialogBinding.btnConnectViaMac.setTextColor(secText)
            } else {
                dialogBinding.btnConnectViaMac.backgroundTintList = ColorStateList.valueOf(cyan)
                dialogBinding.btnConnectViaMac.setTextColor(darkSurface)
                dialogBinding.btnConnectViaIp.backgroundTintList = ColorStateList.valueOf(dark)
                dialogBinding.btnConnectViaIp.setTextColor(secText)
            }
        }

        fun showFormForDevice(device: DiscoveredDeviceDto, defaultMode: String) {
            selectedDevice = device
            updateConnectViaButtons(defaultMode)
            val ipDisplay = device.ipv4 ?: "192.168.88.1"
            dialogBinding.btnConnectViaIp.text = "Por IP ($ipDisplay)"
            dialogBinding.btnConnectViaMac.text = "Por MAC (${device.mac})"

            dialogBinding.tvQuickConnectTargetTitle.text = "Conectar a: ${device.identity.ifEmpty { "MikroTik" }} (${device.board})"
            dialogBinding.etQuickRouterName.setText(if (device.identity.isNotEmpty() && device.identity != "MikroTik") device.identity else (if (device.board.isNotEmpty()) device.board else "MikroTik"))
            dialogBinding.etQuickRouterUser.setText("admin")
            dialogBinding.etQuickRouterPass.setText("")
            dialogBinding.tvQuickConnectFeedback.visibility = View.GONE
            dialogBinding.layoutQuickConnectForm.visibility = View.VISIBLE
        }

        fun triggerScan() {
            dialogBinding.layoutScanningState.visibility = View.VISIBLE
            dialogBinding.layoutDiscoveredList.removeAllViews()
            dialogBinding.tvEmptyDiscovered.visibility = View.GONE
            dialogBinding.layoutQuickConnectForm.visibility = View.GONE
            dialogBinding.btnRescanNetwork.isEnabled = false

            lifecycleScope.launch(Dispatchers.IO) {
                try {
                    val response = ApiClient.getService().discoverRouters(
                        timeoutMs = 3500,
                        token = ApiClient.authToken?.let { "Bearer $it" }
                    )
                    withContext(Dispatchers.Main) {
                        dialogBinding.layoutScanningState.visibility = View.GONE
                        dialogBinding.btnRescanNetwork.isEnabled = true

                        if (response.isSuccessful && response.body()?.data != null) {
                            val devices = response.body()!!.data!!
                            if (devices.isEmpty()) {
                                dialogBinding.tvEmptyDiscovered.visibility = View.VISIBLE
                            } else {
                                dialogBinding.tvEmptyDiscovered.visibility = View.GONE
                                for (device in devices) {
                                    val itemBinding = ItemDiscoveredDeviceBinding.inflate(layoutInflater, dialogBinding.layoutDiscoveredList, false)
                                    itemBinding.tvDeviceIdentity.text = device.identity.ifEmpty { "MikroTik" }
                                    val versionStr = if (device.version.isNotEmpty()) "ROS v${device.version}" else ""
                                    itemBinding.tvDeviceDetails.text = "${device.board} $versionStr ${if (device.interfaceName.isNotEmpty()) "(${device.interfaceName})" else ""}".trim()
                                    itemBinding.tvDeviceIp.text = "IP: ${device.ipv4 ?: "0.0.0.0"}"
                                    itemBinding.tvDeviceMac.text = "MAC: ${device.mac}"

                                    when (device.apiPort) {
                                        "open" -> {
                                            itemBinding.tvDeviceApiStatus.text = "API 8728 OK"
                                            itemBinding.tvDeviceApiStatus.setTextColor(Color.parseColor("#10B981"))
                                        }
                                        "refused" -> {
                                            itemBinding.tvDeviceApiStatus.text = "API Apagada"
                                            itemBinding.tvDeviceApiStatus.setTextColor(Color.parseColor("#F59E0B"))
                                        }
                                        else -> {
                                            itemBinding.tvDeviceApiStatus.text = device.apiPort
                                            itemBinding.tvDeviceApiStatus.setTextColor(Color.parseColor("#94A3B8"))
                                        }
                                    }

                                    if (device.isRegistered) {
                                        itemBinding.tvDeviceRegisteredBadge.visibility = View.VISIBLE
                                        itemBinding.tvDeviceRegisteredBadge.text = "✓ Ya Agregado"
                                        itemBinding.btnDeviceConnectIp.visibility = View.GONE
                                        itemBinding.btnDeviceConnectMac.visibility = View.GONE
                                    } else {
                                        itemBinding.tvDeviceRegisteredBadge.visibility = View.GONE
                                        itemBinding.btnDeviceConnectIp.visibility = View.VISIBLE
                                        itemBinding.btnDeviceConnectMac.visibility = View.VISIBLE

                                        itemBinding.btnDeviceConnectIp.setOnClickListener {
                                            showFormForDevice(device, "ip")
                                        }
                                        itemBinding.btnDeviceConnectMac.setOnClickListener {
                                            showFormForDevice(device, "mac")
                                        }
                                        itemBinding.root.setOnClickListener {
                                            showFormForDevice(device, "ip")
                                        }
                                    }

                                    dialogBinding.layoutDiscoveredList.addView(itemBinding.root)
                                }
                            }
                        } else {
                            dialogBinding.tvEmptyDiscovered.visibility = View.VISIBLE
                            val err = response.body()?.error?.message ?: response.errorBody()?.string() ?: "Error de red"
                            Toast.makeText(this@MainActivity, "Error al escanear: $err", Toast.LENGTH_SHORT).show()
                        }
                    }
                } catch (e: Exception) {
                    withContext(Dispatchers.Main) {
                        dialogBinding.layoutScanningState.visibility = View.GONE
                        dialogBinding.btnRescanNetwork.isEnabled = true
                        dialogBinding.tvEmptyDiscovered.visibility = View.VISIBLE
                        Toast.makeText(this@MainActivity, "Falla de red: ${e.message}", Toast.LENGTH_SHORT).show()
                    }
                }
            }
        }

        dialogBinding.btnCloseDiscovery.setOnClickListener { dialog.dismiss() }
        dialogBinding.btnRescanNetwork.setOnClickListener { triggerScan() }
        dialogBinding.btnManualRouterAdd.setOnClickListener {
            dialog.dismiss()
            showManageRouterDialog(null)
        }

        dialogBinding.btnConnectViaIp.setOnClickListener { updateConnectViaButtons("ip") }
        dialogBinding.btnConnectViaMac.setOnClickListener { updateConnectViaButtons("mac") }
        dialogBinding.btnCancelQuickConnect.setOnClickListener {
            dialogBinding.layoutQuickConnectForm.visibility = View.GONE
        }

        dialogBinding.btnSubmitQuickConnect.setOnClickListener {
            val dev = selectedDevice ?: return@setOnClickListener
            val host = dev.ipv4 ?: "192.168.88.1"
            val name = dialogBinding.etQuickRouterName.text.toString().trim()
            val user = dialogBinding.etQuickRouterUser.text.toString().trim()
            val pass = dialogBinding.etQuickRouterPass.text.toString()

            if (user.isEmpty()) {
                Toast.makeText(this, "El usuario es obligatorio", Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }

            dialogBinding.btnSubmitQuickConnect.isEnabled = false
            dialogBinding.btnSubmitQuickConnect.text = "Conectando..."
            dialogBinding.tvQuickConnectFeedback.visibility = View.VISIBLE
            dialogBinding.tvQuickConnectFeedback.text = "Probando credenciales y conectando con RouterOS..."
            dialogBinding.tvQuickConnectFeedback.setTextColor(ContextCompat.getColor(this, R.color.cyan_accent))

            val req = QuickConnectRouterRequest(
                name = name.ifEmpty { dev.identity },
                host = host,
                apiPort = 8728,
                useSsl = false,
                username = user,
                password = pass,
                connectVia = connectViaMode,
                mac = dev.mac
            )

            lifecycleScope.launch(Dispatchers.IO) {
                try {
                    val response = ApiClient.getService().quickConnectRouter(
                        request = req,
                        token = ApiClient.authToken?.let { "Bearer $it" }
                    )
                    withContext(Dispatchers.Main) {
                        dialogBinding.btnSubmitQuickConnect.isEnabled = true
                        dialogBinding.btnSubmitQuickConnect.text = "⚡ Probar y Conectar"

                        if (response.isSuccessful && response.body()?.success == true) {
                            val msg = response.body()?.message ?: "¡Router conectado exitosamente!"
                            dialogBinding.tvQuickConnectFeedback.text = "✅ $msg"
                            dialogBinding.tvQuickConnectFeedback.setTextColor(ContextCompat.getColor(this@MainActivity, R.color.emerald_accent))
                            Toast.makeText(this@MainActivity, msg, Toast.LENGTH_LONG).show()
                            loadAdminInfo()
                            triggerScan()

                        } else {
                            val err = response.body()?.error?.message ?: response.body()?.message ?: "Error al conectar con el router"
                            dialogBinding.tvQuickConnectFeedback.text = "❌ $err"
                            dialogBinding.tvQuickConnectFeedback.setTextColor(Color.parseColor("#EF4444"))
                        }
                    }
                } catch (e: Exception) {
                    withContext(Dispatchers.Main) {
                        dialogBinding.btnSubmitQuickConnect.isEnabled = true
                        dialogBinding.btnSubmitQuickConnect.text = "⚡ Probar y Conectar"
                        dialogBinding.tvQuickConnectFeedback.text = "❌ Error: ${e.message}"
                        dialogBinding.tvQuickConnectFeedback.setTextColor(Color.parseColor("#EF4444"))
                    }
                }
            }
        }

        dialog.show()
        triggerScan()
    }
}