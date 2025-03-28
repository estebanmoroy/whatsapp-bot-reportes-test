# Contexto del Proyecto: Bot de WhatsApp para Reportes de Construcción

## Propósito y Visión General

Este proyecto surge de la necesidad de optimizar y digitalizar el proceso de reportes diarios en sitios de construcción. Tradicionalmente, los contratistas enviaban informes por texto o realizaban llamadas, resultando en información inconsistente y difícil de procesar.

El bot permite a los contratistas enviar reportes verbales mediante mensajes de audio en WhatsApp (un medio ampliamente utilizado en el sector construcción), que luego son automáticamente transcritos, estructurados y almacenados en un formato estandarizado.

## Audiencia y Usuarios

- **Contratistas y trabajadores en sitio**: Personas que están en el terreno y necesitan reportar avances sin interrumpir su trabajo. Prefieren hablar que escribir, especialmente si tienen las manos ocupadas o están en condiciones difíciles.
- **Supervisores y gerentes de proyecto**: Necesitan acceso rápido a información estructurada sobre el avance de las obras.
- **Administradores**: Personas encargadas de mantener y monitorear el sistema.

## Contexto técnico y decisiones de implementación

1. **Uso de WhatsApp-web.js en lugar de la API oficial**:

   - La API oficial de WhatsApp Cloud requiere aprobación de Meta y una cuenta business
   - Es más accesible implementar el bot mediante whatsapp-web.js, especialmente para pruebas y casos de uso limitados
   - Aunque no es una solución oficial, es ampliamente utilizada y mantenida

2. **Funcionamiento en grupo específico**:

   - El bot está diseñado para operar en un solo grupo de WhatsApp
   - Esto facilita la colaboración y centraliza la información para un proyecto específico
   - Permite que múltiples contratistas reporten en un mismo canal

3. **Transcripción mediante OpenAI Whisper**:

   - Se eligió Whisper por su precisión y capacidad multilingüe
   - Especialmente útil para transcribir jerga técnica de construcción
   - Alternativa a soluciones más complejas de implementar localmente

4. **Estructuración mediante GPT-4**:

   - El análisis de texto libre requiere comprensión del contexto
   - GPT-4 puede extraer información específica de construcción (avances, problemas, materiales, etc.)
   - Facilita la estandarización de reportes independientemente del estilo de cada contratista

5. **MongoDB para almacenamiento**:
   - Permite almacenar datos semiestructurados
   - Fácil de implementar tanto localmente como en la nube
   - Esquema flexible para adaptarse a diferentes tipos de reportes

## Características pendientes o deseadas

1. **Mejora del dashboard**:

   - Interfaz más rica y dinámica (React/Vue)
   - Filtros y búsqueda avanzada
   - Visualización de tendencias y estadísticas

2. **Sistemas de notificación**:

   - Alertas automáticas para supervisores cuando se reportan problemas graves
   - Recordatorios para contratistas que no han enviado reportes

3. **Integración con otros sistemas**:

   - Conexión con software de gestión de proyectos (MS Project, Jira, etc.)
   - Exportación a formatos estándar (Excel, PDF)

4. **Escalabilidad**:

   - Soporte para múltiples proyectos/grupos simultáneos
   - Sistema de colas para procesar muchos reportes simultáneamente

5. **Seguridad mejorada**:
   - Autenticación para el dashboard
   - Cifrado de datos sensibles
   - Respaldos automatizados

## Consideraciones culturales y de usuario

1. **Facilidad de uso para trabajadores de construcción**:

   - Interfaz sencilla, basada en una aplicación que ya conocen (WhatsApp)
   - No requiere aprendizaje complejo ni aplicaciones adicionales
   - Funciona con conexiones limitadas a internet

2. **Terminología específica del sector**:

   - El sistema está diseñado para reconocer y procesar términos técnicos de construcción
   - Los reportes mantienen el vocabulario específico del sector

3. **Multilingüismo**:
   - Capacidad para procesar reportes en diferentes idiomas
   - Especialmente útil en equipos diversos o internacionales

## Estado actual y próximos pasos

El proyecto actualmente tiene implementado:

- Conexión básica con WhatsApp
- Procesamiento de mensajes de audio de un grupo específico
- Transcripción y estructuración de reportes
- Almacenamiento en MongoDB
- Dashboard web simple

Próximos pasos prioritarios:

1. Refinar la estructura de datos para reportes más completos
2. Mejorar el dashboard con más opciones de visualización
3. Implementar un sistema robusto de manejo de errores y reconexión
4. Desarrollar herramientas de análisis estadístico de los reportes
5. Mejorar la documentación y guías de usuario

## Consideraciones éticas y de privacidad

- Los datos de audio y transcripciones contienen información potencialmente sensible
- Es necesario establecer políticas claras sobre retención y eliminación de datos
- Los contratistas deben ser informados sobre el procesamiento de sus audios
- Debe establecerse un proceso para corregir información mal transcrita o interpretada

## Métricas de éxito

- Reducción del tiempo dedicado a reportes (para contratistas)
- Aumento en la frecuencia y consistencia de los reportes
- Mejora en la calidad y estructura de la información reportada
- Reducción de malentendidos o información perdida
- Mayor rapidez en la identificación y resolución de problemas
