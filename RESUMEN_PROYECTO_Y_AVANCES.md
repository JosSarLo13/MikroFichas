# 📋 MikroFichas / MikroManager - Resumen de Avances y Estado del Proyecto

**Fecha y hora:** 07 de Octubre 2026  
**Ubicación del Proyecto:** `/home/jose/AndroidStudioProjects/MikroFichas`  
**Red ZeroTier:** `b9a18a606f03ddb5` (Rango `10.147.20.0/24`)  
**IP Servidor Local:** `http://192.168.0.104:4000` (Web en puerto `5173`)  
**APK Android Compilado:** `app/build/outputs/apk/debug/app-debug.apk`

---

## 🔒 1. Generador Criptográfico Seguro: 5 Dígitos Numéricos (Sin Letras ni Repeticiones)

Se sustituyó cualquier generador matemático simple por **CSPRNG (`node:crypto` `randomInt`)**:
- **Formato Estricto:** Exactamente **5 dígitos numéricos** (rango `10000` a `99999`). Cero letras ni símbolos raros que confundan al cliente o al cajero.
- **Imposible de Descifrar:** Basado en entropía del kernel de Linux (`/dev/urandom`), lo que previene que nadie adivine patrones de números continuos.
- **Anti-Colisión Garantizado:** Antes de guardar en base de datos, el backend consulta todos los usuarios existentes en ese router y descarta cualquier coincidencia. **Nunca se repite un PIN ni un Usuario.**
- **Modalidades Soportadas (Tanto en App como en Web):**
  1. **👤 Usuario y Contraseña (Recomendado):** Genera un Usuario de 5 dígitos (ej. `48291`) y una Contraseña distinta de 5 dígitos (ej. `73910`).
  2. **🔑 Solo PIN:** Genera un código de 5 dígitos donde usuario = contraseña.

---

## ⚡ 2. Protección Contra Apagones y Cortes de Luz (Sin Batería RTC)

### El problema de los routers MikroTik en pueblos sin paneles:
Los modelos populares de MikroTik (hEX, hAP lite, hAP ac, etc.) **no tienen batería de reloj en la placa madre**. Cuando se va la luz en el pueblo:
1. El router se apaga.
2. Al regresar la luz, RouterOS arranca con fecha de **1 de enero de 1970 (`00:00:00`)**.
3. El módem del proveedor de internet tarda de 1 a 3 minutos en conectar la fibra o el enlace satelital. Durante esos minutos, el router no tiene internet ni DNS, por lo que un NTP configurado por nombre de dominio falla.
4. **El peligro:** Si un usuario entra con tiempo corrido o un scheduler se dispara en 1970, al sincronizarse a 2026 MikroTik cree que pasaron 56 años y **borra todas las fichas de inmediato**.

### Solución Implementada en el Script Bootstrap:
1. **Sincronización NTP con IPs Públicas Directas (Sin DNS):**
   Además de `pool.ntp.org` y `time.google.com`, se agregaron las direcciones IP directas `216.239.35.0` (Google NTP) y `1.1.1.1` (Cloudflare). Esto garantiza que el reloj se sincronice por IP en cuanto haya el más mínimo flujo de paquetes, sin esperar a que el servicio DNS del módem termine de iniciar.
   Zona horaria fijada a: `America/Mexico_City`.
2. **Guardián de Arranque (`SAFE_BOOT_GUARD`):**
   Se programa un script que se ejecuta automáticamente al encender el router (`start-time=startup`). Si el año es menor a 2024 (señal de reinicio por corte de luz), fuerza una actualización con la nube de MikroTik (`/ip cloud force-update`) y bloquea ejecuciones erróneas de vencimiento.
3. **Resistencia de Tiempo Pausado (`UPTIME_ACCUMULATED`):**
   Para pueblos con cortes frecuentes, el **Tiempo Pausado** es el modo más seguro por naturaleza: `limit-uptime` solo cuenta los segundos activos mientras el cliente tiene Wi-Fi encendido y tráfico circulando. Si se va la luz, el usuario se desconecta y al volver la electricidad conserva exactamente los minutos restantes que le quedaban.

---

## 🌐 3. Portal Cautivo Sarmientos: Doble Modo de Inicio de Sesión

El archivo [`login.html`](apps/api/src/infrastructure/hotspot/templates/sarmientos/login.html) cuenta con:
- Pestañas fluidas e intuitivas:
  - **`👤 Usuario y Clave`** (Campos separados para Usuario de 5 dígitos y Contraseña de 5 dígitos con teclado numérico `inputmode="numeric"` en móviles).
  - **`🔑 Solo PIN`** (Campo único para quienes manejen clave única).
- **Auto-Login por Código QR:** Al escanear con la cámara del teléfono una ficha con usuario y contraseña (`?username=XXXXX&password=YYYYY`), el portal llena automáticamente ambas credenciales y conecta en 1 segundo sin teclear nada.

---

## 🖨️ 4. Impresión Térmica (58mm / 80mm / Carta A4)

Tanto en la aplicación Android ([`TicketPrintHelper.kt`](app/src/main/java/com/example/mikrofichas/util/TicketPrintHelper.kt)) como en el panel Web ([`TicketPrintModal.tsx`](apps/web/src/features/tickets/TicketPrintModal.tsx)):
- Si la ficha tiene Usuario y Contraseña separados: Imprime una tabla clara con recuadros para **USUARIO: XXXXX** y **CONTRASEÑA: YYYYY**.
- Si la ficha es de solo PIN: Imprime el recuadro grande de **PIN / CLAVE DE ACCESO: XXXXX**.
- El código QR siempre va codificado con ambas variables listas para el portal.

---

## 📱 5. Paridad Total entre Aplicación Android y Página Web

Ambas plataformas cuentan con los **mismos campos, opciones y lógica de negocio**:

| Característica | Aplicación Android (APK) | Panel Web (Vite/React) |
| :--- | :--- | :--- |
| **Generación de Lotes** | Selector de Plan, selector de Usuario/Clave vs Solo PIN, prefijo opcional y botones 10, 25, 50 | Selector de Plan, selector de Usuario/Clave vs Solo PIN, prefijo opcional y presets 10, 25, 50, 100 |
| **Venta Rápida (POS)** | Muestra Usuario y Contraseña (o PIN), cálculo de cambio, QR e impresión | Muestra Usuario y Contraseña (o PIN), cálculo de cambio, QR e impresión |
| **Impresión Térmica** | Diálogo nativo Android PrintManager (58mm) | Modal interactivo (58mm, 80mm y Planilla A4) |
| **Corte de Caja Oficial** | Arqueo con botón **"📄 Imprimir / Exportar Corte en PDF"** con firmas | Reportes y Auditoría con **"Exportar PDF / Imprimir"** y **"Descargar CSV"** real |
| **Gestión de Routers** | Selector, botones `+ Nuevo` y `Editar`, Modo Automático vs Manual y Anti-Colisión | Tarjetas de routers, modal `Agregar` y `Editar`, Modo Automático vs Manual y Anti-Colisión |
| **Scripts MikroTik** | Selección libre de fragmentos con el dedo y botones de copia de comandos específicos | Selección libre con el cursor (`select-text`) y botones de copia de fragmentos |
| **Monitoreo MikroTik** | CPU, RAM, Uptime en vivo, test de socket y script bootstrap | CPU, RAM, Uptime en vivo, test de socket y script bootstrap |

---

## 🚀 6. Gestión Avanzada de MikroTik: Modo Automático, Modo Manual y Cero Colisiones

1. **Soporte para MikroTik Nuevo de Fábrica:**
   - Los routers recién sacados de caja vienen con usuario `admin` y contraseña vacía `""`.
   - Se adaptó la API y formularios (Web y APK) para aceptar contraseña vacía sin fallar ni rechazar la creación.
   - Si el router ya tiene clave o se le va a cambiar, el sistema la actualiza y la almacena cifrada con **AES-256-GCM**.

2. **Doble Modo de Asignación de IP:**
   - **⚡ Modo Automático (Recomendado):** El backend consulta todas las IPs y subredes ya registradas (`/api/v1/routers/suggest-ip`) y sugiere de forma inteligente la siguiente IP libre (`192.168.88.2`, `192.168.88.3`, etc.) y la siguiente subred Hotspot (`10.5.10.0/24`, `10.5.20.0/24`, `10.5.30.0/24`), garantizando **0 colisiones de red** entre routers.
   - **⚙️ Modo Manual:** Permite ingresar cualquier IP o host personalizado. Si la IP coincide con otro router registrado, el sistema muestra una advertencia visual inmediata y previene la duplicación.

3. **Edición Completa de Routers:**
   - Se puede modificar en cualquier momento el nombre, la IP/Host, el puerto API, el modo TLS/SSL, el usuario y la contraseña de cada MikroTik.

---

## 📑 7. Corrección del Bug de Selección de Texto y Copia por Fragmentos

- **En la Web:** Se corrigió la regla CSS `select-all` por `select-text` en el modal de scripts. Ahora es posible seleccionar y arrastrar con el cursor cualquier fragmento o línea individual sin que el navegador seleccione forzosamente todo el texto.
- **En la App Android:** Se habilitó `android:textIsSelectable="true"` en el visor del script, permitiendo seleccionar cualquier parte con los dedos.
- **Botones de Copia Rápida en 1 Clic (Web y APK):**
  1. `⚡ Desbloqueo API (1 Línea)`: Desbloquea el puerto 8728 en el firewall de fábrica en 2 segundos.
  2. `⏰ Anti-Apagones (NTP)`: Configura sincronización horaria con IPs directas y script guardián.
  3. `📶 Subred y Perfiles Hotspot`: Configura Bridge, DHCP, subred asignada y regla de 1 dispositivo por ficha (`shared-users=1`).
  4. `📋 Script Completo`: Copia toda la configuración integrada.

---

## 📊 8. Exportación Oficial en PDF y Descarga CSV de Reportes

- **En la Web ([`ReportsView.tsx`](apps/web/src/features/reports/ReportsView.tsx)):**
  - Muestra métricas financieras reales conectadas a la base de datos (`/api/v1/sales/report`).
  - Filtro por periodo (**Hoy**, **7 Días**, **30 Días**, **Histórico**) y por Router.
  - Botón **"Descargar CSV"**: Genera y descarga un archivo `.csv` real con codificación UTF-8 compatible con Microsoft Excel.
  - Botón **"Descargar PDF (.pdf)"**: Descarga un archivo binario `.pdf` vector oficial generado en el backend con `pdfkit`, con resumen de ventas, tablas, arqueo de métodos de pago y firmas de auditoría.
  - Botón **"Exportar PDF / Imprimir"**: Abre el visor interactivo de corte de caja con opciones de impresión directa o descarga de archivo.
- **En la App Android ([`MainActivity.kt`](app/src/main/java/com/example/mikrofichas/MainActivity.kt)):**
  - Botón **"📄 Imprimir / Exportar Corte en PDF"** en la sección de Corte de Caja.
  - Menú selector interactivo:
    1. **"Descargar Archivo PDF Oficial (.pdf)"**: Descarga el archivo `.pdf` real generado por el servidor.
    2. **"Imprimir / Guardar PDF (Nativo)"**: Abre el asistente de impresión del sistema Android (`PrintManager`).

---

## 🔍 9. Escáner de Red Automático Tipo Winbox Neighbors (MNDP UDP 5678)

Para evitar escribir IPs manuales o batallar agregando routers:
1. **Detección Automática por Protocolo MNDP:**
   - Envía paquetes de sondeo de 4 bytes a las direcciones de broadcast de la red local por el puerto UDP 5678 (idéntico a la pestaña "Neighbors" del Winbox oficial).
   - MikroTik responde con su MAC Address, Identidad, Modelo/Board, Versión de RouterOS, Uptime y dirección IPv4/IPv6.
   - Sonda además la IP de fábrica `192.168.88.1` (puertos 8728 y 8291) por si el router está recién desempaquetado.
2. **Conexión en 1 Clic (Por IP o Por MAC):**
   - El usuario puede hacer clic en **"Conectar por IP"** o **"Conectar por MAC"**.
   - Solicita usuario (`admin`) y contraseña (con aviso visual claro de que los equipos de fábrica vienen con contraseña vacía).
   - Diagnóstico en tiempo real: Detecta automáticamente si el puerto API (8728) está apagado o bloqueado por firewall en ether1 (WAN), guiando al usuario con la solución precisa.
3. **Disponibilidad 100%:**
   - En Web: Botón **"🔍 Escanear Red (Winbox)"** en [`RoutersView.tsx`](apps/web/src/features/routers/RoutersView.tsx).
   - En Android APK: Botón **"🔍 Winbox"** y diálogo interactivo en [`MainActivity.kt`](app/src/main/java/com/example/mikrofichas/MainActivity.kt).

---

## 🛠️ ¿Cómo retomar en otra cuenta o si se cierra el chat?

Dile esto a la IA en el primer mensaje:

> *"Lee el archivo `RESUMEN_PROYECTO_Y_AVANCES.md` que está en la raíz de `/home/jose/AndroidStudioProjects/MikroFichas`. Ahí está todo lo que hicimos. Continúa desde donde nos quedamos."*


