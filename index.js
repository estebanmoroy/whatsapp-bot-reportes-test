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
                    reporte: reporteEstructurado,
                });

                await reporte.save();

                // Establecer cooldown después de procesar audio
                cooldowns.set(sender, currentTime + COOLDOWN_TIME);

                // Enviar confirmación con resumen del reporte
                const resumen = `✅ *Tu reporte ha sido procesado:*
          
                📊 *Avance*: ${
                    reporteEstructurado.avance ? reporteEstructurado.avance.substring(0, 80) + "..." : "No especificado"
                }
                🚧 *Problemas*: ${reporteEstructurado.problemas ? "✓" : "✗"}
                👷 *Personal*: ${reporteEstructurado.personal || "No especificado"}
                📋 *Siguientes pasos*: ${
                    reporteEstructurado.siguientesPasos
                        ? reporteEstructurado.siguientesPasos.substring(0, 80) + "..."
                        : "No especificado"
                }
                
                Tu reporte completo está disponible en el sistema.`;

                await message.reply(resumen);
            }
            // Comandos de ayuda dentro del grupo
            else if (message.body.toLowerCase().includes("ayuda") || message.body === "?") {
                // Responder con instrucciones de ayuda
                await message.reply(`*Instrucciones para enviar tu reporte diario:*
          
  1️⃣ Graba un mensaje de audio con tu reporte
  2️⃣ Incluye información sobre:
     - Avance del día
     - Problemas encontrados
     - Materiales utilizados o faltantes
     - Personal trabajando
     - Clima (si afecta el trabajo)
     - Incidentes de seguridad
     - Plan para mañana
  
  3️⃣ Envía el audio y espera la confirmación`);
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
// Modifica la función generarReporteEstructurado para imprimir la respuesta de ChatGPT
async function generarReporteEstructurado(transcripcion) {
    try {
        const prompt = `
    Por favor, organiza el siguiente reporte de construcción en las siguientes categorías:
    
    Reporte: ${transcripcion}
    
    Extrae la siguiente información y preséntala en formato JSON:
    
    1. Avance: Resumen del progreso del trabajo
    2. Problemas: Cualquier problema o retraso encontrado
    3. Materiales: Materiales utilizados o requeridos
    4. Personal: Número de trabajadores presentes
    5. Clima: Condiciones climáticas que afectan el trabajo
    6. Seguridad: Problemas o medidas de seguridad
    7. SiguientesPasos: Plan para el próximo día
    `;

        const response = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                {
                    role: "system",
                    content:
                        "Eres un asistente especializado en analizar reportes de construcción y extraer información clave de forma estructurada.",
                },
                {
                    role: "user",
                    content: prompt,
                },
            ],
            response_format: { type: "json_object" },
        });

        // Imprimir la respuesta completa en la consola
        console.log("Respuesta de ChatGPT:", JSON.stringify(response, null, 2));

        // También imprimir solo el contenido del mensaje para más claridad
        console.log("Contenido del reporte estructurado:", response.choices[0].message.content);

        // Parsear la respuesta a un objeto JSON
        const reporteEstructurado = JSON.parse(response.choices[0].message.content);

        // Verificar si el reporte tiene la estructura esperada
        console.log("Estructura del reporte procesado:", Object.keys(reporteEstructurado));

        return reporteEstructurado;
    } catch (error) {
        console.error("Error al generar reporte estructurado:", error);

        // Si hay un error de parsing JSON, imprimir el contenido que causó el problema
        if (error instanceof SyntaxError && error.message.includes("JSON")) {
            console.error("Contenido que causó el error de parsing:", response?.choices[0]?.message?.content);
        }

        // Devolver un objeto con estructura vacía para evitar errores
        return {
            avance: "No se pudo procesar",
            problemas: "",
            materiales: "",
            personal: "No especificado",
            clima: "",
            seguridad: "",
            siguientesPasos: "No especificado",
        };
    }
}

// Configurar dashboard web
app.set("view engine", "ejs");
app.use(express.static("public"));

// Ruta para ver reportes
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
      </style>
    </head>
    <body>
      <h1>Reportes de Construcción</h1>
    `;

        reportes.forEach((reporte) => {
            html += `
      <div class="reporte">
        <h2>Contratista: ${reporte.contratista.nombre} (${reporte.contratista.telefono})</h2>
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
