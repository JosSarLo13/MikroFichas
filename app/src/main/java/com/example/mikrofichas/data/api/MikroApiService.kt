package com.example.mikrofichas.data.api

import com.example.mikrofichas.data.model.*
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.DELETE
import retrofit2.http.GET
import retrofit2.http.Header
import retrofit2.http.PATCH
import retrofit2.http.Path
import retrofit2.http.POST
import retrofit2.http.Query

interface MikroApiService {

    @POST("api/v1/auth/login")
    suspend fun login(
        @Body request: LoginRequest
    ): Response<ApiResponse<LoginResponse>>

    @GET("api/v1/routers")
    suspend fun getRouters(
        @Header("Authorization") token: String? = null
    ): Response<ApiResponse<List<RouterDto>>>

    @POST("api/v1/routers")
    suspend fun createRouter(
        @Body request: CreateRouterRequest,
        @Header("Authorization") token: String? = null
    ): Response<ApiResponse<RouterDto>>

    @PATCH("api/v1/routers/{id}")
    suspend fun updateRouter(
        @Path("id") routerId: String,
        @Body request: UpdateRouterRequest,
        @Header("Authorization") token: String? = null
    ): Response<ApiResponse<RouterDto>>

    @DELETE("api/v1/routers/{id}")
    suspend fun deleteRouter(
        @Path("id") routerId: String,
        @Header("Authorization") token: String? = null
    ): Response<ApiResponse<Any>>

    @GET("api/v1/routers/suggest-ip")
    suspend fun suggestIp(
        @Header("Authorization") token: String? = null
    ): Response<ApiResponse<SuggestIpDto>>

    @GET("api/v1/routers/discover")
    suspend fun discoverRouters(
        @Query("timeoutMs") timeoutMs: Int = 3500,
        @Header("Authorization") token: String? = null
    ): Response<ApiResponse<List<DiscoveredDeviceDto>>>

    @POST("api/v1/routers/quick-connect")
    suspend fun quickConnectRouter(
        @Body request: QuickConnectRouterRequest,
        @Header("Authorization") token: String? = null
    ): Response<ApiResponse<QuickConnectRouterResponse>>


    @POST("api/v1/routers/{id}/test")
    suspend fun testRouter(
        @Path("id") routerId: String,
        @Header("Authorization") token: String? = null
    ): Response<ApiResponse<RouterTestResultDto>>

    @GET("api/v1/routers/{id}/telemetry")
    suspend fun getRouterTelemetry(
        @Path("id") routerId: String,
        @Header("Authorization") token: String? = null
    ): Response<ApiResponse<RouterTelemetryDto>>

    @POST("api/v1/routers/{id}/auto-provision")
    suspend fun autoProvisionRouter(
        @Path("id") routerId: String,
        @Header("Authorization") token: String? = null
    ): Response<ApiResponse<AutoProvisionResponseDto>>

    @GET("api/v1/routers/{id}/bootstrap-script")
    suspend fun getBootstrapScript(
        @Path("id") routerId: String,
        @Header("Authorization") token: String? = null
    ): Response<ApiResponse<BootstrapScriptDto>>

    @POST("api/v1/routers/{id}/zerotier")
    suspend fun configureZeroTier(
        @Path("id") routerId: String,
        @Body request: ZeroTierConfigRequest,
        @Header("Authorization") token: String? = null
    ): Response<ApiResponse<ZeroTierConfigResponse>>

    @POST("api/v1/routers/{id}/set-remote-ip")
    suspend fun setRemoteIp(
        @Path("id") routerId: String,
        @Body request: SetRemoteIpRequest,
        @Header("Authorization") token: String? = null
    ): Response<ApiResponse<SetRemoteIpResponse>>

    @POST("api/v1/routers/{id}/hotspot/install-template")
    suspend fun installPortalTemplate(
        @Path("id") routerId: String,
        @Header("Authorization") token: String? = null
    ): Response<ApiResponse<PortalInstallResponse>>

    @POST("api/v1/routers/{id}/sync-tickets")
    suspend fun syncRouterTickets(
        @Path("id") routerId: String,
        @Header("Authorization") token: String? = null
    ): Response<ApiResponse<SyncTicketsResponse>>



    @GET("api/v1/plans")
    suspend fun getPlans(
        @Query("routerId") routerId: String? = null,
        @Header("Authorization") token: String? = null
    ): Response<ApiResponse<List<PlanDto>>>

    @POST("api/v1/plans")
    suspend fun createPlan(
        @Body request: CreatePlanRequest,
        @Header("Authorization") token: String? = null
    ): Response<ApiResponse<PlanDto>>

    @POST("api/v1/sales")
    suspend fun processSale(
        @Body request: SaleRequest,
        @Header("Authorization") token: String? = null
    ): Response<ApiResponse<SaleResponse>>

    @GET("api/v1/sales/summary")
    suspend fun getDailySummary(
        @Header("Authorization") token: String? = null
    ): Response<ApiResponse<DailySalesSummaryDto>>

    @POST("api/v1/tickets/generate")
    suspend fun generateBatch(
        @Body request: GenerateBatchRequest,
        @Header("Authorization") token: String? = null
    ): Response<ApiResponse<GenerateBatchResponse>>
}

