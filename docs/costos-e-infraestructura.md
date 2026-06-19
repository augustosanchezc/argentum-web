# Costos e infraestructura — Argentum Online Web

> Documento vivo. Fecha de creación: 2026-06-19. Responsable: project-manager.
> Todos los precios están en USD y son estimativos al momento de redacción. Confirmar antes de contratar — los planes cambian.
> El usuario opera desde Argentina (referencia a MercadoPago en D-6), por lo que las opciones de pago se evalúan considerando disponibilidad de tarjeta internacional o MEP/MercadoPago.

---

## 1. Resumen ejecutivo

| Escenario | Inversión one-time | Costo recurrente mensual | Costo hasta cierre de Beta (12 sprints / ~5 meses) |
|---|---|---|---|
| **Mínimo realista** (assets libres, infra básica) | ~USD 30 | USD 0 (Fase 0-3) → USD 25-40 (Fase 4) | **~USD 130-220** |
| **Cómodo** (algunos asset packs, Copilot, Sentry Team) | ~USD 150 | USD 10-15 (Fase 0-3) → USD 70-100 (Fase 4) | **~USD 400-600** |
| **Premium** (pixel-art comisionado, VPS holgado) | USD 1.500-3.000 | USD 100-150/mes en Beta | **USD 2.500-4.500** |

**El costo del proyecto está dominado por dos decisiones:**
1. **Assets gráficos** (D-1 y R-02). Free es USD 0. Comisionar pixel-art profesional puede ser USD 1.000-3.000 one-time.
2. **VPS en Beta** (Fase 4). Va de USD 5 a USD 50/mes según escala. Para 200 conexiones simultáneas alcanza con USD 15-25/mes.

**Todo lo demás (desarrollo, herramientas, observabilidad, hosting de código)** puede mantenerse en **USD 0** durante Fases 0-3 usando free tiers y open source. No hay costos bloqueantes hasta el deploy de la Beta.

---

## 2. Herramientas de desarrollo (Fases 0-4)

### 2.1 Núcleo gratis (sin alternativa paga necesaria)

| Herramienta | Categoría | Costo |
|---|---|---|
| Git, GitHub (repos públicos ilimitados) | VCS + hosting de código | **USD 0** |
| Node.js LTS + pnpm | Runtime y package manager | **USD 0** |
| Visual Studio Code | Editor | **USD 0** |
| Windows Terminal + PowerShell 7 | Shell | **USD 0** |
| Docker Desktop (uso personal) | Contenedores | **USD 0** |
| WSL2 + Ubuntu | Subsistema Linux | **USD 0** |
| PostgreSQL 16 + Redis (self-hosted en Docker) | Bases de datos | **USD 0** |
| DBeaver Community / pgAdmin | Cliente DB | **USD 0** |
| Tiled Map Editor | Mapas | **USD 0** |
| GIMP | Edición de imágenes | **USD 0** |
| Figma (plan free) | Diseño UI | **USD 0** |
| Audacity | Edición de sonido | **USD 0** |
| Bruno / wscat | Cliente HTTP / WebSocket | **USD 0** |
| Discord | Comunicación | **USD 0** |
| Obsidian / archivos .md | Documentación interna | **USD 0** |
| Caddy / Nginx | Reverse proxy + SSL automático | **USD 0** |
| Let's Encrypt | Certificados SSL | **USD 0** |

### 2.2 De pago — opcionales pero recomendables

| Herramienta | Para qué | Costo | Justificación |
|---|---|---|---|
| **Aseprite** | Pixel-art profesional | **USD 19.99 one-time** (Steam o sitio oficial). Compilable libre desde fuente con esfuerzo | El estándar de facto para pixel-art. GIMP no lo reemplaza bien. |
| **TexturePacker Pro** | Atlas/spritesheets optimizados | Free tier alcanza para MVP; **Essential USD 39.95 one-time**, Pro USD 79.95 | Opcional. Free tier sirve hasta Fase 3. |
| **GitHub Copilot** | Asistente IA en el editor | **USD 10/mes** o USD 100/año | Aumenta productividad ~20%. Opcional. |
| **Postman Pro** | Colecciones compartidas, mocks | Free tier alcanza; **USD 12-19/mes** si hace falta colaboración | Bruno (gratis) cubre el 90% del uso. |

---

## 3. Hosting e infraestructura

### 3.1 Hosting de código y CI/CD

| Servicio | Plan | Costo |
|---|---|---|
| **GitHub** repos públicos + Actions | Free | **USD 0** — minutos ilimitados de Actions en repos públicos. |
| **GitHub** repos privados | Free | **USD 0** para hasta 3 colaboradores; 2.000 min Actions/mes incluidos. |

**Recomendación:** repo público (compatible con D-1 AGPL). USD 0 todo el proyecto.

### 3.2 VPS para producción (Fase 3-4)

Necesario desde el Sprint 7-8 para testing interno y desde Sprint 11 para la Beta pública. Comparativa por proveedor:

| Proveedor | Plan recomendado | Specs | Precio | Notas |
|---|---|---|---|---|
| **Hetzner Cloud** (Alemania/Finlandia) | CX22 → CCX13 | 2 vCPU / 4 GB → 2 vCPU dedicado / 8 GB | EUR 4,51/mes (~USD 5) → EUR 13,99/mes (~USD 15) | Mejor relación precio/performance. Requiere tarjeta internacional. |
| **DigitalOcean** | Basic Premium | 2 vCPU / 4 GB / 80 GB SSD | USD 24/mes | Más caro pero panel muy pulido. Acepta MercadoPago en algunos casos. |
| **Vultr** | High Frequency | 1 vCPU / 2 GB | USD 12/mes | Buena performance. |
| **Contabo** (Alemania) | VPS S | 4 vCPU / 8 GB / 200 GB | USD 4,50/mes | Más barato, hardware compartido más cargado. |
| **Linode/Akamai** | Shared 2 GB | 1 vCPU / 2 GB | USD 12/mes | Sólido. |

**Recomendación para Beta (200 conexiones):**
- **Dev/staging interno (Fase 3):** Hetzner CX22 — **EUR 4,51/mes (~USD 5)**.
- **Producción Beta (Fase 4):** Hetzner CCX13 (dedicado) — **EUR 13,99/mes (~USD 15)**.
- Si Hetzner no acepta tarjeta argentina: **Contabo VPS-S USD 4,50/mes** como fallback.

**Backups automáticos del VPS:** ~20% adicional del costo (Hetzner) o snapshot manual gratis ocasional.

### 3.3 Dominio

| TLD | Precio anual aprox. | Notas |
|---|---|---|
| `.com` | **USD 10-15/año** | Estándar, sin sorpresas. |
| `.io` | USD 30-60/año | Tradicionalmente asociado a juegos `.io`. |
| `.gg` | USD 30-80/año | Asociado a gaming pero más caro. |
| `.com.ar` | ARS variable (~USD 5-10) | Registro vía NIC.ar, solo Argentina. |

**Recomendación:** comprar **un `.com` en Namecheap o Cloudflare Registrar — ~USD 12/año amortizado a USD 1/mes.** No urgente hasta Fase 3.

### 3.4 Proxy / CDN / Anti-DDoS

| Servicio | Plan | Costo | Cubre WebSocket |
|---|---|---|---|
| **Cloudflare** Free | DNS + proxy + SSL + DDoS L3/L4 básico | **USD 0** | Sí (con timeout de inactividad ~100s, manejable con ping/heartbeat) |
| **Cloudflare** Pro | Mejor cache, image optimization, más reglas | USD 20/mes | Sí, sin timeout en planes pagos |

**Recomendación:** **Cloudflare Free** durante toda la Beta. El timeout de 100s no es un problema si el cliente envía un heartbeat cada 30s (cosa que un cliente de juego ya hace). Saltar a Pro recién si hay un ataque o si las métricas justifican el cache extra.

### 3.5 Bases de datos gestionadas (alternativa a self-hosted)

**No recomendado para Fase 4.** Self-hosted PostgreSQL + Redis en el mismo VPS alcanza para 200 conexiones y elimina costos. Listado solo por completitud:

| Servicio | Plan free | Plan pago |
|---|---|---|
| **Neon** (PostgreSQL serverless) | 0.5 GB storage, compute pausable | USD 19/mes plan Launch |
| **Supabase** (PostgreSQL + auth) | 500 MB, 2 proyectos | USD 25/mes plan Pro |
| **Upstash** (Redis serverless) | 10k commands/día | Pay per use, ~USD 0.20/100k commands |
| **Railway** | USD 5 gratis crédito mensual | Pay per use |

**Si en Fase 5+ se quiere separar DB del VPS por escalado:** Neon Launch + Upstash pueden costar USD 25-40/mes adicionales. Diferido.

### 3.6 Email transaccional (para registros, recuperación de contraseña)

| Servicio | Plan free | Plan pago |
|---|---|---|
| **Resend** | 3.000 emails/mes, 100/día | USD 20/mes para 50k |
| **Postmark** | 100 emails/mes test | USD 15/mes para 10k |
| **AWS SES** | 62k/mes desde EC2 | USD 0,10 por 1k emails |

**Recomendación:** **Resend free** alcanza sobradamente para Beta.

---

## 4. Observabilidad y monitoreo (Fase 4)

| Servicio | Plan free | Cuándo upgradear |
|---|---|---|
| **Sentry** (errores cliente + servidor) | 5k events/mes, 1 usuario | Plan Team **USD 26/mes** cuando se exceda |
| **Grafana Cloud** (métricas) | 10k series, 50 GB logs, 14 días retención | Plan Pro USD 8 + variable, recién en Fase 5+ |
| **Prometheus** self-hosted | — | Alternativa gratis si se evita Grafana Cloud |
| **UptimeRobot** | 50 monitores cada 5 min | Pro USD 7/mes para 1 min |
| **Better Stack** | 10 monitores cada 3 min | USD 18/mes Team |
| **Logtail** (Better Stack) | 1 GB logs/mes, 3 días retención | USD 24/mes para 30 GB |

**Recomendación para Beta:**
- Sentry free
- Grafana Cloud free + Prometheus self-hosted en el VPS
- UptimeRobot free
- **Total: USD 0/mes en observabilidad durante la Beta.**

---

## 5. Assets gráficos y sonoros (D-1, R-02) — el costo más variable

### 5.1 Opciones por escenario

| Escenario | Inversión | Riesgo legal | Calidad / coherencia visual |
|---|---|---|---|
| **A. Sprites clásicos AO** (extraer de cliente original) | USD 0 | **Alto** — licencia no clara, disputas históricas | Máxima fidelidad para fans del juego original |
| **B. Assets libres** (OpenGameArt, itch.io, Kenney) | USD 0-50 | Nulo (CC0 / CC-BY) | Inconsistencia visual; pixel-art genérico |
| **C. Asset packs comerciales** | USD 50-300 one-time | Nulo | Mejor coherencia que B, pero no AO |
| **D. Comisión a pixel-artist freelance** | USD 500-3.000 | Nulo | Calidad alta, estética propia |
| **E. Generación con IA + ediciones** | USD 10-30/mes (Midjourney) o USD 0 (Stable Diffusion local) | Bajo a medio (licencia de outputs en discusión) | Variable, requiere curaduría fuerte |

**Recomendación:**
- **Fases 1-3 (desarrollo):** Opción **B (assets libres)** como placeholders. **USD 0**.
- **Antes de Beta pública (Sprint 10-11):** decidir entre C (assets packs ~USD 100) o D (comisión ~USD 1.500). Si presupuesto es bajo, mantener libres.
- **Opción A (clásicos AO):** evitar salvo confirmación explícita del usuario asumiendo el riesgo. No es decisión del PM.

### 5.2 Costo estimado de una comisión típica (Opción D)

Para un MVP visualmente coherente se necesita:
- **Tilesets básicos** (pasto, piedra, agua, muros, decoración): USD 200-500
- **Personajes base** (4 direcciones × 2-3 animaciones: idle, walk, attack): USD 300-800
- **NPCs** (3-5 enemigos básicos): USD 200-500
- **Items / iconos** (10-15): USD 100-300
- **Tilemaps de los 3 mapas iniciales**: USD 200-400

**Total comisión MVP: USD 1.000-2.500 one-time.** Pagable en hitos. Plataformas: Reddit r/INAT, ArtStation, Fiverr, comunidades indie.

### 5.3 Música y sonido

| Origen | Costo |
|---|---|
| **Freesound.org / OpenGameArt** (efectos) | USD 0 |
| **Pixabay Music / FreePD** (BGM CC0) | USD 0 |
| **Comisión a compositor freelance** | USD 200-1.000 para 3-5 pistas |

**Recomendación:** asset libre hasta Beta. Comisión post-Beta si justifica.

---

## 6. Comunicación, comunidad y marketing

| Servicio | Costo |
|---|---|
| **Discord** servidor + bots | **USD 0** |
| **Twitter/X** cuenta | USD 0 (Premium USD 8/mes opcional para alcance) |
| **Landing page** (servida desde el mismo VPS) | USD 0 incremental |
| **Logo** (Fiverr / 99designs / hecho propio) | USD 0-300 |

---

## 7. Pagos y donaciones (Fase 4 — alineado a D-6)

| Plataforma | Comisión | Notas para Argentina |
|---|---|---|
| **Ko-fi** donaciones | 0% (Stripe/PayPal fees aparte ~3%) | El más barato. Acepta donaciones desde el mundo. Pago a cuenta bancaria internacional. |
| **Patreon** | 8-12% + fees | Bueno para suscripciones recurrentes. |
| **Stripe** | 2,9% + USD 0,30 por transacción | No disponible directamente para argentinos; usable vía LLC en EE.UU. |
| **MercadoPago** Argentina | ~6-7% para donaciones | Más fácil para donantes argentinos. Requiere CUIL/CUIT. |
| **Mercado Pago + Patreon en paralelo** | — | Cubre ambas audiencias. |

**Recomendación inicial:** Ko-fi como canal principal + MercadoPago para donantes argentinos. **USD 0/mes en costos fijos; comisiones solo si hay donaciones.**

---

## 8. Legal y compliance (Fase 4)

Requerido por AGPL-3.0 y por leyes de privacidad si se recolectan datos (email, IP de jugadores).

| Item | Opción gratis | Opción paga |
|---|---|---|
| **Términos y condiciones** | Templates de Termly o TermsFeed | Iubenda USD 27/año por sitio |
| **Política de privacidad** | Generadores gratuitos | Iubenda incluido en plan anterior |
| **Revisión por abogado** | — | USD 200-800 one-time |
| **GDPR cookie banner** | Cookie Consent (open source) | Iubenda Cookie Solution USD 12/año |

**Recomendación:** templates gratis para Beta. Considerar abogado solo si el proyecto crece comercialmente.

---

## 9. Suscripciones de productividad (opcionales)

| Servicio | Costo | Necesidad real |
|---|---|---|
| **GitHub Copilot** | USD 10/mes | Opcional. |
| **Claude Pro** | USD 20/mes | Opcional. |
| **ChatGPT Plus** | USD 20/mes | Opcional. |
| **Notion Plus** | USD 8/mes (free para personal) | No necesario. |
| **Linear** | Free para 10 usuarios | No necesario. |

Estas son inversiones en la productividad del desarrollador, no del producto. No las cargo al budget oficial del proyecto.

---

## 10. Costos por fase — desglose

### Fase 0 — Setup (Sprint 1)
| Item | Costo |
|---|---|
| Todo el stack de desarrollo (gratis) | USD 0 |
| Aseprite (opcional, si arranca arte ya) | USD 20 one-time |
| **Subtotal Fase 0** | **USD 0-20 one-time** |

### Fase 1 — Prototipo de red (Sprints 2-3)
| Item | Costo |
|---|---|
| Sprites placeholder libres | USD 0 |
| Desarrollo local 100% | USD 0 |
| **Subtotal Fase 1** | **USD 0** |

### Fase 2 — Slice jugable (Sprints 4-5)
| Item | Costo |
|---|---|
| Mismo stack, sin nuevos servicios | USD 0 |
| **Subtotal Fase 2** | **USD 0** |

### Fase 3 — MVP cerrado (Sprints 6-8)
| Item | Costo recurrente |
|---|---|
| VPS dev/staging (Hetzner CX22) | USD 5/mes |
| Dominio (.com) amortizado | USD 1/mes |
| **Subtotal Fase 3** | **USD 6/mes × 3 sprints = USD 18** |
| Asset pack comercial opcional | USD 50-100 one-time |

### Fase 4 — Beta pública (Sprints 9-12)
| Item | Costo |
|---|---|
| VPS prod (Hetzner CCX13) | USD 15/mes |
| Backup VPS (~20%) | USD 3/mes |
| Dominio | USD 1/mes |
| Cloudflare Free | USD 0 |
| Email transaccional (Resend free) | USD 0 |
| Observabilidad (Sentry/Grafana free) | USD 0 |
| **Subtotal Fase 4** | **USD 19/mes × 4 sprints = USD 76** |
| **Decisión de assets** | **USD 0 (libres) ó USD 1.000-2.500 (comisión)** |

### Total mínimo hasta cierre de Beta

| Concepto | USD |
|---|---|
| One-time (Aseprite + domain anual) | 32 |
| Recurrente Fase 3-4 (5 meses × USD 19 promedio) | 95 |
| **Total mínimo realista** | **~USD 127** |
| **Total cómodo** (Copilot + asset pack + Sentry Team en Beta) | ~USD 400 |
| **Total con pixel-art comisionado** | USD 1.500-3.000 |

**Costos recurrentes post-Beta:** USD 25-40/mes (VPS + backup + dominio + extras menores).

---

## 11. Decisiones de inversión que requieren confirmación del usuario

1. **Assets gráficos** (D-1 / R-02) — la decisión más cara: USD 0 (libres) vs USD 1.000-3.000 (comisión). Revisar antes de Sprint 9.
2. **VPS provider** — Hetzner (más barato, requiere tarjeta internacional) vs Contabo (acepta más medios) vs DigitalOcean (más caro, panel pulido). Revisar antes de Sprint 7.
3. **Cloudflare Pro USD 20/mes** — diferir hasta tener métricas que lo justifiquen.
4. **GitHub Copilot u otra IDE pro** — preferencia personal del desarrollador, no del proyecto.
5. **Aseprite** — comprar si el usuario o el frontend-designer va a editar pixel-art. Si todo el arte es de terceros (libre o comisionado), no hace falta.

---

## 12. Riesgos económicos

| Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|
| **Tarjeta internacional rechazada** para pagar VPS (Argentina) | Media | Alto (bloquea deploy) | Tener Contabo / vendedor argentino como plan B. Confirmar método de pago antes de Sprint 10. |
| **Cargo inesperado por egress / bandwidth** | Baja | Medio | Hetzner incluye 20 TB/mes en CCX13, más que suficiente para 200 conexiones. No usar AWS/GCP que cobran egress. |
| **Asset pack o comisión paga genera arte inconsistente** | Media | Medio | Pedir muestras antes de pagar; pagar por hitos. |
| **Inflación de costos en USD para usuario Argentina** | Alta | Medio | Cotizar siempre en USD; presupuestar conservador. |
| **Donaciones tardan en cubrir el costo del VPS** | Alta | Bajo | Costo mensual bajo (USD 25-40) permite mantener sin ingresos. |

---

## 13. Próximas decisiones de cost-related para tomar

| Cuándo | Decisión |
|---|---|
| **Antes de Sprint 1** | Confirmar si se compra Aseprite (USD 20) y dominio (USD 12). Inversión total: USD 32. |
| **Antes de Sprint 7** | Elegir proveedor de VPS y confirmar método de pago. |
| **Antes de Sprint 9** | Confirmar estrategia de assets (libres vs comisión). Esto determina si hay un gasto de USD 0 o de USD 1.500. |
| **Antes de Sprint 11** | Confirmar dominio y configurar Cloudflare. |
| **Durante Sprint 12** | Habilitar canales de donación (Ko-fi + MercadoPago). |

---

*Próxima revisión: al cierre de Fase 2, con datos reales de consumo del entorno de desarrollo.*
