package com.example.mikrofichas

import android.app.Dialog
import android.content.Intent
import android.graphics.Color
import android.graphics.drawable.ColorDrawable
import android.os.Bundle
import android.view.View
import android.view.ViewGroup
import android.widget.Toast
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import com.example.mikrofichas.data.api.ApiClient
import com.example.mikrofichas.data.model.LoginRequest
import com.example.mikrofichas.databinding.ActivityLoginBinding
import com.example.mikrofichas.databinding.DialogServerConfigBinding
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

class LoginActivity : AppCompatActivity() {

    private lateinit var binding: ActivityLoginBinding

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        ApiClient.init(this)

        // Si ya hay sesión activa con token, pasar directo a MainActivity
        if (ApiClient.isLoggedIn()) {
            goToMainActivity()
            return
        }

        binding = ActivityLoginBinding.inflate(layoutInflater)
        setContentView(binding.root)

        setupUI()
    }

    private fun setupUI() {
        updateServerUrlLabel()

        // Botones de acceso rápido
        binding.btnQuickAdmin.setOnClickListener {
            binding.etUsername.setText("admin")
            binding.etPassword.setText("admin123")
        }

        binding.btnQuickSeller.setOnClickListener {
            binding.etUsername.setText("vendedor")
            binding.etPassword.setText("vendedor123")
        }

        // Botón principal de login
        binding.btnLogin.setOnClickListener {
            attemptLogin()
        }

        // Configuración de servidor
        binding.btnConfigServer.setOnClickListener {
            showServerConfigDialog()
        }
    }

    private fun updateServerUrlLabel() {
        binding.tvCurrentServerUrl.text = "Servidor: ${ApiClient.getBaseUrl()}"
    }

    private fun attemptLogin() {
        val username = binding.etUsername.text.toString().trim()
        val password = binding.etPassword.text.toString().trim()

        if (username.isEmpty() || password.isEmpty()) {
            Toast.makeText(this, "Ingresa tu usuario y contraseña", Toast.LENGTH_SHORT).show()
            return
        }

        binding.btnLogin.isEnabled = false
        binding.pbLoginLoading.visibility = View.VISIBLE

        lifecycleScope.launch(Dispatchers.IO) {
            try {
                val response = ApiClient.getService().login(LoginRequest(username, password))
                withContext(Dispatchers.Main) {
                    binding.btnLogin.isEnabled = true
                    binding.pbLoginLoading.visibility = View.GONE

                    if (response.isSuccessful && response.body()?.success == true) {
                        val loginData = response.body()?.data
                        if (loginData != null) {
                            ApiClient.saveConfig(
                                context = this@LoginActivity,
                                baseUrl = ApiClient.getBaseUrl(),
                                token = loginData.token,
                                operator = loginData.user.username,
                                role = loginData.user.role
                            )

                            val roleTitle = if (ApiClient.isAdmin()) "Administrador" else "Vendedor"
                            Toast.makeText(
                                this@LoginActivity,
                                "Bienvenido, ${loginData.user.username} ($roleTitle)",
                                Toast.LENGTH_SHORT
                            ).show()

                            goToMainActivity()
                        } else {
                            showErrorDialog("Error de inicio de sesión", "No se recibieron datos de usuario.")
                        }
                    } else {
                        val msg = response.body()?.error?.message 
                            ?: response.body()?.message 
                            ?: "Credenciales incorrectas o usuario no activo."
                        showErrorDialog("Acceso Denegado", msg)
                    }
                }
            } catch (e: Exception) {
                withContext(Dispatchers.Main) {
                    binding.btnLogin.isEnabled = true
                    binding.pbLoginLoading.visibility = View.GONE
                    showErrorDialog(
                        "Error de Conexión",
                        "No se pudo contactar al servidor en:\n${ApiClient.getBaseUrl()}\n\nVerifica que la API esté corriendo y que la IP sea correcta en 'Cambiar IP del Servidor'."
                    )
                }
            }
        }
    }

    private fun goToMainActivity() {
        val intent = Intent(this, MainActivity::class.java)
        startActivity(intent)
        finish()
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
            val newUrl = dialogBinding.etServerUrl.text.toString().trim()
            if (newUrl.isEmpty()) {
                Toast.makeText(this, "La URL del servidor no puede estar vacía", Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }

            ApiClient.saveConfig(
                this,
                baseUrl = newUrl,
                token = ApiClient.authToken,
                operator = ApiClient.operatorName.ifEmpty { "Vendedor" },
                role = ApiClient.userRole
            )

            updateServerUrlLabel()
            Toast.makeText(this, "Servidor actualizado", Toast.LENGTH_SHORT).show()
            dialog.dismiss()
        }

        dialogBinding.btnCancelConfig.setOnClickListener {
            dialog.dismiss()
        }

        dialog.show()
    }

    private fun showErrorDialog(title: String, message: String) {
        AlertDialog.Builder(this)
            .setTitle(title)
            .setMessage(message)
            .setPositiveButton("Entendido", null)
            .show()
    }
}
