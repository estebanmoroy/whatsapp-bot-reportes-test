# Guía de Instalación Detallada

Esta guía proporciona instrucciones paso a paso para instalar y configurar el Bot de WhatsApp para Reportes de Construcción en diferentes entornos.

## Instalación local (para desarrollo y pruebas)

### Requisitos previos

1. **Node.js y npm**

   - Instala Node.js v14 o superior desde [nodejs.org](https://nodejs.org/)
   - Verifica la instalación:
     ```bash
     node -v
     npm -v
     ```

2. **MongoDB**

   - **Opción A**: Instala MongoDB Community Edition localmente
     - Sigue las instrucciones en [mongodb.com/try/download/community](https://www.mongodb.com/try/download/community)
     - Inicia el servicio de MongoDB
   - **Opción B**: Usa MongoDB Atlas (servicio en la nube)
     - Crea una cuenta en [mongodb.com/cloud/atlas](https://www.mongodb.com/cloud/atlas)
     - Configura un cluster gratuito
     - Obtén la cadena de conexión

3. **Dependencias del sistema para Puppeteer**
   - **Windows**: No se requieren dependencias adicionales
   - **macOS**: No se requieren dependencias adicionales
   - **Linux (Ubuntu/Debian)**:
     ```bash
     sudo apt update
     sudo apt install -y gconf-service libgbm-dev libasound2 libatk1.0-0 libc6 libcairo2 libcups2 libdbus-1-3 libexpat1 libfontconfig1 libgconf-2-4 libgdk-pixbuf2.0-0 libglib2.0-0 libgtk-3-0 libnspr4 libpango-1.0-0 libpangocairo-1.0-0 libstdc++6 libx11-6 libx11-xcb1 libxcb1 libxcomposite1 libxcursor1 libxdamage1 libxext6 libxfixes3 libxi6 libxrandr2 libxrender1 libxss1 libxtst6 ca-certificates fonts-liberation libnss3 lsb-release xdg-utils wget
     ```

### Configuración del proyecto

1. **Clona o crea el repositorio**

   ```bash
   # Opción A: Clonar desde un repositorio existente
   git clone https://github.com/tu-usuario/whatsapp-construccion-bot.git
   cd whatsapp-construccion-bot

   # Opción B: Crear desde cero
   mkdir whatsapp-construccion-bot
   cd whatsapp-construccion-bot
   ```

2. **Inicializa el proyecto e instala dependencias**

   ```bash
   # Inicializar npm (si creas desde cero)
   npm init -y

   # Instalar dependencias
   npm install whatsapp-web.js qrcode-terminal openai mongoose express dotenv
   ```

3. **Crea los archivos del proyecto**

   - Crea el archivo `index.js` con el código del bot
   - Crea un archivo `.env` para las variables de entorno

4. **Configura las variables de entorno**

   ```
   # .env
   OPENAI_API_KEY=tu_api_key_de_openai
   MONGODB_URI=mongodb://localhost:27017/construccion-reportes
   PORT=3000
   ```

5. **Crea la estructura de carpetas**
   ```bash
   mkdir audios
   mkdir public
   ```

### Ejecución inicial y configuración

1. **Inicia el bot por primera vez**

   ```bash
   node index.js
   ```

2. **Escanea el código QR**

   - Abre WhatsApp en tu teléfono
   - Ve a WhatsApp Web / Dispositivos vinculados
   - Escanea el código QR que aparece en la terminal

3. **Configura el ID del grupo objetivo**

   - Agrega el bot al grupo de WhatsApp deseado
   - Envía el mensaje `!grupoid` en el grupo
   - El bot responderá con el ID del grupo
   - Detén el bot (Ctrl+C)
   - Actualiza la constante `GRUPO_OBJETIVO` en `index.js` con el ID obtenido

4. **Reinicia el bot**
   ```bash
   node index.js
   ```

## Despliegue en producción

### Opción 1: VPS (Servidor Virtual Privado)

1. **Configura un VPS** con Ubuntu/Debian

   - DigitalOcean, Linode, AWS EC2, Google Cloud, etc.
   - Tamaño recomendado: 2GB RAM mínimo

2. **Conecta al servidor**

   ```bash
   ssh usuario@ip-del-servidor
   ```

3. **Instala las dependencias**

   ```bash
   # Actualiza el sistema
   sudo apt update && sudo apt upgrade -y

   # Instala Node.js
   curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
   sudo apt install -y nodejs

   # Instala dependencias para Puppeteer
   sudo apt install -y gconf-service libgbm-dev libasound2 libatk1.0-0 libc6 libcairo2 libcups2 libdbus-1-3 libexpat1 libfontconfig1 libgconf-2-4 libgdk-pixbuf2.0-0 libglib2.0-0 libgtk-3-0 libnspr4 libpango-1.0-0 libpangocairo-1.0-0 libstdc++6 libx11-6 libx11-xcb1 libxcb1 libxcomposite1 libxcursor1 libxdamage1 libxext6 libxfixes3 libxi6 libxrandr2 libxrender1 libxss1 libxtst6 ca-certificates fonts-liberation libnss3 lsb-release xdg-utils wget

   # Opcionalmente, instala MongoDB si lo usarás localmente
   sudo apt install -y mongodb
   sudo systemctl enable mongodb
   sudo systemctl start mongodb
   ```

4. **Configura el proyecto**

   ```bash
   # Crea un directorio para el proyecto
   mkdir -p /opt/whatsapp-bot
   cd /opt/whatsapp-bot

   # Copia tus archivos o clona el repositorio
   # (puedes usar scp, git clone, etc.)

   # Instala dependencias
   npm install

   # Crea el archivo .env
   nano .env
   # Añade las variables de entorno

   # Crea la carpeta para audios
   mkdir audios
   ```

5. **Instala y configura PM2**

   ```bash
   # Instala PM2 globalmente
   sudo npm install -g pm2

   # Inicia la aplicación con PM2
   pm2 start index.js --name whatsapp-bot

   # Configura PM2 para iniciar con el sistema
   pm2 save
   pm2 startup
   # Ejecuta el comando que PM2 te indique

   # Verifica el estado
   pm2 status
   ```

6. **Configura Nginx como proxy inverso (opcional)**

   ```bash
   # Instala Nginx
   sudo apt install -y nginx

   # Configura un sitio
   sudo nano /etc/nginx/sites-available/whatsapp-bot
   ```

   Añade esta configuración:

   ```
   server {
       listen 80;
       server_name tu-dominio.com;

       location / {
           proxy_pass http://localhost:3000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_cache_bypass $http_upgrade;
       }
   }
   ```

   Activa el sitio:

   ```bash
   sudo ln -s /etc/nginx/sites-available/whatsapp-bot /etc/nginx/sites-enabled/
   sudo nginx -t
   sudo systemctl restart nginx
   ```

7. **Configura SSL con Certbot (opcional pero recomendado)**
   ```bash
   sudo apt install -y certbot python3-certbot-nginx
   sudo certbot --nginx -d tu-dominio.com
   ```

### Opción 2: Google Cloud Platform

1. **Crea una instancia de Compute Engine**

   - Tipo de máquina: e2-medium (2 vCPU, 4 GB de memoria)
   - Sistema operativo: Ubuntu 20.04 LTS
   - Permite tráfico HTTP/HTTPS

2. **Conéctate a la instancia**

   ```bash
   gcloud compute ssh nombre-de-instancia
   ```

3. **Sigue los pasos de configuración** de la opción VPS

### Opción 3: AWS

1. **Lanza una instancia EC2**

   - Tipo: t3.small
   - AMI: Ubuntu Server 22.04
   - Configura grupos de seguridad para permitir SSH, HTTP, HTTPS

2. **Conéctate a la instancia**

   ```bash
   ssh -i tu-clave.pem ubuntu@dirección-ip
   ```

3. **Sigue los pasos de configuración** de la opción VPS

## Configuración de la base de datos

### MongoDB local

1. **Verifica que MongoDB esté funcionando**

   ```bash
   sudo systemctl status mongodb
   ```

2. **Crea la base de datos y usuario (opcional pero recomendado)**

   ```bash
   mongosh
   ```

   ```javascript
   use construccion-reportes
   db.createUser({
     user: "botuser",
     pwd: "contraseña-segura",
     roles: ["readWrite"]
   })
   ```

3. **Actualiza la cadena de conexión en .env**
   ```
   MONGODB_URI=mongodb://botuser:contraseña-segura@localhost:27017/construccion-reportes
   ```

### MongoDB Atlas (nube)

1. **Crea un cluster en MongoDB Atlas**
2. **Crea un usuario de base de datos**
3. **Configura la lista blanca de IPs**
4. **Obtén la cadena de conexión**
5. **Actualiza el archivo .env**
   ```
   MONGODB_URI=mongodb+srv://usuario:contraseña@cluster0.mongodb.net/construccion-reportes
   ```

## Solución de problemas comunes

### Error de conexión a WhatsApp

- **Problema**: "Error: Failed to launch the browser process"
- **Solución**: Verifica que todas las dependencias estén instaladas

```bash
sudo apt update
sudo apt install -y gconf-service libgbm-dev libasound2 libatk1.0-0 libatk-bridge2.0-0 libc6 libcairo2 libcups2 libdbus-1-3 libexpat1 libfontconfig1 libgcc1 libgconf-2-4 libgdk-pixbuf2.0-0 libglib2.0-0 libgtk-3-0 libnspr4 libpango-1.0-0 libpangocairo-1.0-0 libstdc++6 libx11-6 libx11-xcb1 libxcb1 libxcomposite1 libxcursor1 libxdamage1 libxext6 libxfixes3 libxi6 libxrandr2 libxrender1 libxss1 libxtst6 ca-certificates fonts-liberation libappindicator1 libnss3 lsb-release xdg-utils wget
```

### Error de transcripción con OpenAI

- **Problema**: "Error: Request failed with status code 401"
- **Solución**: Verifica tu API key de OpenAI

```bash
# Comprueba que la variable de entorno esté correcta
nano .env
```

### El bot no se mantiene ejecutando

- **Problema**: El bot se cierra al cerrar la terminal
- **Solución**: Usa PM2 o screen/tmux

```bash
# Opción 1: PM2
npm install -g pm2
pm2 start index.js --name whatsapp-bot
pm2 save
pm2 startup

# Opción 2: Screen
sudo apt install screen
screen -S whatsapp-bot
node index.js
# Para desconectar: Ctrl+A, luego D
# Para reconectar: screen -r whatsapp-bot
```

### Errores de conectividad intermitente

- **Problema**: El bot se desconecta frecuentemente
- **Solución**: Implementa reintentos y notificaciones

```javascript
// Añade este código a index.js
client.on("disconnected", (reason) => {
  console.log("Cliente desconectado:", reason);
  // Reconectar después de 10 segundos
  setTimeout(() => {
    console.log("Intentando reconectar...");
    client.initialize();
  }, 10000);
});
```
