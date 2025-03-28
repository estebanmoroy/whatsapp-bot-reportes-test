// index.js - Bot para reportes de construcción usando whatsapp-web.js
require("dotenv").config();
const { Client, LocalAuth, MessageMedia } = require("whatsapp-web.js");
const qrcode = require("qrcode-terminal");
const fs = require("fs");
const path = require("path");
const { OpenAI } = require("openai");
const mongoose = require("mongoose");
const express = require("express");

// ID del grupo
const GRUPO_OBJETIVO = "120363418875627490@g.us";

// Lista de usuarios autorizados (opcional)
const USUARIOS_AUTORIZADOS = [
    // Lista de IDs de usuario con formato '1234567890@c.us'
    // Déjala vacía si quieres permitir a cualquier usuario del grupo
];

// Sistema anti-spam (opcional)
const cooldowns = new Map();
const COOLDOWN_TIME = 60000; // 1 minuto en milisegundos

// Inicializar aplicación Express para el dashboard
const app = express();
const PORT = process.env.PORT || 3000;

// Configurar OpenAI para transcripción y procesamiento
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

// Conectar a MongoDB
mongoose
    .connect(process.env.MONGODB_URI, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
    })
    .then(() => {
        console.log("Conectado a MongoDB");
    })
    .catch((err) => {
        console.error("Error conectando a MongoDB:", err);
    });

// Esquema para los reportes
const reportSchema = new mongoose.Schema({
    contratista: {
        nombre: String,
        telefono: String,
    },
    proyecto: String,
    fecha: { type: Date, default: Date.now },
    audioPath: String,
    transcripcion: String,
    tipoReporte: { type: String, enum: ["audio", "texto"], default: "audio" },
    reporte: {
        avance: String,
        problemas: String,
        materiales: String,
        personal: String,
        clima: String,
        seguridad: String,
        siguientesPasos: String,
    },
});

const Report = mongoose.model("Report", reportSchema);

// Crear carpeta para audios si no existe
const AUDIO_PATH = path.join(__dirname, "audios");
if (!fs.existsSync(AUDIO_PATH)) {
    fs.mkdirSync(AUDIO_PATH, { recursive: true });
}

// Inicializar cliente de WhatsApp
const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        args: ["--no-sandbox"],
    },
});

// Evento cuando se genera el código QR
client.on("qr", (qr) => {
    console.log("QR RECIBIDO, escanea con WhatsApp:");
    qrcode.generate(qr, { small: true });
});

// Evento cuando el cliente está listo
client.on("ready", () => {
    console.log("Cliente de WhatsApp listo y conectado!");
});

// Manejar mensajes entrantes
client.on("message", async (message) => {
    console.log(`Mensaje recibido de ${message.from}`);

    // Comando para obtener ID del grupo (útil para configuración inicial)
    if (message.body === "!grupoid") {
        const isGroup = message.from.endsWith("@g.us");
        if (isGroup) {
            await message.reply(
                `ID de este grupo: ${message.from}\n\nCópialo y configúralo como GRUPO_OBJETIVO en tu código.`
            );
        } else {
            await message.reply(
                "Este comando solo funciona en grupos. Por favor, úsalo dentro del grupo que quieres configurar."
            );
        }
        return;
    }

    try {
        // Solo procesar mensajes del grupo objetivo
        if (message.from === GRUPO_OBJETIVO) {
            console.log("Mensaje del grupo objetivo detectado");

            // Verificar usuario autorizado (si la lista no está vacía)
            const sender = message.author || message.from;
            if (USUARIOS_AUTORIZADOS.length > 0 && !USUARIOS_AUTORIZADOS.includes(sender)) {
                console.log(`Usuario no autorizado: ${sender}`);
                return;
            }

            // Verificar cooldown
            const currentTime = Date.now();
            if (cooldowns.has(sender)) {
                const timeLeft = cooldowns.get(sender) - currentTime;
                if (timeLeft > 0) {
                    console.log(`Usuario ${sender} en cooldown. Tiempo restante: ${Math.ceil(timeLeft / 1000)}s`);
                    return;
                }
            }

            // Si el mensaje tiene un audio adjunto
            if (message.hasMedia && message._data.mimetype && message._data.mimetype.startsWith("audio")) {
                // Procesar audio como antes
                // Obtener información del remitente
                const sender = message.author || message.from;
                const senderName = message._data.notifyName || "Contratista";

                // Enviar confirmación
                await message.reply("Recibimos tu audio. Estamos procesando tu reporte...");

                // Descargar el archivo de audio
                const media = await message.downloadMedia();

                // Guardar el audio en el servidor
                const fileName = `audio_${Date.now()}.ogg`;
                const filePath = path.join(AUDIO_PATH, fileName);

                // Convertir el media.data (base64) a un archivo
                fs.writeFileSync(filePath, Buffer.from(media.data, "base64"));
                console.log(`Audio guardado en ${filePath}`);

                // Transcribir el audio
                const transcripcion = await transcribirAudio(filePath);
                console.log("Transcripción:", transcripcion);

                // Procesar la transcripción para generar el reporte estructurado
                const reporteEstructurado = await generarReporteEstructurado(transcripcion);

                // Guardar en la base de datos
                const reporte = new Report({
                    contratista: {
                        nombre: senderName,
                        telefono: sender,
                    },
                    proyecto: "Proyecto Principal", // También podría ser dinámico
                    audioPath: filePath,
                    transcripcion: transcripcion,
                    tipoReporte: "audio",
                    reporte: reporteEstructurado,
                });

                await reporte.save();

                // Establecer cooldown después de procesar audio
                cooldowns.set(sender, currentTime + COOLDOWN_TIME);

                // Enviar confirmación con resumen del reporte
                const resumen = `✅ *Tu reporte ha sido procesado:*
          
  📊 *Avance*: ${reporteEstructurado.avance.substring(0, 80)}...
  🚧 *Problemas*: ${reporteEstructurado.problemas ? "✓" : "✗"}
  👷 *Personal*: ${reporteEstructurado.personal}
  📋 *Siguientes pasos*: ${reporteEstructurado.siguientesPasos.substring(0, 80)}...
  
  Tu reporte completo está disponible en el sistema.`;

                await message.reply(resumen);
            }
            // NUEVA SECCIÓN: Procesar mensajes de texto como reportes
            else if (message.body.toLowerCase().startsWith("!reporte")) {
                const sender = message.author || message.from;
                const senderName = message._data.notifyName || "Contratista";

                // Extraer el contenido del reporte (todo excepto el comando !reporte)
                const textoReporte = message.body.substring("!reporte".length).trim();

                // Verificar que el reporte tenga contenido
                if (textoReporte.length < 10) {
                    await message.reply(
                        "El reporte es demasiado corto. Por favor proporciona más detalles sobre el avance, problemas, personal, etc."
                    );
                    return;
                }

                // Enviar confirmación
                await message.reply("Recibimos tu reporte en texto. Procesando...");

                // Procesar el texto para generar el reporte estructurado
                const reporteEstructurado = await generarReporteEstructurado(textoReporte);

                // Guardar en la base de datos
                const reporte = new Report({
                    contratista: {
                        nombre: senderName,
                        telefono: sender,
                    },
                    proyecto: "Proyecto Principal",
                    transcripcion: textoReporte,
                    tipoReporte: "texto",
                    reporte: reporteEstructurado,
                });

                await reporte.save();

                // Establecer cooldown después de procesar
                cooldowns.set(sender, currentTime + COOLDOWN_TIME);

                // Enviar confirmación con resumen del reporte
                const resumen = `✅ *Tu reporte de texto ha sido procesado:*
          
  📊 *Avance*: ${reporteEstructurado.avance.substring(0, 80)}...
  🚧 *Problemas*: ${reporteEstructurado.problemas ? "✓" : "✗"}
  👷 *Personal*: ${reporteEstructurado.personal}
  📋 *Siguientes pasos*: ${reporteEstructurado.siguientesPasos.substring(0, 80)}...
  
  Tu reporte completo está disponible en el sistema.`;

                await message.reply(resumen);
            }
            // Comandos de ayuda dentro del grupo
            else if (message.body.toLowerCase().includes("ayuda") || message.body === "?") {
                // Responder con instrucciones de ayuda actualizadas para incluir reportes por texto
                await message.reply(`*Instrucciones para enviar tu reporte diario:*
          
  📢 *OPCIÓN 1: Reporte por Audio*
  1️⃣ Graba un mensaje de audio con tu reporte
  2️⃣ Incluye información sobre:
     - Avance del día
     - Problemas encontrados
     - Materiales utilizados o faltantes
     - Personal trabajando
     - Clima (si afecta el trabajo)
     - Incidentes de seguridad
     - Plan para mañana
  3️⃣ Envía el audio y espera la confirmación

  ✍️ *OPCIÓN 2: Reporte por Texto*
  1️⃣ Escribe !reporte seguido de tu informe completo
  2️⃣ Ejemplo: !reporte Hoy avanzamos un 30% en la cimentación. Tuvimos 8 trabajadores...
  3️⃣ Incluye la misma información que en los reportes por audio`);
            }
        }
    } catch (error) {
        console.error("Error procesando mensaje:", error);
        // Solo responder con error si es del grupo objetivo
        if (message.from === GRUPO_OBJETIVO) {
            await message.reply(
                "Lo siento, hubo un error procesando tu mensaje. Por favor intenta de nuevo más tarde."
            );
        }
    }
});

// Función para transcribir el audio
async function transcribirAudio(audioPath) {
    try {
        const response = await openai.audio.transcriptions.create({
            file: fs.createReadStream(audioPath),
            model: "whisper-1",
        });

        return response.text;
    } catch (error) {
        console.error("Error al transcribir audio:", error);
        throw error;
    }
}

// Función para generar reporte estructurado
async function generarReporteEstructurado(transcripcion) {
    try {
        const prompt = `
    Por favor, organiza el siguiente reporte de construcción en las siguientes categorías:
    
    Reporte: ${transcripcion}
    
    Extrae la siguiente información y preséntala en EXACTAMENTE este formato JSON:
    
    {
      "avance": "Resumen del progreso del trabajo",
      "problemas": "Cualquier problema o retraso encontrado",
      "materiales": "Materiales utilizados o requeridos",
      "personal": "Número de trabajadores presentes",
      "clima": "Condiciones climáticas que afectan el trabajo",
      "seguridad": "Problemas o medidas de seguridad",
      "siguientesPasos": "Plan para el próximo día"
    }
    
    Es MUY IMPORTANTE que uses EXACTAMENTE los mismos nombres de campo en minúsculas y que cada campo sea un string simple.
    No uses estructuras anidadas ni arrays. Cada campo debe contener directamente la información como texto plano.
    Si no encuentras información para algún campo, simplemente déjalo como string vacío.
    `;

        const response = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                {
                    role: "system",
                    content:
                        "Eres un asistente especializado en analizar reportes de construcción y extraer información clave de forma estructurada. Debes seguir EXACTAMENTE el formato solicitado sin añadir estructuras adicionales.",
                },
                {
                    role: "user",
                    content: prompt,
                },
            ],
            response_format: { type: "json_object" },
        });

        console.log("Respuesta de ChatGPT:", JSON.stringify(response, null, 2));

        const contenidoJSON = JSON.parse(response.choices[0].message.content);
        console.log("Contenido del reporte estructurado:", JSON.stringify(contenidoJSON, null, 2));

        // Asegurarse de que el JSON tenga la estructura correcta
        const reporteFormateado = {
            avance: extraerTextoPlano(contenidoJSON.avance) || "No especificado",
            problemas: extraerTextoPlano(contenidoJSON.problemas) || "Ninguno reportado",
            materiales: extraerTextoPlano(contenidoJSON.materiales) || "No especificado",
            personal: extraerTextoPlano(contenidoJSON.personal) || "No especificado",
            clima: extraerTextoPlano(contenidoJSON.clima) || "No especificado",
            seguridad: extraerTextoPlano(contenidoJSON.seguridad) || "No especificado",
            siguientesPasos: extraerTextoPlano(contenidoJSON.siguientesPasos) || "No especificado",
        };

        return reporteFormateado;
    } catch (error) {
        console.error("Error al generar reporte estructurado:", error);
        // En caso de error, devolver un reporte con valores por defecto
        return {
            avance: "Error al procesar el reporte",
            problemas: "Error al procesar el reporte",
            materiales: "Error al procesar el reporte",
            personal: "Error al procesar el reporte",
            clima: "Error al procesar el reporte",
            seguridad: "Error al procesar el reporte",
            siguientesPasos: "Error al procesar el reporte",
        };
    }
}

// Función auxiliar para extraer texto plano de posibles objetos complejos
function extraerTextoPlano(valor) {
    if (!valor) return "";

    // Si es un string, devolverlo directamente
    if (typeof valor === "string") return valor;

    // Si es un objeto o array, convertirlo a string
    if (typeof valor === "object") {
        // Intentar extraer valores de objetos anidados o arrays
        if (Array.isArray(valor)) {
            return valor.map((item) => (typeof item === "string" ? item : JSON.stringify(item))).join(", ");
        } else {
            // Si es un objeto con propiedades, intentar concatenar los valores
            const valores = Object.values(valor)
                .map((v) => (typeof v === "string" ? v : JSON.stringify(v)))
                .filter((v) => v && v !== "{}");

            if (valores.length > 0) {
                return valores.join(". ");
            } else {
                return JSON.stringify(valor);
            }
        }
    }

    // Para cualquier otro tipo
    return String(valor);
}

// Modificar el HTML para mostrar el tipo de reporte
app.get("/reportes", async (req, res) => {
    try {
        const reportes = await Report.find().sort({ fecha: -1 });

        // Enviar una página HTML simple con los reportes
        let html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Reportes de Construcción</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        h1 { color: #333; }
        .reporte { border: 1px solid #ddd; padding: 15px; margin-bottom: 15px; border-radius: 5px; }
        .seccion { margin: 10px 0; }
        .etiqueta { font-weight: bold; }
        .tipo-reporte { display: inline-block; padding: 3px 8px; border-radius: 4px; font-size: 12px; margin-left: 10px; }
        .tipo-audio { background-color: #e6f7ff; color: #0066cc; }
        .tipo-texto { background-color: #f6ffed; color: #52c41a; }
      </style>
    </head>
    <body>
      <h1>Reportes de Construcción</h1>
    `;

        reportes.forEach((reporte) => {
            html += `
      <div class="reporte">
        <h2>
          Contratista: ${reporte.contratista.nombre} (${reporte.contratista.telefono})
          <span class="tipo-reporte tipo-${reporte.tipoReporte || "audio"}">${
                reporte.tipoReporte === "texto" ? "Texto" : "Audio"
            }</span>
        </h2>
        <p>Fecha: ${new Date(reporte.fecha).toLocaleString()}</p>
        
        <div class="seccion">
          <span class="etiqueta">Avance:</span> ${reporte.reporte.avance}
        </div>
        
        <div class="seccion">
          <span class="etiqueta">Problemas:</span> ${reporte.reporte.problemas || "Ninguno reportado"}
        </div>
        
        <div class="seccion">
          <span class="etiqueta">Materiales:</span> ${reporte.reporte.materiales || "No especificado"}
        </div>
        
        <div class="seccion">
          <span class="etiqueta">Personal:</span> ${reporte.reporte.personal || "No especificado"}
        </div>
        
        <div class="seccion">
          <span class="etiqueta">Clima:</span> ${reporte.reporte.clima || "No especificado"}
        </div>
        
        <div class="seccion">
          <span class="etiqueta">Seguridad:</span> ${reporte.reporte.seguridad || "No especificado"}
        </div>
        
        <div class="seccion">
          <span class="etiqueta">Siguientes Pasos:</span> ${reporte.reporte.siguientesPasos || "No especificado"}
        </div>
        
        <div class="seccion">
          <span class="etiqueta">Transcripción completa:</span>
          <p>${reporte.transcripcion}</p>
        </div>
      </div>
      `;
        });

        html += `
    </body>
    </html>
    `;

        res.send(html);
    } catch (error) {
        console.error("Error al obtener reportes:", error);
        res.status(500).send("Error al cargar los reportes");
    }
});

// Iniciar el servidor web
app.listen(PORT, () => {
    console.log(`Servidor web ejecutándose en puerto ${PORT}`);
});

// Iniciar el cliente de WhatsApp
client.initialize();

// Manejar cierre
process.on("SIGINT", async () => {
    console.log("Cerrando aplicación...");
    await client.destroy();
    process.exit(0);
});
