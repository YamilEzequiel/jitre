# Chat Slack-lite integrado con proyectos

## Objetivo
Rediseñar Chat en Jitre para que funcione como una experiencia tipo Slack/Discord orientada al trabajo por workspace y proyecto, con tiempo real confiable, navegación clara y mínima fricción operativa.

## Contexto del problema
El chat actual ya tiene base de channels, DMs, websocket, unread y typing, pero todavía se comporta más como un módulo aislado que como una parte natural del flujo del producto. Eso genera tres problemas:

1. El usuario debe pensar en crear/administrar espacios de chat en vez de enfocarse en el proyecto.
2. La UX no prioriza la jerarquía correcta de trabajo colaborativo (workspace y proyectos primero, DMs después).
3. La capa realtime existe, pero todavía no está cerrada como una experiencia robusta de producto, especialmente si se agregan threads reales y sincronización con proyectos.

## Resultado esperado
La experiencia final debe sentirse así:

- Cada workspace tiene un canal global `#general`.
- Cada proyecto crea automáticamente un único chat principal.
- El chat del proyecto se abre rápido desde la vista del proyecto.
- La membresía del chat del proyecto se sincroniza automáticamente con la membresía del proyecto.
- Los Channels son la navegación principal.
- Los DMs quedan debajo como sección secundaria.
- Los mensajes y replies se propagan en tiempo real.
- El usuario no necesita crear canales manuales para empezar a colaborar.

## Alcance

### Incluye
- Canal global de workspace `#general`.
- Un único chat automático por proyecto.
- Acceso rápido al chat desde pantallas de proyecto.
- Sincronización automática de miembros proyecto/chat.
- UI principal estilo Slack-lite (sidebar de channels, DMs debajo, unread, estado activo, composer sólido).
- Threads reales sobre mensajes existentes.
- Estados realtime visibles y confiables: conexión, unread, typing, presence, new messages.

### No incluye
- Múltiples subcanales por proyecto.
- Jerarquías tipo Discord con categorías y subrooms.
- Permisos ultra granulares por canal fuera de las reglas de workspace/proyecto.
- Reacciones, pins, bookmarks o search avanzada como primera iteración.
- Adjuntos avanzados o upload manager nuevo.

## Decisiones de producto

### 1. Workspace-first
El chat se organiza como colaboración de workspace, no como mensajería personal. La navegación principal muestra Channels y debajo Direct Messages.

### 2. Un proyecto = un chat
Cada proyecto tiene exactamente un canal principal asociado. No habrá subcanales por proyecto en esta iteración.

### 3. Canal global obligatorio
Cada workspace debe tener un canal `#general` estable para comunicación transversal.

### 4. Membresía sincronizada
Cuando un usuario entra o sale de un proyecto, entra o sale automáticamente del canal de chat principal de ese proyecto.

### 5. Threads desde el inicio
Los replies no serán sólo indentación visual en la línea principal; deben tener soporte real de producto y estructura para abrir una conversación lateral consistente.

## Arquitectura funcional

### Tipos de conversación
Se distinguen tres tipos:

1. **Workspace general**: canal único `#general` por workspace.
2. **Project channel**: canal único ligado a un proyecto.
3. **Direct message**: conversación 1:1 creada on demand.

No se agregan tipos extra en esta fase.

### Fuente de verdad de membresía
- `#general`: deriva de la membresía del workspace.
- Chat de proyecto: deriva de la membresía del proyecto.
- DM: deriva de sus participantes explícitos.

La membresía de project channel no debe poder divergir manualmente de la del proyecto.

### Fuente de verdad de navegación
La lista de channels visibles debe ordenarse así:

1. `#general`
2. chats de proyecto relevantes del workspace
3. DMs

El frontend puede separar visualmente channels y DMs, pero el backend debe poder resolver explícitamente qué canales son generales, cuáles son de proyecto y cuáles son DMs.

## Diseño de backend

### Extensiones de dominio necesarias
El modelo de canal debe poder expresar:

- tipo de canal (`general`, `project`, `dm` o equivalente seguro sobre el modelo actual)
- vínculo opcional a `projectId`
- reglas de membresía derivada para project channel
- identificador estable del canal general por workspace

Si hoy `public | private | dm` no alcanza para distinguir `#general` y project channels, hay que ampliar el modelo o agregar metadata explícita. La implementación debe elegir la opción más limpia para no meter lógica implícita por nombre.

### Reglas automáticas

#### Al crear workspace
- asegurar existencia de `#general`

#### Al crear proyecto
- crear automáticamente su canal de chat principal
- sembrar membresía inicial con miembros actuales del proyecto

#### Al agregar miembro al proyecto
- agregarlo al canal del proyecto

#### Al remover miembro del proyecto
- removerlo del canal del proyecto

Estas reglas deben vivir del lado backend; NO pueden depender del frontend.

### Endpoints/servicios nuevos o ajustados
Se necesita una forma estable de:

- obtener el canal principal de un proyecto
- abrir el chat de un proyecto desde su vista sin búsquedas ambiguas
- distinguir `#general`, project channels y DMs en el listado
- recuperar metadata útil para UI (por ejemplo nombre del proyecto enlazado)
- exponer replies/thread de forma consistente

### Realtime
La capa websocket debe asegurar:

- conexión estable al namespace `/chat`
- join/leave correcto por canal
- fanout de mensajes al canal correcto
- eventos de thread/reply coherentes con el canal padre
- unread correcto al recibir mensajes fuera del canal activo
- typing/presence sin quedar colgados por cambios de canal

Si aparece cualquier ambigüedad entre “mensaje en canal” y “mensaje en thread”, la separación del payload debe quedar explícita.

## Diseño de frontend

### Layout principal

#### Sidebar izquierda
Debe contener:
- header del workspace/chat
- sección **Channels**
  - `#general`
  - chats automáticos de proyecto
- sección **Direct Messages**
- badges de unread
- estado seleccionado fuerte
- affordances para nuevo DM, no para crear canal de proyecto manualmente

#### Panel central
Debe contener:
- header del canal
- metadata contextual cuando el canal pertenece a un proyecto
- feed principal de mensajes
- agrupación visual por autor/tiempo
- estados de carga, vacío y reconexión
- composer tipo Slack-lite

#### Panel derecho de thread
Cuando se selecciona “reply/thread” sobre un mensaje:
- abrir panel lateral derecho
- mostrar mensaje raíz
- listar replies del thread
- permitir responder sin romper el flujo principal del canal

### Acceso desde Proyecto
La vista de proyecto debe ofrecer un CTA o acceso rápido visible a “Abrir chat del proyecto”.

No debe obligar al usuario a ir a Chat y buscar manualmente el canal correcto.

### Estados importantes de UX
Se deben diseñar explícitamente estos estados:

- vacío sin mensajes
- proyecto recién creado con chat recién creado
- canal con unread
- canal activo con otros escribiendo
- websocket desconectado/reconectando
- thread abierto
- canal de proyecto al que el usuario dejó de pertenecer

## Estrategia de implementación recomendada

### Fase 1 — Dominio y contratos
- modelar canal general y canal de proyecto
- crear reglas automáticas backend
- exponer resolución de chat por proyecto
- reforzar payloads y servicios realtime para soportar threads y metadata

### Fase 2 — UX principal Slack-lite
- rediseñar sidebar y jerarquía visual
- separar claramente Channels y DMs
- mostrar proyecto/contexto en header
- pulir composer, unread, pills y presencia

### Fase 3 — Threads reales
- panel lateral de thread
- navegación entre mensaje y thread
- replies en tiempo real
- unread/estado de thread consistente

### Fase 4 — Integración con proyectos
- acceso rápido desde proyecto
- deep-link al canal del proyecto
- validación de membresía y permisos

## Riesgos y mitigaciones

### Riesgo 1: canal y proyecto desincronizados
**Mitigación:** sincronización backend-driven y pruebas de alta/baja de miembros.

### Riesgo 2: UI linda pero realtime frágil
**Mitigación:** cerrar primero contratos, stores y eventos antes del pulido visual final.

### Riesgo 3: threads rompen unread y scroll
**Mitigación:** tratar thread como vista/panel separado con estado explícito, no como simple indentación cosmética.

### Riesgo 4: lógica implícita por nombre del canal
**Mitigación:** modelar metadata estructural (`projectId`, tipo real, flags) en vez de inferir por `#general` o por nombres.

## Testing esperado

### Backend
- creación automática de `#general`
- creación automática de canal al crear proyecto
- sync de membresía proyecto/chat al agregar/quitar miembros
- resolución de canal por proyecto
- guards/permisos correctos
- eventos realtime correctos por canal y thread

### Frontend
- render separado de Channels y DMs
- navegación al canal correcto
- acceso rápido desde Proyecto
- unread y selección activa
- thread panel abre/cierra correctamente
- typing/presence/reconnect visibles

### Integración
- crear proyecto -> aparece canal
- agregar miembro al proyecto -> aparece en chat
- quitar miembro del proyecto -> pierde acceso
- enviar mensaje desde otro cliente -> se refleja en tiempo real
- responder thread desde otro cliente -> se refleja en tiempo real

## Archivos candidatos a tocar

### Frontend
- `packages/frontend/src/app/features/chat/chat.component.ts`
- `packages/frontend/src/app/features/chat/chat-channel-view.component.ts`
- `packages/frontend/src/app/features/chat/message-input.component.ts`
- `packages/frontend/src/app/stores/chat-api.service.ts`
- vistas de proyecto relevantes para acceso rápido al chat

### Backend
- módulos/controladores/servicios de chat
- módulos/servicios de proyecto para hooks de creación y membresía
- gateway/listener realtime
- entidades/migraciones necesarias para metadata del canal

## Criterios de éxito
Un usuario debería poder:

1. crear un proyecto y encontrar su chat sin configurar nada
2. abrir el chat desde el proyecto en un click
3. ver a los miembros correctos automáticamente
4. usar `#general`, chats de proyecto y DMs con jerarquía clara
5. recibir mensajes y replies en tiempo real de forma confiable
6. sentir que el chat está integrado al trabajo del workspace, no pegado encima
