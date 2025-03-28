# Arquitectura del Bot de WhatsApp para Reportes de Construcción

## Visión general

Este documento describe la arquitectura y el flujo de funcionamiento del bot de WhatsApp para reportes de construcción. El sistema permite a los contratistas en una obra enviar mensajes de audio que son procesados automáticamente para generar reportes estructurados.

## Componentes principales

### 1. Cliente de WhatsApp (whatsapp-web.js)

El bot utiliza la biblioteca `whatsapp-web.js` que emula una sesión de WhatsApp Web a través de un navegador controlado por Puppeteer. Esta biblioteca:

- Establece la conexión con WhatsApp mediante un código QR
- Mantiene la sesión activa
- Gestiona eventos como recepción de mensajes, cambios de estado, etc.
- Permite enviar y recibir mensajes, incluyendo medios como audio

### 2. Procesamiento de audio

Para la transcripción de audio, el sistema utiliza:

- API de OpenAI Whisper a través del SDK oficial de OpenAI
- Capacidad para procesar diferentes formatos de audio, principalmente OGG (formato nativo de WhatsApp)
- Sistema de almacenamiento local para los archivos de audio antes de procesarlos

### 3. Análisis de texto

Para estructurar los reportes a partir de las transcripciones, se utiliza:

- API de OpenAI GPT-4 con formato de respuesta JSON
- Prompt engineering específico para extraer información relevante en el contexto de construcción
- Estructura predefinida para categorizar la información (avance, problemas, materiales, etc.)

### 4. Almacenamiento de datos

Para persistir la información, el sistema usa:

- MongoDB como base de datos NoSQL
- Mongoose como ODM (Object Document Mapper)
- Esquema definido para almacenar los reportes con sus metadatos

### 5. Interfaz web

Para visualizar los reportes:

- Servidor Express simple que sirve una página HTML
- Endpoint para listar los reportes almacenados
- Visualización básica de la información estructurada

## Flujo de datos

1. **Recepción del mensaje**:

   - El contratista envía un mensaje de audio al grupo de WhatsApp configurado
   - El bot detecta el mensaje si proviene del grupo objetivo

2. **Verificación y control**:

   - Se verifica si el remitente está autorizado (opcional)
   - Se comprueba si el usuario no está en periodo de cooldown
   - Se valida que el mensaje contenga un archivo de audio

3. **Procesamiento del audio**:

   - Se descarga el archivo de audio
   - Se almacena localmente con un nombre único
   - Se envía a la API de OpenAI para transcripción

4. **Análisis de la transcripción**:

   - El texto transcrito se envía a GPT-4
   - Se utiliza un prompt especializado para extraer información estructurada
   - Se recibe un JSON con la información categorizada

5. **Almacenamiento**:

   - Se crea un nuevo documento en MongoDB
   - Se guarda tanto la transcripción original como la información estructurada
   - Se registran metadatos como fecha, contratista, etc.

6. **Respuesta al usuario**:

   - Se genera un resumen del reporte procesado
   - Se envía como mensaje al grupo de WhatsApp
   - Se establece un período de cooldown para el usuario

7. **Visualización**:
   - Los reportes se pueden consultar a través del dashboard web
   - Se muestran en orden cronológico inverso
   - Se presentan tanto los datos estructurados como la transcripción completa

## Control de acceso y seguridad

- **Filtrado por grupo**: Solo se procesan mensajes del grupo configurado
- **Lista de permitidos**: Opción para limitar quién puede usar el bot dentro del grupo
- **Sistema anti-spam**: Mecanismo de cooldown para evitar sobrecarga
- **Manejo de errores**: Captura y registro de errores para evitar caídas del servicio

## Consideraciones técnicas

- **Rendimiento**: El procesamiento de audio puede tomar tiempo dependiendo del tamaño
- **Escalabilidad**: La arquitectura actual es adecuada para grupos pequeños a medianos
- **Persistencia**: La sesión de WhatsApp se mantiene mediante LocalAuth
- **Dependencias externas**: OpenAI y MongoDB son críticas para el funcionamiento

## Limitaciones conocidas

- **API no oficial**: whatsapp-web.js no es una solución oficial y podría dejar de funcionar si WhatsApp cambia su sistema
- **Disponibilidad**: Requiere que el servidor esté siempre activo
- **Procesamiento secuencial**: No hay procesamiento paralelo de múltiples audios
- **Costos variables**: El uso de APIs de OpenAI implica costos que varían según el volumen

## Posibles mejoras futuras

- Implementación de sistema de colas para procesamiento asíncrono
- Almacenamiento en la nube para los archivos de audio
- Autenticación para el dashboard web
- Generación de reportes en PDF/Excel
- Análisis estadístico de los reportes generados
- Integración con sistemas de gestión de proyectos de construcción
