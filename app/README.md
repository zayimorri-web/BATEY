# BateyOS — Turnover Ops Platform

Aplicación real (no una página estática) para operar limpiezas de rotación de Airbnb/STR:
el calendario del anfitrión entra por iCal, cada salida crea un trabajo con precio,
el trabajo se ejecuta contra un checklist con fotos obligatorias, y al cerrar se
genera el reporte del anfitrión.

## Correr
```bash
node server.js        # Node >= 22.5, cero dependencias (http + sqlite nativos)
# http://localhost:4173  ·  API en /api/*
```

## Qué funciona en v0.1 (probado)
- `GET  /api/health` — estado y conteos
- `POST /api/properties` / `GET /api/properties` — propiedades y anfitriones
- `POST /api/properties/:id/import-ical` — importa el feed iCal de Airbnb/Booking y crea las rotaciones (deduplicadas por UID)
- `POST /api/jobs` — rotación manual · `GET /api/jobs`
- `POST /api/jobs/:id/start` — genera el checklist SOP de 23 puntos
- `POST /api/checklist/:id` — marcar puntos (con foto)
- `POST /api/jobs/:id/photos` — registrar fotos del trabajo
- `POST /api/jobs/:id/complete` — cierra SOLO si el checklist está completo
- `GET  /api/jobs/:id/report` — reporte del anfitrión (texto, listo para enviar)
- Panel web en `/` con propiedades, rotaciones y reportes

## Precios (tabla de la operación, de rangos públicos del mercado)
1 cuarto $95 · 2 cuartos $145 · 3 cuartos $185 · 4+ cotización.

## Ruta
v0.2: subida real de fotos (archivos), login de anfitriones/cleaners, avisos automáticos.
v0.3: multi-operador — que otros operadores de limpieza lo usen como su sistema.
