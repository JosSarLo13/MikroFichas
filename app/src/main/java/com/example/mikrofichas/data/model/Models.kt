package com.example.mikrofichas.data.model

import com.google.gson.annotations.SerializedName

data class ApiResponse<T>(
    @SerializedName("success") val success: Boolean,
    @SerializedName("data") val data: T?,
    @SerializedName("message") val message: String?,
    @SerializedName("error") val error: ApiError?
)

data class ApiError(
    @SerializedName("code") val code: String,
    @SerializedName("message") val message: String?
)

data class LoginRequest(
    @SerializedName("username") val username: String,
    @SerializedName("password") val password: String
)

data class LoginResponse(
    @SerializedName("token") val token: String,
    @SerializedName("user") val user: UserDto,
    @SerializedName("expiresIn") val expiresIn: Long
)

data class UserDto(
    @SerializedName("id") val id: String,
    @SerializedName("username") val username: String,
    @SerializedName("email") val email: String,
    @SerializedName("role") val role: String
)

data class RouterDto(
    @SerializedName("id") val id: String,
    @SerializedName("name") val name: String,
    @SerializedName("host") val host: String,
    @SerializedName("apiPort") val apiPort: Int,
    @SerializedName("useSsl") val useSsl: Boolean,
    @SerializedName("status") val status: String
)

data class PlanDto(
    @SerializedName("id") val id: String,
    @SerializedName("name") val name: String,
    @SerializedName("price") val price: Double,
    @SerializedName("durationSeconds") val durationSeconds: Int,
    @SerializedName("durationFormatted") val durationFormatted: String,
    @SerializedName("downloadSpeedKbps") val downloadSpeedKbps: Int,
    @SerializedName("uploadSpeedKbps") val uploadSpeedKbps: Int,
    @SerializedName("routerId") val routerId: String,
    @SerializedName("routerName") val routerName: String,
    @SerializedName("availableStock") val availableStock: Int
)

data class SaleRequest(
    @SerializedName("routerId") val routerId: String,
    @SerializedName("planId") val planId: String,
    @SerializedName("paymentMethod") val paymentMethod: String = "CASH",
    @SerializedName("receivedAmount") val receivedAmount: Double? = null,
    @SerializedName("notes") val notes: String? = null
)

data class SaleResponse(
    @SerializedName("saleId") val saleId: String,
    @SerializedName("pin") val pin: String,
    @SerializedName("password") val password: String,
    @SerializedName("planName") val planName: String,
    @SerializedName("price") val price: Double,
    @SerializedName("durationFormatted") val durationFormatted: String,
    @SerializedName("routerName") val routerName: String,
    @SerializedName("paymentMethod") val paymentMethod: String,
    @SerializedName("change") val change: Double,
    @SerializedName("qrData") val qrData: String,
    @SerializedName("soldAt") val soldAt: String
)

data class DailySalesSummaryDto(
    @SerializedName("todayRevenue") val todayRevenue: Double,
    @SerializedName("todayTicketsCount") val todayTicketsCount: Int,
    @SerializedName("salesCount") val salesCount: Int,
    @SerializedName("recentSales") val recentSales: List<RecentSaleItemDto>
)

data class RecentSaleItemDto(
    @SerializedName("id") val id: String,
    @SerializedName("totalAmount") val totalAmount: Double,
    @SerializedName("paymentMethod") val paymentMethod: String,
    @SerializedName("time") val time: String,
    @SerializedName("pin") val pin: String,
    @SerializedName("planName") val planName: String
)

data class GenerateBatchRequest(
    @SerializedName("routerId") val routerId: String,
    @SerializedName("planId") val planId: String,
    @SerializedName("quantity") val quantity: Int,
    @SerializedName("prefix") val prefix: String = "",
    @SerializedName("pinLength") val pinLength: Int = 5,
    @SerializedName("authType") val authType: String = "USER_PASSWORD",
    @SerializedName("syncAllRouters") val syncAllRouters: Boolean = true
)

data class TicketPinDto(
    @SerializedName("pin") val pin: String,
    @SerializedName("username") val username: String? = null,
    @SerializedName("password") val password: String? = null
)

data class GenerateBatchResponse(
    @SerializedName("quantity") val quantity: Int,
    @SerializedName("planName") val planName: String,
    @SerializedName("price") val price: Double,
    @SerializedName("durationSeconds") val durationSeconds: Int? = null,
    @SerializedName("syncedRouters") val syncedRouters: List<String>? = null,
    @SerializedName("targetRoutersCount") val targetRoutersCount: Int? = null,
    @SerializedName("tickets") val tickets: List<TicketPinDto>? = null
)

data class SyncTicketsResponse(
    @SerializedName("totalTickets") val totalTickets: Int,
    @SerializedName("syncedCount") val syncedCount: Int,
    @SerializedName("failedCount") val failedCount: Int
)

data class RouterTestResultDto(
    @SerializedName("online") val online: Boolean,
    @SerializedName("latencyMs") val latencyMs: Long,
    @SerializedName("identity") val identity: String,
    @SerializedName("rosVersion") val rosVersion: String,
    @SerializedName("boardName") val boardName: String,
    @SerializedName("cpuLoad") val cpuLoad: Int,
    @SerializedName("freeMemoryMb") val freeMemoryMb: Int,
    @SerializedName("totalMemoryMb") val totalMemoryMb: Int? = null,
    @SerializedName("uptime") val uptime: String
)

data class ProvisionStepDto(
    @SerializedName("id") val id: String,
    @SerializedName("title") val title: String,
    @SerializedName("description") val description: String,
    @SerializedName("status") val status: String,
    @SerializedName("detail") val detail: String
)

data class AutoProvisionResponseDto(
    @SerializedName("success") val success: Boolean,
    @SerializedName("summary") val summary: String,
    @SerializedName("steps") val steps: List<ProvisionStepDto>
)

data class RouterTelemetryDto(
    @SerializedName("online") val online: Boolean,
    @SerializedName("latencyMs") val latencyMs: Long,
    @SerializedName("identity") val identity: String,
    @SerializedName("rosVersion") val rosVersion: String,
    @SerializedName("boardName") val boardName: String,
    @SerializedName("architecture") val architecture: String? = null,
    @SerializedName("cpuLoad") val cpuLoad: Int,
    @SerializedName("freeMemoryMb") val freeMemoryMb: Int,
    @SerializedName("totalMemoryMb") val totalMemoryMb: Int = 32,
    @SerializedName("memoryUsedPercent") val memoryUsedPercent: Int? = null,
    @SerializedName("uptime") val uptime: String,
    @SerializedName("activeHotspotCount") val activeHotspotCount: Int? = null,
    @SerializedName("hotspotUsersCount") val hotspotUsersCount: Int? = null,
    @SerializedName("hotspotServerConfigured") val hotspotServerConfigured: Boolean? = null,
    @SerializedName("lanIp") val lanIp: String? = null
)

data class CreatePlanRequest(
    @SerializedName("name") val name: String,
    @SerializedName("price") val price: Double,
    @SerializedName("durationSeconds") val durationSeconds: Int,
    @SerializedName("validityType") val validityType: String = "UPTIME_ACCUMULATED",
    @SerializedName("downloadSpeedKbps") val downloadSpeedKbps: Int = 5120,
    @SerializedName("uploadSpeedKbps") val uploadSpeedKbps: Int = 2048,
    @SerializedName("sharedUsers") val sharedUsers: Int = 1,
    @SerializedName("routerId") val routerId: String,
    @SerializedName("hotspotProfileName") val hotspotProfileName: String = "default"
)

data class BootstrapScriptDto(
    @SerializedName("routerId") val routerId: String,
    @SerializedName("routerName") val routerName: String,
    @SerializedName("host") val host: String,
    @SerializedName("apiPort") val apiPort: Int,
    @SerializedName("hotspotSubnet") val hotspotSubnet: String? = null,
    @SerializedName("hotspotGateway") val hotspotGateway: String? = null,
    @SerializedName("quickUnlockCommand") val quickUnlockCommand: String? = null,
    @SerializedName("ntpScript") val ntpScript: String? = null,
    @SerializedName("hotspotScript") val hotspotScript: String? = null,
    @SerializedName("script") val script: String
)

data class CreateRouterRequest(
    @SerializedName("name") val name: String,
    @SerializedName("host") val host: String,
    @SerializedName("apiPort") val apiPort: Int = 8728,
    @SerializedName("useSsl") val useSsl: Boolean = false,
    @SerializedName("username") val username: String = "admin",
    @SerializedName("password") val password: String = ""
)

data class UpdateRouterRequest(
    @SerializedName("name") val name: String? = null,
    @SerializedName("host") val host: String? = null,
    @SerializedName("apiPort") val apiPort: Int? = null,
    @SerializedName("useSsl") val useSsl: Boolean? = null,
    @SerializedName("username") val username: String? = null,
    @SerializedName("password") val password: String? = null
)

data class SuggestIpDto(
    @SerializedName("suggestedHost") val suggestedHost: String,
    @SerializedName("suggestedSubnet") val suggestedSubnet: String,
    @SerializedName("suggestedGateway") val suggestedGateway: String,
    @SerializedName("occupiedHosts") val occupiedHosts: List<String>,
    @SerializedName("occupiedSubnets") val occupiedSubnets: List<String>
)

data class ZeroTierConfigRequest(
    @SerializedName("networkId") val networkId: String
)

data class ZeroTierConfigResponse(
    @SerializedName("routerId") val routerId: String,
    @SerializedName("networkId") val networkId: String,
    @SerializedName("command") val command: String,
    @SerializedName("appliedOnRouter") val appliedOnRouter: Boolean,
    @SerializedName("applyError") val applyError: String?
)

data class SetRemoteIpRequest(
    @SerializedName("remoteIp") val remoteIp: String
)

data class SetRemoteIpResponse(
    @SerializedName("host") val host: String,
    @SerializedName("online") val online: Boolean,
    @SerializedName("latencyMs") val latencyMs: Long?,
    @SerializedName("identity") val identity: String?,
    @SerializedName("rosVersion") val rosVersion: String?
)

data class PortalInstallResponse(
    @SerializedName("installedFiles") val installedFiles: Int?,
    @SerializedName("totalFiles") val totalFiles: Int?,
    @SerializedName("brand") val brand: String?,
    @SerializedName("manualScript") val manualScript: String?
)

data class DiscoveredDeviceDto(
    @SerializedName("mac") val mac: String,
    @SerializedName("identity") val identity: String,
    @SerializedName("version") val version: String,
    @SerializedName("platform") val platform: String,
    @SerializedName("board") val board: String,
    @SerializedName("uptimeSeconds") val uptimeSeconds: Long?,
    @SerializedName("softwareId") val softwareId: String,
    @SerializedName("interfaceName") val interfaceName: String,
    @SerializedName("ipv4") val ipv4: String?,
    @SerializedName("ipv6") val ipv6: String?,
    @SerializedName("source") val source: String,
    @SerializedName("apiPort") val apiPort: String,
    @SerializedName("winboxPort") val winboxPort: String,
    @SerializedName("isRegistered") val isRegistered: Boolean = false,
    @SerializedName("registeredRouterId") val registeredRouterId: String? = null,
    @SerializedName("registeredRouterName") val registeredRouterName: String? = null
)

data class QuickConnectRouterRequest(
    @SerializedName("name") val name: String? = null,
    @SerializedName("host") val host: String,
    @SerializedName("apiPort") val apiPort: Int = 8728,
    @SerializedName("useSsl") val useSsl: Boolean = false,
    @SerializedName("username") val username: String = "admin",
    @SerializedName("password") val password: String = "",
    @SerializedName("connectVia") val connectVia: String = "ip",
    @SerializedName("mac") val mac: String? = null
)

data class QuickConnectRouterResponse(
    @SerializedName("id") val id: String,
    @SerializedName("name") val name: String,
    @SerializedName("host") val host: String,
    @SerializedName("identity") val identity: String,
    @SerializedName("rosVersion") val rosVersion: String,
    @SerializedName("boardName") val boardName: String,
    @SerializedName("latencyMs") val latencyMs: Long,
    @SerializedName("status") val status: String
)




