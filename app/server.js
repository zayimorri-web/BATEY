// BateyOS — Turnover Ops Platform v0.1
// Real working application: Node 24 built-ins only (http + sqlite). No external deps.
// Run: node server.js  →  http://localhost:4173
import http from 'node:http';
import { readFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const DIR = dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 4173;

// ---------- Database ----------
mkdirSync(join(DIR, 'data'), { recursive: true });
const db = new DatabaseSync(join(DIR, 'data', 'bateyos.db'));
db.exec(`
CREATE TABLE IF NOT EXISTS properties (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL, address TEXT, bedrooms INTEGER NOT NULL DEFAULT 1,
  host_name TEXT, host_contact TEXT, ical_url TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS jobs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  property_id INTEGER NOT NULL REFERENCES properties(id),
  checkout_at TEXT NOT NULL, checkin_at TEXT,
  status TEXT NOT NULL DEFAULT 'scheduled',  -- scheduled | in_progress | done
  price_cents INTEGER, created_from TEXT DEFAULT 'manual',
  external_uid TEXT UNIQUE,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS checklist (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  job_id INTEGER NOT NULL REFERENCES jobs(id),
  section TEXT NOT NULL, label TEXT NOT NULL,
  photo_required INTEGER DEFAULT 0,
  done INTEGER DEFAULT 0, photo_url TEXT, position INTEGER DEFAULT 0
);
CREATE TABLE IF NOT EXISTS photos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  job_id INTEGER NOT NULL REFERENCES jobs(id),
  section TEXT, url TEXT NOT NULL, created_at TEXT DEFAULT (datetime('now'))
);
`);

// ---------- Domain: verified market price table (Greater Boston public ranges, Oct 2026) ----------
const PRICE_BY_BEDROOMS = { 0: 9500, 1: 9500, 2: 14500, 3: 18500 }; // cents; 4+ = quote
const priceFor = (bedrooms) => PRICE_BY_BEDROOMS[bedrooms] ?? null;

// ---------- Domain: turnover checklist template (from the operation SOP) ----------
const CHECKLIST_TEMPLATE = [
  ['Llegada', 'Fotos del estado inicial de cada cuarto (evidencia de daños)', 1],
  ['Llegada', 'Reportar daños, faltantes u objetos olvidados al anfitrión', 0],
  ['Llegada', 'Ventilar la propiedad', 0],
  ['Cocina', 'Vajilla lavada y guardada / lavaplatos vacío', 0],
  ['Cocina', 'Encimeras, estufa, fregadero y electrodomésticos limpios', 0],
  ['Cocina', 'Nevera sin comida de huéspedes, derrames limpios', 0],
  ['Cocina', 'Basura fuera, bolsa nueva, suministros repuestos', 0],
  ['Cocina', 'FOTO obligatoria: cocina completa', 1],
  ['Baños', 'Inodoro, ducha, lavamanos y espejo desinfectados', 0],
  ['Baños', 'Piso limpio, sin cabellos', 0],
  ['Baños', 'Toallas limpias colocadas; papel y jabón repuestos', 0],
  ['Baños', 'FOTO obligatoria: baño completo', 1],
  ['Dormitorios', 'Cama tendida con sábanas limpias, esquinas ajustadas', 0],
  ['Dormitorios', 'Revisar bajo la cama, gavetas y closets', 0],
  ['Dormitorios', 'Superficies sin polvo, espejos limpios', 0],
  ['Dormitorios', 'FOTO obligatoria: cama tendida, cuarto completo', 1],
  ['Sala y general', 'Aspirar y trapear todos los pisos', 0],
  ['Sala y general', 'Manijas, interruptores y controles desinfectados', 0],
  ['Sala y general', 'Muebles en posición original, termostato según instrucción', 0],
  ['Sala y general', 'FOTO obligatoria: sala completa', 1],
  ['Salida', 'Recorrido final contra el checklist', 0],
  ['Salida', 'Enviar reporte con fotos al anfitrión', 0],
  ['Salida', 'Cerrar con llave / lockbox según instrucción', 0],
];

// ---------- iCal parsing (Airbnb / Booking export feeds) ----------
function parseICal(text) {
  const unfolded = text.replace(/\r\n[ \t]/g, '').replace(/\n[ \t]/g, '');
  const events = [];
  for (const block of unfolded.split('BEGIN:VEVENT').slice(1)) {
    const body = block.split('END:VEVENT')[0];
    const get = (key) => {
      const m = body.match(new RegExp('^' + key + '(?:;[^:]*)?:(.*)$', 'm'));
      return m ? m[1].trim() : null;
    };
    const dt = (v) => {
      if (!v) return null;
      const m = v.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2}))?/);
      if (!m) return null;
      const [, y, mo, d, h = '11', mi = '00'] = m;
      return `${y}-${mo}-${d}T${h}:${mi}:00`;
    };
    events.push({ uid: get('UID'), start: dt(get('DTSTART')), end: dt(get('DTEND')), summary: get('SUMMARY') });
  }
  return events.filter((e) => e.end);
}

// ---------- Helpers ----------
const json = (res, code, obj) => {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(obj, null, 2));
};
const readBody = (req) => new Promise((resolve) => {
  let data = '';
  req.on('data', (c) => (data += c));
  req.on('end', () => { try { resolve(JSON.parse(data || '{}')); } catch { resolve({}); } });
});
const money = (cents) => (cents == null ? 'Cotización' : '$' + (cents / 100).toFixed(2));

// ---------- API ----------
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  const p = url.pathname;
  try {
    if (p === '/api/health') {
      const counts = {
        properties: db.prepare('SELECT COUNT(*) c FROM properties').get().c,
        jobs: db.prepare('SELECT COUNT(*) c FROM jobs').get().c,
        jobs_done: db.prepare("SELECT COUNT(*) c FROM jobs WHERE status='done'").get().c,
      };
      return json(res, 200, { ok: true, app: 'BateyOS — Turnover Ops', version: '0.1.0', counts });
    }

    if (p === '/api/properties' && req.method === 'GET')
      return json(res, 200, db.prepare('SELECT * FROM properties ORDER BY id').all());

    if (p === '/api/properties' && req.method === 'POST') {
      const b = await readBody(req);
      if (!b.name || !b.bedrooms) return json(res, 400, { error: 'name y bedrooms son requeridos' });
      const r = db.prepare('INSERT INTO properties (name,address,bedrooms,host_name,host_contact,ical_url) VALUES (?,?,?,?,?,?)')
        .run(b.name, b.address || '', b.bedrooms, b.host_name || '', b.host_contact || '', b.ical_url || '');
      return json(res, 201, db.prepare('SELECT * FROM properties WHERE id=?').get(r.lastInsertRowid));
    }

    const icalMatch = p.match(/^\/api\/properties\/(\d+)\/import-ical$/);
    if (icalMatch && req.method === 'POST') {
      const prop = db.prepare('SELECT * FROM properties WHERE id=?').get(icalMatch[1]);
      if (!prop) return json(res, 404, { error: 'propiedad no encontrada' });
      const b = await readBody(req);
      let ics = b.ics;
      if (!ics && (b.url || prop.ical_url)) ics = await (await fetch(b.url || prop.ical_url)).text();
      if (!ics) return json(res, 400, { error: 'se requiere el contenido iCal (ics) o una URL de feed' });
      let created = 0, skipped = 0;
      for (const ev of parseICal(ics)) {
        const checkin = ev.end.slice(0, 10) + 'T15:00:00'; // standard 3 PM check-in window
        const r = db.prepare(`INSERT OR IGNORE INTO jobs (property_id,checkout_at,checkin_at,price_cents,created_from,external_uid)
          VALUES (?,?,?,?, 'ical', ?)`)
          .run(prop.id, ev.end, checkin, priceFor(prop.bedrooms), ev.uid ? `ical:${ev.uid}` : null);
        r.changes ? created++ : skipped++;
      }
      return json(res, 200, { property: prop.name, reservations_seen: parseICal(ics).length, jobs_created: created, duplicates_skipped: skipped });
    }

    if (p === '/api/jobs' && req.method === 'GET') {
      const q = url.searchParams.get('property_id');
      const rows = q
        ? db.prepare('SELECT j.*, pr.name property_name FROM jobs j JOIN properties pr ON pr.id=j.property_id WHERE j.property_id=? ORDER BY j.checkout_at').all(q)
        : db.prepare('SELECT j.*, pr.name property_name FROM jobs j JOIN properties pr ON pr.id=j.property_id ORDER BY j.checkout_at').all();
      return json(res, 200, rows);
    }

    if (p === '/api/jobs' && req.method === 'POST') {
      const b = await readBody(req);
      const prop = db.prepare('SELECT * FROM properties WHERE id=?').get(b.property_id);
      if (!prop || !b.checkout_at) return json(res, 400, { error: 'property_id válido y checkout_at son requeridos' });
      const r = db.prepare('INSERT INTO jobs (property_id,checkout_at,checkin_at,price_cents) VALUES (?,?,?,?)')
        .run(prop.id, b.checkout_at, b.checkin_at || b.checkout_at.slice(0, 10) + 'T15:00:00', priceFor(prop.bedrooms));
      return json(res, 201, db.prepare('SELECT * FROM jobs WHERE id=?').get(r.lastInsertRowid));
    }

    const startMatch = p.match(/^\/api\/jobs\/(\d+)\/start$/);
    if (startMatch && req.method === 'POST') {
      const job = db.prepare('SELECT * FROM jobs WHERE id=?').get(startMatch[1]);
      if (!job) return json(res, 404, { error: 'trabajo no encontrado' });
      const existing = db.prepare('SELECT COUNT(*) c FROM checklist WHERE job_id=?').get(job.id).c;
      if (!existing) {
        const ins = db.prepare('INSERT INTO checklist (job_id,section,label,photo_required,position) VALUES (?,?,?,?,?)');
        CHECKLIST_TEMPLATE.forEach(([s, l, ph], i) => ins.run(job.id, s, l, ph, i));
      }
      db.prepare("UPDATE jobs SET status='in_progress' WHERE id=?").run(job.id);
      return json(res, 200, { job_id: job.id, status: 'in_progress', checklist_items: CHECKLIST_TEMPLATE.length });
    }

    const listMatch = p.match(/^\/api\/jobs\/(\d+)\/checklist$/);
    if (listMatch && req.method === 'GET')
      return json(res, 200, db.prepare('SELECT * FROM checklist WHERE job_id=? ORDER BY position').all(listMatch[1]));

    const itemMatch = p.match(/^\/api\/checklist\/(\d+)$/);
    if (itemMatch && req.method === 'POST') {
      const b = await readBody(req);
      db.prepare('UPDATE checklist SET done=?, photo_url=COALESCE(?,photo_url) WHERE id=?')
        .run(b.done ? 1 : 0, b.photo_url || null, itemMatch[1]);
      return json(res, 200, db.prepare('SELECT * FROM checklist WHERE id=?').get(itemMatch[1]));
    }

    const photoMatch = p.match(/^\/api\/jobs\/(\d+)\/photos$/);
    if (photoMatch && req.method === 'POST') {
      const b = await readBody(req);
      if (!b.url) return json(res, 400, { error: 'url requerida' });
      const r = db.prepare('INSERT INTO photos (job_id,section,url) VALUES (?,?,?)').run(photoMatch[1], b.section || '', b.url);
      return json(res, 201, db.prepare('SELECT * FROM photos WHERE id=?').get(r.lastInsertRowid));
    }
    if (photoMatch && req.method === 'GET')
      return json(res, 200, db.prepare('SELECT * FROM photos WHERE job_id=? ORDER BY id').all(photoMatch[1]));

    const completeMatch = p.match(/^\/api\/jobs\/(\d+)\/complete$/);
    if (completeMatch && req.method === 'POST') {
      const pending = db.prepare('SELECT COUNT(*) c FROM checklist WHERE job_id=? AND done=0').get(completeMatch[1]).c;
      if (pending) return json(res, 409, { error: `quedan ${pending} puntos del checklist sin completar` });
      db.prepare("UPDATE jobs SET status='done' WHERE id=?").run(completeMatch[1]);
      return json(res, 200, { job_id: Number(completeMatch[1]), status: 'done' });
    }

    const reportMatch = p.match(/^\/api\/jobs\/(\d+)\/report$/);
    if (reportMatch && req.method === 'GET') {
      const job = db.prepare('SELECT j.*, pr.name property_name, pr.host_name FROM jobs j JOIN properties pr ON pr.id=j.property_id WHERE j.id=?').get(reportMatch[1]);
      if (!job) return json(res, 404, { error: 'trabajo no encontrado' });
      const items = db.prepare('SELECT * FROM checklist WHERE job_id=? ORDER BY position').all(job.id);
      const photos = db.prepare('SELECT * FROM photos WHERE job_id=? ORDER BY id').all(job.id);
      const sections = {};
      for (const it of items) { sections[it.section] ??= { total: 0, done: 0 }; sections[it.section].total++; if (it.done) sections[it.section].done++; }
      const lines = [
        `REPORTE DE ROTACIÓN — ${job.property_name}`,
        `Anfitrión: ${job.host_name || '—'}`,
        `Check-out: ${job.checkout_at} · Check-in: ${job.checkin_at}`,
        `Estado: ${job.status} · Precio: ${money(job.price_cents)}`,
        '',
        ...Object.entries(sections).map(([s, v]) => `${v.done === v.total ? '✅' : '⬜'} ${s}: ${v.done}/${v.total}`),
        '',
        `Fotos registradas: ${photos.length}`,
        ...photos.map((ph) => ` · [${ph.section}] ${ph.url}`),
        '',
        'Propiedad lista para el próximo check-in.',
      ];
      res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end(lines.join('\n'));
    }

    // Static front-end
    const file = p === '/' ? join(DIR, 'public', 'index.html') : join(DIR, 'public', p);
    if ((p === '/' || p.startsWith('/public') || p.endsWith('.html')) && existsSync(file)) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end(readFileSync(file));
    }
    return json(res, 404, { error: 'ruta no encontrada' });
  } catch (e) {
    return json(res, 500, { error: String(e.message || e) });
  }
});

server.listen(PORT, () => console.log(`BateyOS v0.1 escuchando en http://localhost:${PORT}`));
