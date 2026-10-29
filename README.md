# LISTO — Turnover Co. · Worcester, MA

Servicio de limpieza de rotación (turnover) para anfitriones de Airbnb y alquileres de corta estadía en Worcester, MA y alrededores.

**Esto no es una idea. Es una operación montada sobre demanda pagada y verificada:**

- En Turno (el marketplace donde los anfitriones contratan cleaners), cleaners de Worcester muestran cientos de proyectos completados — 582 y ~760 en los dos perfiles líderes, ambos con rating 5.0 (verificado 2026-10-29 en turno.com/airbnb-cleaners/us/massachusetts/worcester).
- Precios de mercado en Greater Boston: $95–$280 por rotación según tamaño de la propiedad (BrightNest / Paula's Cleaning, tarifas públicas 2026).
- Worcester: ADR ~$187 y ocupación ~60.6% (StaySTRA, analítica de terceros, 2026).

## La ventaja (por qué nosotros y no otro cleaner solo)

1. **Reporte con fotos después de cada limpieza** — el anfitrión ve su propiedad lista sin estar presente.
2. **Bilingüe EN/ES** — Worcester es una ciudad latina; anfitriones y huéspedes lo valoran.
3. **Respaldo el mismo día** — disponibilidad para rotaciones de último momento (back-to-back), que es donde los cleaners establecidos no dan abasto.
4. **Oficina que responde 24/7** — agenda, mensajes, cobros y seguimiento operados por sistema, no por memoria.

## Reglas de la operación (anti-ilusión)

- **No se gasta antes de la primera reserva — con una excepción corregida 2026-10-29:** entrar a
  Turno exige un background check pagado antes de ver ofertas: **$89.99 la primera vez**
  (Turno, respuesta oficial junio 2026; confirmar en la app antes de pagar — detalle en
  `../turno-costo-entrada-2026-10-29.md`). Los insumos (~$200) sí se compran solo con el
  primer trabajo confirmado.
- **Depósito antes del trabajo** cuando el canal lo permite; nadie trabaja de gratis.
- **Cada trabajo se registra** en `ops/registro-trabajos.csv` con su $/hora efectivo real (precio − costos ÷ horas totales incl. viaje).

## Criterios de corte (si no se cumple, se mata)

- Perfil de Turno activo 14 días → menos de 3 ofertas de trabajo = **se mata el carril**.
- $/hora efectivo promedio < $30 tras costos en los primeros 10 trabajos = **se re-precifica o se mata**.
- Si el 80% de los trabajos no viene de anfitriones repetidos al día 60, el modelo no es recurrente = **se replantea**.

## Estructura del repo

- `index.html` — vitrina web del servicio (lista para GitHub Pages).
- `ops/checklist-rotacion.md` — SOP cuarto por cuarto, con puntos de foto obligatorios.
- `ops/precios-y-politicas.md` — precios de entrada, extras, políticas de pago/cancelación.
- `ops/mensajes-anfitriones.md` — bio de Turno (EN/ES) y plantillas de mensajes.
- `ops/registro-trabajos.csv` — registro de trabajos y $/hora efectivo.

## Pendientes de Jay (lo único que la operación no puede hacer sola)

1. Crear la cuenta de cleaner en **Turno** (identidad y verificación suyas) y pegar la bio de `ops/mensajes-anfitriones.md`.
2. Decidir el modo de arranque: **él hace las primeras limpiezas** o **él supervisa a un cleaner por trabajo**.
3. Cuando entre el primer trabajo: aprobar ~$200 de insumos y conectar Stripe para depósitos.

*Precios de este repo = precios de entrada de LISTO, alineados con el rango público del mercado; se ajustan con datos reales de los primeros trabajos.*
