package com.example.mikrofichas.data.api

import android.content.Context
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import java.util.concurrent.TimeUnit

object ApiClient {
    private const val PREFS_NAME = "mikromanager_prefs"
    private const val KEY_BASE_URL = "base_url"
    private const val KEY_TOKEN = "jwt_token"
    private const val KEY_OPERATOR = "operator_name"
    private const val KEY_ROLE = "user_role"

    // URL predeterminada para red local LAN / Wi-Fi (IP real del servidor)
    const val DEFAULT_BASE_URL = "http://192.168.0.104:4000/"
    const val EMULATOR_BASE_URL = "http://10.0.2.2:4000/"

    private var retrofit: Retrofit? = null
    private var currentBaseUrl: String = DEFAULT_BASE_URL
    var authToken: String? = null
    var operatorName: String = ""
    var userRole: String = ""

    fun init(context: Context) {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        currentBaseUrl = prefs.getString(KEY_BASE_URL, DEFAULT_BASE_URL) ?: DEFAULT_BASE_URL
        authToken = prefs.getString(KEY_TOKEN, null)
        operatorName = prefs.getString(KEY_OPERATOR, "") ?: ""
        userRole = prefs.getString(KEY_ROLE, "") ?: ""
    }

    fun isLoggedIn(): Boolean = !authToken.isNullOrBlank()

    fun isAdmin(): Boolean {
        val role = userRole.uppercase()
        return role.contains("ADMIN") || role.contains("SUPERADMIN")
    }

    fun saveConfig(context: Context, baseUrl: String, token: String?, operator: String, role: String) {
        var cleanUrl = baseUrl.trim()
        if (!cleanUrl.endsWith("/")) {
            cleanUrl += "/"
        }
        currentBaseUrl = cleanUrl
        authToken = token
        operatorName = operator
        userRole = role

        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        prefs.edit()
            .putString(KEY_BASE_URL, currentBaseUrl)
            .putString(KEY_TOKEN, authToken)
            .putString(KEY_OPERATOR, operatorName)
            .putString(KEY_ROLE, userRole)
            .apply()

        // Forzar recreación del cliente Retrofit
        retrofit = null
    }

    fun logout(context: Context) {
        authToken = null
        operatorName = ""
        userRole = ""
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        prefs.edit()
            .remove(KEY_TOKEN)
            .remove(KEY_OPERATOR)
            .remove(KEY_ROLE)
            .apply()

        retrofit = null
    }

    fun getBaseUrl(): String = currentBaseUrl

    fun getService(): MikroApiService {
        if (retrofit == null) {
            val logging = HttpLoggingInterceptor().apply {
                level = HttpLoggingInterceptor.Level.BODY
            }

            val okHttpClient = OkHttpClient.Builder()
                .addInterceptor { chain ->
                    val requestBuilder = chain.request().newBuilder()
                    val token = authToken
                    if (!token.isNullOrBlank()) {
                        requestBuilder.addHeader("Authorization", "Bearer $token")
                    }
                    chain.proceed(requestBuilder.build())
                }
                .addInterceptor(logging)
                .connectTimeout(6, TimeUnit.SECONDS)
                .readTimeout(10, TimeUnit.SECONDS)
                .writeTimeout(10, TimeUnit.SECONDS)
                .build()

            retrofit = Retrofit.Builder()
                .baseUrl(currentBaseUrl)
                .client(okHttpClient)
                .addConverterFactory(GsonConverterFactory.create())
                .build()
        }
        return retrofit!!.create(MikroApiService::class.java)
    }
}
