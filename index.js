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
        // useNewUrlParser: true,
        // useUnifiedTopology: true,
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
        telefono: String, // ID del usuario/autor del mensaje
    },
    proyecto: String, // Podría ser el nombre general o descripción
    numeroProyecto: String, // Nuevo campo: Número específico del proyecto (ej: 730-0014)
    numeroPermisoTrabajo: String, // Nuevo campo: Número del permiso de trabajo
    fecha: { type: Date, default: Date.now },
    audioPath: String, // Solo para reportes de audio
    transcripcion: String, // Transcripción del audio o texto del reporte
    tipoReporte: { type: String, enum: ["audio", "texto"], required: true },
    reporteDetallado: {
        // Cambiado de 'reporte' a 'reporteDetallado' para claridad
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
        args: ["--no-sandbox", "--disable-setuid-sandbox"], // Añadido disable-setuid-sandbox por si acaso
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
    console.log(`Mensaje recibido de ${message.from} (autor: ${message.author || "N/A"})`);

    // Comando para obtener ID del grupo (útil para configuración inicial)
    if (message.body === "!grupoid") {
        const chat = await message.getChat();
        if (chat.isGroup) {
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

            const chat = await message.getChat(); // Obtener chat para info del grupo/usuario
            const contact = await message.getContact(); // Obtener info del contacto que envió
            const senderId = message.author || message.from; // El ID único del remitente
            const senderName = contact.pushname || contact.name || `Usuario (${senderId.split("@")[0]})`; // Nombre visible

            // Verificar usuario autorizado (si la lista no está vacía)
            if (USUARIOS_AUTORIZADOS.length > 0 && !USUARIOS_AUTORIZADOS.includes(senderId)) {
                console.log(`Usuario no autorizado: ${senderName} (${senderId})`);
                return; // Ignorar mensaje
            }

            // Verificar cooldown
            const currentTime = Date.now();
            if (cooldowns.has(senderId)) {
                const timeLeft = cooldowns.get(senderId) - currentTime;
                if (timeLeft > 0) {
                    console.log(
                        `Usuario ${senderName} (${senderId}) en cooldown. Tiempo restante: ${Math.ceil(
                            timeLeft / 1000
                        )}s`
                    );
                    // Opcional: enviar mensaje al usuario indicando el cooldown
                    // await message.reply(`Por favor espera ${Math.ceil(timeLeft / 1000)}s antes de enviar otro reporte.`);
                    return; // Ignorar mensaje
                }
            }

            let tipoReporte = null;
            let contenidoParaProcesar = null;
            let audioFilePath = null;

            // Si el mensaje tiene un audio adjunto
            if (
                (message.hasMedia && message.type === "ptt") ||
                (message._data.mimetype && message._data.mimetype.startsWith("audio"))
            ) {
                console.log("Procesando mensaje de audio...");
                tipoReporte = "audio";

                await message.reply(`Recibimos tu audio, ${senderName}. Estamos procesando tu reporte... 🎧`);

                const media = await message.downloadMedia();
                if (!media || !media.data) {
                    throw new Error("No se pudo descargar el archivo adjunto.");
                }

                const fileName = `audio_${senderId.split("@")[0]}_${Date.now()}.ogg`;
                audioFilePath = path.join(AUDIO_PATH, fileName);
                fs.writeFileSync(audioFilePath, Buffer.from(media.data, "base64"));
                console.log(`Audio guardado en ${audioFilePath}`);

                contenidoParaProcesar = await transcribirAudio(audioFilePath);
                console.log("Transcripción:", contenidoParaProcesar);
            }
            // Si es un mensaje de texto que inicia con !reporte
            else if (message.body.toLowerCase().startsWith("!reporte")) {
                console.log("Procesando mensaje de texto con comando !reporte...");
                tipoReporte = "texto";
                contenidoParaProcesar = message.body.substring("!reporte".length).trim();

                if (contenidoParaProcesar.length < 20) {
                    // Aumentar un poco el mínimo
                    await message.reply(
                        "El reporte de texto parece muy corto. Por favor, incluye detalles sobre: Número de proyecto, Permiso de trabajo (si aplica), Avance, Problemas, Materiales, Personal, Clima, Seguridad y Siguientes pasos."
                    );
                    return;
                }
                await message.reply(`Recibimos tu reporte en texto, ${senderName}. Procesando... ✍️`);
            }
            // Comandos de ayuda dentro del grupo
            else if (message.body.toLowerCase() === "ayuda" || message.body === "?") {
                await message.reply(`*Instrucciones para enviar tu reporte diario:*

*IMPORTANTE:* Menciona siempre el *Número de Proyecto* (ej: 730-0014) y el *Número de Permiso de Trabajo* (si aplica) al inicio de tu reporte.

📢 *OPCIÓN 1: Reporte por Audio* 🎧
1️⃣ Graba un mensaje de audio *en español* con tu reporte.
2️⃣ Comienza diciendo el Número de Proyecto y Permiso.
3️⃣ Luego, incluye información sobre:
    - Avance del día
    - Problemas encontrados
    - Materiales utilizados o faltantes
    - Personal trabajando
    - Clima (si afecta el trabajo)
    - Incidentes de seguridad
    - Plan para mañana
4️⃣ Envía el audio y espera la confirmación.

✍️ *OPCIÓN 2: Reporte por Texto* 📄
1️⃣ Escribe \`!reporte\` seguido de tu informe completo *en español*.
2️⃣ Ejemplo: \`!reporte Proyecto 730-0014, Permiso PT-123. Hoy avanzamos un 30% en la cimentación. Tuvimos 8 trabajadores...\`
3️⃣ Incluye toda la información solicitada.
4️⃣ Envía el mensaje y espera la confirmación.`);
                return; // No continuar procesando como reporte
            }

            // Si tenemos contenido para procesar (sea de audio o texto)
            if (contenidoParaProcesar && tipoReporte) {
                // Procesar la transcripción/texto para generar el reporte estructurado
                const datosExtraidos = await generarReporteEstructurado(contenidoParaProcesar);

                // Crear y guardar el reporte en la base de datos
                const nuevoReporte = new Report({
                    contratista: {
                        nombre: senderName,
                        telefono: senderId, // Guardamos el ID completo
                    },
                    proyecto: datosExtraidos.nombreProyecto || "Proyecto General", // Usar nombre si se extrae, sino default
                    numeroProyecto: datosExtraidos.numeroProyecto, // Campo específico
                    numeroPermisoTrabajo: datosExtraidos.numeroPermisoTrabajo, // Campo específico
                    audioPath: audioFilePath, // Será null si es reporte de texto
                    transcripcion: contenidoParaProcesar, // Texto original o transcripción
                    tipoReporte: tipoReporte,
                    reporteDetallado: datosExtraidos.reporteDetallado, // Objeto con los detalles
                });

                await nuevoReporte.save();
                console.log(`Reporte de ${senderName} (${tipoReporte}) guardado en la BD.`);

                // Establecer cooldown después de procesar exitosamente
                cooldowns.set(senderId, currentTime + COOLDOWN_TIME);

                // Enviar confirmación con resumen del reporte
                const resumen = `✅ *Reporte (${tipoReporte}) procesado exitosamente:*

🆔 *Proyecto:* ${datosExtraidos.numeroProyecto || "No especificado"}
📄 *Permiso:* ${datosExtraidos.numeroPermisoTrabajo || "No especificado"}
---
📊 *Avance*: ${datosExtraidos.reporteDetallado.avance}
🚧 *Problemas*: ${datosExtraidos.reporteDetallado.problemas}
🧰 *Materiales*: ${datosExtraidos.reporteDetallado.materiales}
👷 *Personal*: ${datosExtraidos.reporteDetallado.personal}
🌦️ *Clima*: ${datosExtraidos.reporteDetallado.clima}
🦺 *Seguridad*: ${datosExtraidos.reporteDetallado.seguridad}
📋 *Siguientes pasos*: ${datosExtraidos.reporteDetallado.siguientesPasos}`;

                await message.reply(resumen);
            }
            // Ignorar otros tipos de mensajes (imágenes, stickers, etc.) o texto no relevante
            else if (!message.body.toLowerCase().startsWith("ayuda") && message.body !== "?") {
                console.log(
                    `Mensaje de ${senderName} ignorado (tipo: ${message.type}, contenido: ${message.body.substring(
                        0,
                        50
                    )}...)`
                );
            }
        } // Fin if (message.from === GRUPO_OBJETIVO)
    } catch (error) {
        console.error("Error procesando mensaje:", error);
        // Solo responder con error si es del grupo objetivo y no es un error de cooldown
        if (message.from === GRUPO_OBJETIVO && !error.message.includes("cooldown")) {
            try {
                await message.reply(
                    `❌ Lo siento, ${
                        senderName || "usuario"
                    }. Hubo un error procesando tu reporte. Por favor verifica la información e intenta de nuevo. Si el problema persiste, contacta al administrador.`
                );
            } catch (replyError) {
                console.error("Error al enviar mensaje de error:", replyError);
            }
        }
    }
});

// Función para transcribir el audio especificando el idioma
async function transcribirAudio(audioPath) {
    try {
        console.log(`Transcribiendo audio: ${audioPath}`);
        const response = await openai.audio.transcriptions.create({
            file: fs.createReadStream(audioPath),
            model: "whisper-1",
            language: "es", // Especificar español para mejorar precisión
            response_format: "text", // Pedir texto plano directamente
        });
        console.log("Transcripción completada.");
        // Whisper puede devolver un objeto con 'text' o directamente el string
        return typeof response === "string" ? response : response.text;
    } catch (error) {
        console.error("Error al transcribir audio:", error.response ? error.response.data : error.message);
        throw new Error("Fallo en la transcripción del audio."); // Propagar un error más genérico
    }
}

// Función para generar reporte estructurado (incluyendo nuevos campos)
async function generarReporteEstructurado(textoReporte) {
    try {
        const prompt = `
        Analiza el siguiente reporte de construcción **en español**. Extrae la información clave y preséntala **EXCLUSIVAMENTE** en el siguiente formato JSON.
        **Reporte Original:**
        ${textoReporte}

        **Formato JSON Requerido (campos obligatorios, usa "" si no hay info):**
        {
          "numeroProyecto": "Extrae el número de proyecto (formato XXX-YYYY, ej: 730-0014, 520-0005). Si no se menciona, pon ''.",
          "numeroPermisoTrabajo": "Extrae el número de permiso de trabajo (ej: PT-123, OT-456). Si no se menciona, pon ''.",
          "nombreProyecto": "Extrae el nombre o descripción corta del proyecto si se menciona explícitamente, además del número. Si no, pon ''.",
          "reporteDetallado": {
            "avance": "Resumen del progreso y actividades realizadas hoy.",
            "problemas": "Problemas, obstáculos o retrasos encontrados.",
            "materiales": "Materiales usados, recibidos o necesitados.",
            "personal": "Número y/o tipo de personal presente.",
            "clima": "Condiciones climáticas y su impacto, si hubo.",
            "seguridad": "Incidentes, observaciones o medidas de seguridad.",
            "siguientesPasos": "Tareas planeadas para el próximo día o período."
          }
        }

        **Instrucciones IMPORTANTES:**
        1.  Devuelve **SOLAMENTE** el objeto JSON, sin texto introductorio ni explicaciones adicionales.
        2.  Mantén exactamente los nombres de los campos (claves) en minúsculas como se muestra.
        3.  Si no encuentras información específica para un campo dentro de 'reporteDetallado', déjalo como un string vacío "".
        4.  Presta especial atención a extraer 'numeroProyecto' y 'numeroPermisoTrabajo' si están presentes.
        5.  El idioma del reporte es español.
        `;

        const response = await openai.chat.completions.create({
            model: "gpt-4o-mini", // o el modelo que prefieras/tengas disponible
            messages: [
                {
                    role: "system",
                    content:
                        "Eres un asistente IA experto en procesar reportes de construcción en español. Tu tarea es extraer información específica y estructurarla STRICTAMENTE en el formato JSON solicitado, sin añadir nada más.",
                },
                {
                    role: "user",
                    content: prompt,
                },
            ],
            response_format: { type: "json_object" },
            temperature: 0.2, // Bajar temperatura para respuestas más consistentes
        });

        console.log("Respuesta cruda de OpenAI:", response.choices[0].message.content);

        // Parsear la respuesta JSON
        const contenidoJSON = JSON.parse(response.choices[0].message.content);
        console.log("Contenido JSON parseado:", JSON.stringify(contenidoJSON, null, 2));

        // Validar y formatear la estructura esperada
        const reporteDetallado = contenidoJSON.reporteDetallado || {}; // Asegurar que el objeto exista

        const datosFormateados = {
            numeroProyecto: extraerTextoPlano(contenidoJSON.numeroProyecto) || "No especificado",
            numeroPermisoTrabajo: extraerTextoPlano(contenidoJSON.numeroPermisoTrabajo) || "No especificado",
            nombreProyecto: extraerTextoPlano(contenidoJSON.nombreProyecto) || null, // Puede ser null si no se extrae
            reporteDetallado: {
                avance: extraerTextoPlano(reporteDetallado.avance) || "No reportado",
                problemas: extraerTextoPlano(reporteDetallado.problemas) || "Ninguno reportado",
                materiales: extraerTextoPlano(reporteDetallado.materiales) || "No reportado",
                personal: extraerTextoPlano(reporteDetallado.personal) || "No reportado",
                clima: extraerTextoPlano(reporteDetallado.clima) || "No reportado",
                seguridad: extraerTextoPlano(reporteDetallado.seguridad) || "Sin incidentes reportados",
                siguientesPasos: extraerTextoPlano(reporteDetallado.siguientesPasos) || "No especificado",
            },
        };

        console.log("Datos formateados finales:", JSON.stringify(datosFormateados, null, 2));
        return datosFormateados;
    } catch (error) {
        console.error("Error al generar reporte estructurado:", error.response ? error.response.data : error.message);
        // Devolver estructura con error en caso de fallo
        return {
            numeroProyecto: "Error de procesamiento",
            numeroPermisoTrabajo: "Error de procesamiento",
            nombreProyecto: "Error de procesamiento",
            reporteDetallado: {
                avance: "Error",
                problemas: "Error",
                materiales: "Error",
                personal: "Error",
                clima: "Error",
                seguridad: "Error",
                siguientesPasos: "Error",
            },
        };
    }
}

// Función auxiliar para extraer texto plano (sin cambios necesarios aquí)
function extraerTextoPlano(valor) {
    if (valor === null || typeof valor === "undefined") return "";
    if (typeof valor === "string") return valor.trim();
    if (typeof valor === "number") return String(valor);
    // Si es objeto o array, intentar convertir a string representativo
    if (typeof valor === "object") {
        try {
            // Evitar "[object Object]" si es posible
            if (Array.isArray(valor)) {
                return valor.map((v) => extraerTextoPlano(v)).join(", ");
            }
            const str = JSON.stringify(valor);
            // Evitar devolver "{}" o "[]" si no aportan info
            if (str === "{}" || str === "[]") return "";
            return str;
        } catch (e) {
            return String(valor); // Fallback
        }
    }
    return String(valor).trim();
}

// Modificar el HTML para mostrar los nuevos campos
app.get("/reportes", async (req, res) => {
    try {
        // Ordenar por fecha descendente y limitar (opcional)
        const reportes = await Report.find().sort({ fecha: -1 }).limit(100);

        let html = `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Reportes de Construcción</title>
      <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 20px; background-color: #f4f4f4; color: #333; }
        h1 { color: #0056b3; border-bottom: 2px solid #0056b3; padding-bottom: 10px; }
        .reporte { background-color: #fff; border: 1px solid #ddd; padding: 20px; margin-bottom: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .reporte h2 { margin-top: 0; color: #004085; font-size: 1.1em; }
        .meta-info { font-size: 0.9em; color: #666; margin-bottom: 15px; border-bottom: 1px dashed #eee; padding-bottom: 10px;}
        .meta-info span { margin-right: 15px; }
        .etiqueta { font-weight: bold; color: #333; }
        .seccion { margin: 12px 0; line-height: 1.6; }
        .tipo-reporte { display: inline-block; padding: 4px 10px; border-radius: 12px; font-size: 0.8em; font-weight: bold; margin-left: 10px; vertical-align: middle; }
        .tipo-audio { background-color: #d1ecf1; color: #0c5460; border: 1px solid #bee5eb; }
        .tipo-texto { background-color: #d4edda; color: #155724; border: 1px solid #c3e6cb; }
        .transcripcion { background-color: #f8f9fa; border-left: 3px solid #007bff; padding: 10px; margin-top: 10px; font-style: italic; color: #555; }
        .no-especificado { color: #888; font-style: italic; }
      </style>
    </head>
    <body>
      <h1>Reportes de Construcción</h1>
    `;

        if (reportes.length === 0) {
            html += "<p>No hay reportes para mostrar.</p>";
        } else {
            reportes.forEach((reporte) => {
                // Usa valores por defecto si algo falta
                const contratistaNombre = reporte.contratista?.nombre || "Desconocido";
                const contratistaTel = reporte.contratista?.telefono?.split("@")[0] || "N/A"; // Mostrar solo número
                const tipoReporteClase = `tipo-${reporte.tipoReporte || "desconocido"}`;
                const tipoReporteTexto =
                    reporte.tipoReporte === "texto"
                        ? "Texto"
                        : reporte.tipoReporte === "audio"
                        ? "Audio"
                        : "Desconocido";
                const reporteDet = reporte.reporteDetallado || {}; // Objeto vacío si no existe

                // Helper para mostrar datos o un placeholder
                const display = (value) =>
                    value &&
                    value !== "No reportado" &&
                    value !== "No especificado" &&
                    value !== "Ninguno reportado" &&
                    value !== "Sin incidentes reportados"
                        ? value
                        : `<span class="no-especificado">${value || "No disponible"}</span>`;

                const displayNullable = (value) =>
                    value ? value : `<span class="no-especificado">No especificado</span>`;

                html += `
                  <div class="reporte">
                    <h2>
                      Reporte de: ${displayNullable(contratistaNombre)}
                      <span class="tipo-reporte ${tipoReporteClase}">${tipoReporteTexto}</span>
                    </h2>
                    <div class="meta-info">
                       <span><span class="etiqueta">Fecha:</span> ${new Date(reporte.fecha).toLocaleString(
                           "es-ES"
                       )}</span>
                       <span><span class="etiqueta">Contacto:</span> ${contratistaTel}</span>
                       <span><span class="etiqueta">Proyecto:</span> ${displayNullable(reporte.numeroProyecto)} ${
                    reporte.proyecto && reporte.proyecto !== "Proyecto General" ? `(${reporte.proyecto})` : ""
                }</span>
                       <span><span class="etiqueta">Permiso Trabajo:</span> ${displayNullable(
                           reporte.numeroPermisoTrabajo
                       )}</span>
                    </div>

                    <div class="seccion"><span class="etiqueta">Avance:</span> ${display(reporteDet.avance)}</div>
                    <div class="seccion"><span class="etiqueta">Problemas:</span> ${display(reporteDet.problemas)}</div>
                    <div class="seccion"><span class="etiqueta">Materiales:</span> ${display(
                        reporteDet.materiales
                    )}</div>
                    <div class="seccion"><span class="etiqueta">Personal:</span> ${display(reporteDet.personal)}</div>
                    <div class="seccion"><span class="etiqueta">Clima:</span> ${display(reporteDet.clima)}</div>
                    <div class="seccion"><span class="etiqueta">Seguridad:</span> ${display(reporteDet.seguridad)}</div>
                    <div class="seccion"><span class="etiqueta">Siguientes Pasos:</span> ${display(
                        reporteDet.siguientesPasos
                    )}</div>

                    ${
                        reporte.transcripcion
                            ? `
                    <div class="seccion">
                      <span class="etiqueta">${
                          reporte.tipoReporte === "audio" ? "Transcripción del Audio:" : "Texto del Reporte:"
                      }</span>
                      <div class="transcripcion">${reporte.transcripcion}</div>
                    </div>
                    `
                            : ""
                    }
                  </div>
                 `;
            });
        }

        html += `
    </body>
    </html>
    `;

        res.setHeader("Content-Type", "text/html; charset=utf-8"); // Asegurar codificación UTF-8
        res.send(html);
    } catch (error) {
        console.error("Error al obtener reportes:", error);
        res.status(500).send("Error al cargar los reportes");
    }
});

// Ruta raíz simple
app.get("/", (req, res) => {
    res.send('Bot de reportes WhatsApp funcionando. Accede a <a href="/reportes">/reportes</a> para ver los datos.');
});

// Iniciar el servidor web
app.listen(PORT, () => {
    console.log(`Servidor web ejecutándose en http://localhost:${PORT}`);
});

// Iniciar el cliente de WhatsApp
client.initialize().catch((err) => {
    console.error("Error al inicializar el cliente de WhatsApp:", err);
});

// Manejar cierre
process.on("SIGINT", async () => {
    console.log("\nCerrando aplicación...");
    await client.destroy().catch((e) => console.error("Error al destruir cliente:", e));
    await mongoose.disconnect().catch((e) => console.error("Error al desconectar MongoDB:", e));
    console.log("Cliente y conexión DB cerrados.");
    process.exit(0);
});
process.on("SIGTERM", async () => {
    // Manejar también SIGTERM
    console.log("\nRecibido SIGTERM, cerrando aplicación...");
    await client.destroy().catch((e) => console.error("Error al destruir cliente:", e));
    await mongoose.disconnect().catch((e) => console.error("Error al desconectar MongoDB:", e));
    console.log("Cliente y conexión DB cerrados.");
    process.exit(0);
});
