# Estructura de la Base de Datos

Este documento describe el modelo de datos utilizado en el bot de WhatsApp para reportes de construcción.

## Base de datos: MongoDB

El sistema utiliza MongoDB como base de datos NoSQL, lo que proporciona:

- Flexibilidad en el esquema para adaptarse a diferentes tipos de reportes
- Fácil almacenamiento de datos semiestructurados
- Buena integración con Node.js a través de Mongoose
- Opciones de escalabilidad tanto en despliegues locales como en la nube

## Colección principal: Reportes

La colección principal almacena los reportes procesados con la siguiente estructura:

### Esquema de Reportes

````javascript
const reportSchema = new mongoose.Schema({
    contratista: {
        nombre: String,     // Nombre del contratista o trabajador
        telefono: String,   // Número de teléfono en formato internacional (ej: "1234567890@c.us")
    },
    // Campos que podrían añadirse en futuras versiones
    // estado: {
    //     type: String,
    //     enum: ['pendiente', 'procesado', 'error'],
    //     default: 'procesado'
    // },
    // metadata: {
    //     duracionAudio: Number,  // Duración en segundos
    //     tamanoArchivo: Number,  // Tamaño en bytes
    //     dispositivo: String,    // Información del dispositivo
    //     ubicacion: {            // Ubicación GPS (si está disponible)
    //         latitud: Number,
    //         longitud: Number
    //     }
    // }
});

// Índices para optimizar consultas
reportSchema.index({ 'contratista.telefono': 1, fecha: -1 });
reportSchema.index({ fecha: -1 });
reportSchema.index({ proyecto: 1, fecha: -1 });

const Report = mongoose.model('Report', reportSchema);

## Ejemplo de documento

A continuación se muestra un ejemplo de cómo se almacena un reporte en la base de datos:

```json
{
  "_id": "60f8a1b3e6b5c123456789ab",
  "contratista": {
    "nombre": "Juan Pérez",
    "telefono": "1234567890@c.us"
  },
  "proyecto": "Proyecto Principal",
  "fecha": "2023-07-21T15:30:45.123Z",
  "audioPath": "/opt/whatsapp-bot/audios/audio_1689951045123.ogg",
  "transcripcion": "Hoy avanzamos con la cimentación del sector norte. Terminamos de colocar el acero de refuerzo y preparamos todo para el vaciado de concreto de mañana. Tuvimos un pequeño retraso por lluvia durante la mañana, pero recuperamos el tiempo por la tarde. Contamos con 8 trabajadores hoy. Para mañana necesitaremos que llegue el camión de concreto a las 9 AM.",
  "reporte": {
    "avance": "Terminamos de colocar el acero de refuerzo en la cimentación del sector norte. Todo listo para vaciado de concreto.",
    "problemas": "Pequeño retraso por lluvia durante la mañana.",
    "materiales": "Acero de refuerzo instalado. Se necesita concreto para mañana.",
    "personal": "8 trabajadores",
    "clima": "Lluvia por la mañana, despejado por la tarde",
    "seguridad": "Sin incidentes",
    "siguientesPasos": "Vaciado de concreto programado para mañana a las 9 AM."
  }
}
````

## Consideraciones sobre el modelo de datos

1. **Escalabilidad**:

   - El modelo actual es adecuado para proyectos individuales
   - Para múltiples proyectos, considerar añadir más metadatos al campo "proyecto"

2. **Almacenamiento de audios**:

   - Actualmente se guardan como archivos en el sistema de archivos local
   - El campo "audioPath" solo almacena la ruta
   - Para implementaciones a gran escala, considerar almacenamiento en la nube (S3, GCS, etc.)

3. **Indexación**:

   - Se han definido índices para las consultas más comunes
   - Monitorear el rendimiento de las consultas a medida que crece la colección

4. **Evolución del esquema**:

   - El esquema puede expandirse para incluir campos adicionales según sea necesario
   - La naturaleza flexible de MongoDB facilita esta evolución

5. **Respaldo y mantenimiento**:
   - Implementar respaldos regulares de la base de datos
   - Considerar políticas de retención de datos para reportes antiguos
   - Para grandes volúmenes, implementar estrategias de archivado
     ,
     proyecto: String, // Nombre o identificador del proyecto
     fecha: {
     type: Date,
     default: Date.now // Fecha de creación del reporte
     },
     audioPath: String, // Ruta al archivo de audio guardado localmente
     transcripcion: String, // Texto completo transcrito del audio
     reporte: {
     avance: String, // Resumen del progreso del trabajo
     problemas: String, // Cualquier problema o retraso encontrado
     materiales: String, // Materiales utilizados o requeridos
     personal: String, // Número de trabajadores presentes
     clima: String, // Condiciones climáticas que afectan el trabajo
     seguridad: String, // Problemas o medidas de seguridad
     siguientesPasos: String // Plan para el próximo día
     }
