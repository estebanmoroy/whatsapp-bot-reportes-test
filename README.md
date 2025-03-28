# Bot de WhatsApp para Reportes de Construcción

Este proyecto implementa un bot de WhatsApp que permite a los contratistas enviar reportes diarios mediante mensajes de audio. El bot transcribe automáticamente los audios, extrae información estructurada, y genera un reporte organizado que se almacena en una base de datos y se puede visualizar a través de un dashboard web.

## Características principales

- Recepción y procesamiento de mensajes de audio de WhatsApp
- Transcripción automática de audio a texto mediante OpenAI Whisper
- Análisis y estructuración de reportes mediante GPT-4
- Almacenamiento de reportes en MongoDB
- Dashboard web simple para visualizar los reportes
- Funcionamiento específico para un grupo de WhatsApp designado
- Control de acceso y sistema anti-spam (cooldown)

## Requisitos previos

- Node.js (v14 o superior)
- MongoDB (local o en la nube)
- Cuenta de OpenAI para APIs de procesamiento
- Número de teléfono registrado en WhatsApp

## Instalación

1. Clona este repositorio:

```bash
git clone https://github.com/tu-usuario/whatsapp-construccion-bot.git
cd whatsapp-construccion-bot
```

2. Instala las dependencias:

```bash
npm install
```

3. Crea un archivo `.env` con la siguiente configuración:

```
OPENAI_API_KEY=tu_api_key_de_openai
MONGODB_URI=mongodb://localhost:27017/construccion-reportes
PORT=3000
```

4. Crea la carpeta para almacenar los audios:

```bash
mkdir audios
```

## Configuración inicial

1. Configura el ID del grupo objetivo:

   - Modifica la constante `GRUPO_OBJETIVO` en `index.js` con el ID del grupo de WhatsApp
   - Para obtener el ID, inicia el bot y envía el mensaje `!grupoid` en el grupo deseado

2. (Opcional) Configura la lista de usuarios autorizados:
   - Añade los IDs de usuario (formato `1234567890@c.us`) a la lista `USUARIOS_AUTORIZADOS` en `index.js`
   - Si la lista está vacía, cualquier miembro del grupo podrá usar el bot

## Uso

1. Inicia el bot:

```bash
node index.js
```

2. Escanea el código QR que aparece en la terminal con WhatsApp

3. Una vez conectado, el bot estará listo para procesar mensajes en el grupo configurado

4. Comandos disponibles en el grupo:

   - `!grupoid` - Muestra el ID del grupo actual
   - `ayuda` o `?` - Muestra instrucciones para enviar reportes

5. Para enviar un reporte, los contratistas simplemente envían un mensaje de audio al grupo

6. El dashboard web estará disponible en `http://localhost:3000/reportes`

## Estructura del proyecto

- `index.js` - Archivo principal del bot
- `audios/` - Carpeta donde se almacenan los archivos de audio
- `.env` - Archivo de configuración de variables de entorno

## Estructura de los reportes

Cada reporte se estructura con la siguiente información:

- Avance: Progreso del trabajo
- Problemas: Obstáculos o retrasos encontrados
- Materiales: Materiales utilizados o requeridos
- Personal: Número de trabajadores presentes
- Clima: Condiciones climáticas relevantes
- Seguridad: Incidentes o medidas de seguridad
- Siguientes pasos: Plan para el día siguiente

## Despliegue en producción

Para desplegar en producción, se recomienda:

1. Utilizar PM2 para mantener el bot funcionando:

```bash
npm install -g pm2
pm2 start index.js --name whatsapp-bot
pm2 save
pm2 startup
```

2. Configurar un servidor web como Nginx como proxy inverso
3. Implementar HTTPS para seguridad
4. Configurar respaldos automáticos de la base de datos

## Solución de problemas

- **Error de conexión a WhatsApp**: Asegúrate de tener una conexión estable y reinicia el bot
- **Errores de Puppeteer**: Verifica que todas las dependencias estén instaladas
- **Errores de transcripción**: Verifica tu API key de OpenAI y el formato de audio
- **El bot no responde en el grupo**: Verifica que el ID del grupo sea correcto

## Limitaciones

- El bot utiliza whatsapp-web.js, que no es una solución oficial de WhatsApp
- WhatsApp podría cambiar su API o detectar la automatización
- Se recomienda usar un número de teléfono exclusivo para el bot

## Licencia

Este proyecto está bajo la licencia MIT. Ver archivo LICENSE para más detalles.
