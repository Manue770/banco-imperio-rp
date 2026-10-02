require('dotenv').config();
const express   = require('express');
const cors      = require('cors');
const rateLimit = require('express-rate-limit');
const path      = require('path');
const db        = require('./db');
const {
  darRol, quitarRol, getMemberRoles,
  notificarCuentaNueva, notificarCompra, notificarBizum,
  notificarDeposito, notificarRetirada, notificarCobro,
  notificarAdminDinero,
} = require('./bot');

const app  = express();
const PORT = process.env.PORT || 3000;

// ══════════════════════════════════════════════════════════════════
//  CATÁLOGO TIENDA
// ══════════════════════════════════════════════════════════════════
const TIENDA = [
  { id: 'navaja',         nombre: 'Navaja',                    icono: '🔪', precio: 250   },
  { id: 'seguro_coche',   nombre: 'Seguro del coche',          icono: '🛡️', precio: 750   },
  { id: 'dron',           nombre: 'Dron',                      icono: '🚁', precio: 1000  },
  { id: 'joyas',          nombre: 'Joyas y relojes',           icono: '💎', precio: 1200  },
  { id: 'beretta',        nombre: 'Beretta M9',                icono: '🔫', precio: 3500  },
  { id: 'colt_m1911',     nombre: 'Colt M1911',                icono: '🔫', precio: 4250  },
  { id: 'desert_eagle',   nombre: 'Desert Eagle',              icono: '🔫', precio: 5500  },
  { id: 'skorpion',       nombre: 'Skorpion',                  icono: '🔫', precio: 7000  },
  { id: 'phyton',         nombre: 'Phyton de Colt (Revolver)', icono: '🔫', precio: 7500  },
  { id: 'tec9',           nombre: 'TEC-9',                     icono: '🔫', precio: 9500  },
  { id: '2pj',            nombre: '2 PJ',                      icono: '🔫', precio: 10000 },
  { id: 'm14',            nombre: 'M14',                       icono: '🔫', precio: 11500 },
  { id: 'remington_870',  nombre: 'Remington 870',             icono: '🔫', precio: 12500 },
  { id: 'kriss_vector',   nombre: 'Kriss Vector',              icono: '🔫', precio: 14500 },
  { id: 'ak47',           nombre: 'AK47',                      icono: '🔫', precio: 18500 },
  { id: 'ppsh41',         nombre: 'PPSH 41',                   icono: '🔫', precio: 18600 },
  { id: 'remington_msr',  nombre: 'Remington MSR',             icono: '🎯', precio: 25000 },
];

// ══════════════════════════════════════════════════════════════════
//  ROLES → ROL DE TIENDA
// ══════════════════════════════════════════════════════════════════
const ITEM_ROL = {
  navaja:        process.env.ROLE_NAVAJA,
  seguro_coche:  process.env.ROLE_SEGURO_COCHE,
  dron:          process.env.ROLE_DRON,
  joyas:         process.env.ROLE_JOYAS,
  beretta:       process.env.ROLE_BERETTA,
  colt_m1911:    process.env.ROLE_COLT_M1911,
  desert_eagle:  process.env.ROLE_DESERT_EAGLE,
  skorpion:      process.env.ROLE_SKORPION,
  phyton:        process.env.ROLE_PHYTON,
  tec9:          process.env.ROLE_TEC9,
  '2pj':         process.env.ROLE_2PJ,
  m14:           process.env.ROLE_M14,
  remington_870: process.env.ROLE_REMINGTON_870,
  kriss_vector:  process.env.ROLE_KRISS_VECTOR,
  ak47:          process.env.ROLE_AK47,
  ppsh41:        process.env.ROLE_PPSH41,
  remington_msr: process.env.ROLE_REMINGTON_MSR,
};

// ══════════════════════════════════════════════════════════════════
//  SALARIOS POR ROL  (se acreditan en el banco, no en efectivo)
// ══════════════════════════════════════════════════════════════════
const SALARIOS = {
  '1338253228349063335': 200,
  '1338253228260720734': 1150,
  '1338253228298469402': 5100,
  '1338253228286152775': 1450,
  '1338253228298469404': 1150,
  '1373758884187209910': 370,
  '1338253228319703096': 370,
  '1338253228306862106': 370,
  '1338253228306862109': 370,
  '1338253228306862112': 370,
  '1338253228306862105': 1050,
  '1338253228218777694': 260,
  '1338253228306862111': 1230,
  '1338253228306862108': 1160,
  '1555275063245152416': 1000000000000,
};

// Cooldown entre cobros: 24 horas
const COOLDOWN_MS = 24 * 60 * 60 * 1000;

// ══════════════════════════════════════════════════════════════════
//  MIDDLEWARE
// ══════════════════════════════════════════════════════════════════
app.use(cors({
  origin: [
    'https://dulcet-dasik-3b2adb.netlify.app',
    'http://localhost:3000',
    'http://127.0.0.1:5500',
  ],
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'x-api-secret'],
}));
app.use(express.json());

const limiter = rateLimit({ windowMs: 60_000, max: 30 });
app.use('/api', limiter);

function auth(req, res, next) {
  if (req.headers['x-api-secret'] !== process.env.API_SECRET)
    return res.status(401).json({ ok: false, error: 'No autorizado.' });
  next();
}

function horaAhora() {
  const n = new Date();
  return `${n.getDate()} oct, ${String(n.getHours()).padStart(2,'0')}:${String(n.getMinutes()).padStart(2,'0')}`;
}

// ══════════════════════════════════════════════════════════════════
//  RUTAS
// ══════════════════════════════════════════════════════════════════

app.get('/api/ping', (_req, res) => res.json({ ok: true, mensaje: '🏦 Backend Banco Imperio RP activo' }));

// ── POST /api/registro ──────────────────────────────────────────
app.post('/api/registro', auth, async (req, res) => {
  const { discordId, nombre, pin, banco } = req.body;
  if (!discordId || !/^\d{17,20}$/.test(discordId)) return res.status(400).json({ ok: false, error: 'ID de Discord inválido.' });
  if (!nombre || nombre.trim().length < 2)           return res.status(400).json({ ok: false, error: 'Nombre inválido.' });
  if (!pin || !/^\d{4}$/.test(pin))                  return res.status(400).json({ ok: false, error: 'PIN debe ser 4 dígitos.' });
  if (!['caixabank','santander','revolut','bbva','cajamar'].includes(banco))
    return res.status(400).json({ ok: false, error: 'Banco no válido.' });
  if (db.existeCuenta(discordId))
    return res.status(409).json({ ok: false, error: 'Ya tienes una cuenta bancaria creada. Solo se permite una por persona.' });

  // Verificar que el ID existe en Discord (obligatorio)
  try {
    const existe = await verificarUsuarioDiscord(discordId);
    if (!existe)
      return res.status(404).json({ ok: false, error: 'Ese ID de Discord no corresponde a ningún miembro del servidor. Comprueba que sea correcto.' });
  } catch (err) {
    return res.status(503).json({ ok: false, error: 'No se pudo verificar el ID en Discord. El bot debe estar activo para crear cuentas.' });
  }

  const cuenta = {
    discordId, nombre: nombre.trim(), pin, banco,
    saldo: 1000, efectivo: 0,
    num4: String(Math.floor(Math.random() * 9000) + 1000),
    movimientos: [{ tipo: 'inc', desc: 'Bono de bienvenida', monto: 1000, fecha: horaAhora() }],
    compras: [], ultimoCobro: null,
  };
  db.setCuenta(discordId, cuenta);
  try { await notificarCuentaNueva(cuenta); } catch (_) {}
  const { pin: _p, ...pub } = cuenta;
  res.json({ ok: true, cuenta: pub });
});

// ── POST /api/login ─────────────────────────────────────────────
app.post('/api/login', auth, (req, res) => {
  const { discordId, pin } = req.body;
  if (!discordId || !/^\d{17,20}$/.test(discordId)) return res.status(400).json({ ok: false, error: 'ID inválido.' });
  const cuenta = db.getCuenta(discordId);
  if (!cuenta)             return res.status(404).json({ ok: false, error: 'Cuenta no encontrada.' });
  if (cuenta.pin !== pin)  return res.status(401).json({ ok: false, error: 'PIN incorrecto.' });
  const { pin: _p, ...pub } = cuenta;
  res.json({ ok: true, cuenta: pub });
});

// ── GET /api/cuenta/:discordId ──────────────────────────────────
app.get('/api/cuenta/:discordId', auth, (req, res) => {
  const cuenta = db.getCuenta(req.params.discordId);
  if (!cuenta) return res.status(404).json({ ok: false, error: 'Cuenta no encontrada.' });
  const { pin: _p, ...pub } = cuenta;
  res.json({ ok: true, cuenta: pub });
});

// ── POST /api/depositar ─────────────────────────────────────────
app.post('/api/depositar', auth, async (req, res) => {
  const { discordId, monto } = req.body;
  const cuenta = db.getCuenta(discordId);
  if (!cuenta) return res.status(404).json({ ok: false, error: 'Cuenta no encontrada.' });
  const cantidad = parseInt(monto);
  if (!cantidad || cantidad <= 0) return res.status(400).json({ ok: false, error: 'Monto inválido.' });
  if (cantidad > cuenta.efectivo) return res.status(400).json({ ok: false, error: 'Efectivo insuficiente.' });

  cuenta.efectivo -= cantidad;
  cuenta.saldo    += cantidad;
  cuenta.movimientos.unshift({ tipo: 'inc', desc: 'Depósito en cuenta', monto: cantidad, fecha: horaAhora() });
  db.setCuenta(discordId, cuenta);
  try { await notificarDeposito(discordId, cuenta.nombre, cantidad, cuenta.saldo); } catch (_) {}
  const { pin: _p, ...pub } = cuenta;
  res.json({ ok: true, cuenta: pub });
});

// ── POST /api/sacar ─────────────────────────────────────────────
app.post('/api/sacar', auth, async (req, res) => {
  const { discordId, monto } = req.body;
  const cuenta = db.getCuenta(discordId);
  if (!cuenta) return res.status(404).json({ ok: false, error: 'Cuenta no encontrada.' });
  const cantidad = parseInt(monto);
  if (!cantidad || cantidad <= 0) return res.status(400).json({ ok: false, error: 'Monto inválido.' });
  if (cantidad > cuenta.saldo)    return res.status(400).json({ ok: false, error: 'Saldo bancario insuficiente.' });

  cuenta.saldo    -= cantidad;
  cuenta.efectivo += cantidad;
  cuenta.movimientos.unshift({ tipo: 'dec', desc: 'Retirada en efectivo', monto: cantidad, fecha: horaAhora() });
  db.setCuenta(discordId, cuenta);
  try { await notificarRetirada(discordId, cuenta.nombre, cantidad, cuenta.efectivo); } catch (_) {}
  const { pin: _p, ...pub } = cuenta;
  res.json({ ok: true, cuenta: pub });
});

// ── POST /api/bizum ─────────────────────────────────────────────
app.post('/api/bizum', auth, async (req, res) => {
  const { discordIdOrigen, discordIdDestino, monto, metodo } = req.body;
  if (!['efectivo','tarjeta'].includes(metodo)) return res.status(400).json({ ok: false, error: 'Método inválido.' });
  const origen  = db.getCuenta(discordIdOrigen);
  const destino = db.getCuenta(discordIdDestino);
  if (!origen)  return res.status(404).json({ ok: false, error: 'Cuenta origen no encontrada.' });
  if (!destino) return res.status(404).json({ ok: false, error: `No existe cuenta con el ID ${discordIdDestino}.` });
  if (discordIdOrigen === discordIdDestino) return res.status(400).json({ ok: false, error: 'No puedes enviarte a ti mismo.' });
  const cantidad = parseInt(monto);
  if (!cantidad || cantidad <= 0) return res.status(400).json({ ok: false, error: 'Monto inválido.' });

  if (metodo === 'efectivo') {
    if (cantidad > origen.efectivo) return res.status(400).json({ ok: false, error: 'Efectivo insuficiente.' });
    origen.efectivo  -= cantidad;
    destino.efectivo += cantidad;
  } else {
    if (cantidad > origen.saldo) return res.status(400).json({ ok: false, error: 'Saldo bancario insuficiente.' });
    origen.saldo  -= cantidad;
    destino.saldo += cantidad;
  }
  origen.movimientos.unshift({ tipo: 'dec', desc: `Bizum (${metodo}) → ${destino.nombre} [${discordIdDestino.slice(-4)}]`, monto: cantidad, fecha: horaAhora() });
  destino.movimientos.unshift({ tipo: 'inc', desc: `Bizum (${metodo}) ← ${origen.nombre} [${discordIdOrigen.slice(-4)}]`,  monto: cantidad, fecha: horaAhora() });
  db.setCuenta(discordIdOrigen,  origen);
  db.setCuenta(discordIdDestino, destino);
  try { await notificarBizum(discordIdDestino, origen.nombre, cantidad, metodo); } catch (_) {}
  const { pin: _p, ...pub } = origen;
  res.json({ ok: true, cuenta: pub });
});

// ── POST /api/comprar ───────────────────────────────────────────
app.post('/api/comprar', auth, async (req, res) => {
  const { discordId, itemId } = req.body;
  const cuenta = db.getCuenta(discordId);
  if (!cuenta) return res.status(404).json({ ok: false, error: 'Cuenta no encontrada.' });
  const item = TIENDA.find(i => i.id === itemId);
  if (!item)   return res.status(404).json({ ok: false, error: 'Item no encontrado.' });

  // ── Solo se puede comprar 1 artículo por persona ──────────────
  if (cuenta.compras && cuenta.compras.length > 0) {
    const compraAnterior = cuenta.compras[0];
    return res.status(403).json({
      ok: false,
      error: `Ya tienes un artículo comprado: ${compraAnterior.nombre}. Solo se permite una compra por cuenta.`,
    });
  }

  if ((cuenta.efectivo || 0) < item.precio)
    return res.status(400).json({ ok: false, error: `Efectivo insuficiente. Necesitas €${item.precio.toLocaleString()}.` });

  cuenta.efectivo -= item.precio;
  cuenta.compras   = cuenta.compras || [];
  cuenta.compras.push({ itemId: item.id, nombre: item.nombre, precio: item.precio, fecha: horaAhora() });
  cuenta.movimientos.unshift({ tipo: 'dec', desc: `Compra: ${item.nombre}`, monto: item.precio, fecha: horaAhora() });
  db.setCuenta(discordId, cuenta);

  const rolId = ITEM_ROL[itemId];
  let rolDado = false;
  if (rolId) {
    try { await darRol(discordId, rolId); rolDado = true; }
    catch (err) { console.error(`[ROLES] Error dando rol ${rolId}:`, err.message); }
  }
  try { await notificarCompra(discordId, cuenta.nombre, item, rolDado); } catch (_) {}
  const { pin: _p, ...pub } = cuenta;
  res.json({ ok: true, cuenta: pub, rolDado });
});

// ── POST /api/cobrar ────────────────────────────────────────────
//  Comprueba los roles del miembro en Discord y acredita el salario
app.post('/api/cobrar', auth, async (req, res) => {
  const { discordId } = req.body;
  const cuenta = db.getCuenta(discordId);
  if (!cuenta) return res.status(404).json({ ok: false, error: 'Cuenta no encontrada.' });

  // ── Cooldown: solo se puede cobrar 1 vez cada 24 h ──────────────
  if (cuenta.ultimoCobro) {
    const diff = Date.now() - new Date(cuenta.ultimoCobro).getTime();
    if (diff < COOLDOWN_MS) {
      const horasRestantes = Math.ceil((COOLDOWN_MS - diff) / 3_600_000);
      return res.status(429).json({
        ok: false,
        error: `Ya cobraste hoy. Podrás volver a cobrar en ${horasRestantes}h.`,
      });
    }
  }

  // ── Obtener roles del miembro desde Discord ──────────────────────
  let rolesDelMiembro = [];
  try {
    rolesDelMiembro = await getMemberRoles(discordId);
  } catch (err) {
    return res.status(500).json({ ok: false, error: 'No se pudo verificar roles en Discord. Asegúrate de que el bot esté activo.' });
  }

  // ── Calcular salario total ───────────────────────────────────────
  let totalSalario = 0;
  const rolesEncontrados = [];

  for (const rolId of rolesDelMiembro) {
    if (SALARIOS[rolId]) {
      totalSalario += SALARIOS[rolId];
      rolesEncontrados.push({ rolId, monto: SALARIOS[rolId] });
    }
  }

  if (totalSalario === 0) {
    return res.status(403).json({
      ok: false,
      error: 'No tienes ningún rol con salario asignado en el servidor.',
    });
  }

  // ── Acreditar en el banco ────────────────────────────────────────
  cuenta.saldo += totalSalario;
  cuenta.ultimoCobro = new Date().toISOString();
  cuenta.movimientos.unshift({
    tipo: 'inc',
    desc: `💼 Nómina cobrada (${rolesEncontrados.length} rol${rolesEncontrados.length > 1 ? 'es' : ''})`,
    monto: totalSalario,
    fecha: horaAhora(),
  });
  db.setCuenta(discordId, cuenta);

  // ── Notificar en canal ───────────────────────────────────────────
  try { await notificarCobro(discordId, cuenta.nombre, totalSalario, rolesEncontrados, cuenta.saldo); } catch (_) {}

  const { pin: _p, ...pub } = cuenta;
  res.json({ ok: true, cuenta: pub, totalSalario, rolesEncontrados });
});

// ── GET /api/admin/es-admin/:discordId ─────────────────────────
//  Comprueba si el usuario tiene el rol de admin
app.get('/api/admin/es-admin/:discordId', auth, async (req, res) => {
  const { discordId } = req.params;
  try {
    const roles  = await getMemberRoles(discordId);
    const esAdmin = roles.includes(process.env.ADMIN_ROLE);
    res.json({ ok: true, esAdmin });
  } catch (err) {
    res.json({ ok: true, esAdmin: false });
  }
});

// ── POST /api/admin/anadir-dinero ───────────────────────────────
//  Solo accesible si el usuario tiene el rol ADMIN_ROLE
app.post('/api/admin/anadir-dinero', auth, async (req, res) => {
  const { discordIdAdmin, discordIdDestino, monto, motivo } = req.body;

  if (!discordIdAdmin) return res.status(400).json({ ok: false, error: 'Falta el ID del admin.' });
  if (!discordIdDestino || !/^\d{17,20}$/.test(discordIdDestino))
    return res.status(400).json({ ok: false, error: 'ID de destino inválido.' });
  if (!motivo || motivo.trim().length < 3)
    return res.status(400).json({ ok: false, error: 'El motivo debe tener al menos 3 caracteres.' });

  const cantidad = parseInt(monto);
  if (!cantidad || cantidad <= 0)
    return res.status(400).json({ ok: false, error: 'Monto inválido.' });

  // Verificar que el admin tiene el rol en Discord
  let esAdmin = false;
  try {
    const roles = await getMemberRoles(discordIdAdmin);
    esAdmin = roles.includes(process.env.ADMIN_ROLE);
  } catch (err) {
    return res.status(500).json({ ok: false, error: 'No se pudo verificar el rol en Discord.' });
  }
  if (!esAdmin)
    return res.status(403).json({ ok: false, error: 'No tienes permisos de administrador bancario.' });

  // Verificar que la cuenta destino existe
  const destino = db.getCuenta(discordIdDestino);
  if (!destino)
    return res.status(404).json({ ok: false, error: `No existe ninguna cuenta con el ID ${discordIdDestino}.` });

  // Añadir dinero al banco de la cuenta destino
  destino.saldo += cantidad;
  destino.movimientos.unshift({
    tipo: 'inc',
    desc: `💼 Ingreso admin: ${motivo.trim()}`,
    monto: cantidad,
    fecha: horaAhora(),
  });
  db.setCuenta(discordIdDestino, destino);

  // Notificar en canal de logs
  try { await notificarAdminDinero(discordIdAdmin, discordIdDestino, destino.nombre, cantidad, motivo.trim(), destino.saldo); } catch (_) {}

  const { pin: _p, ...pub } = destino;
  res.json({ ok: true, cuenta: pub, mensaje: `Se añadieron € ${cantidad.toLocaleString()} a ${destino.nombre}.` });
});


app.use(express.static(path.join(__dirname, '..')));

// ── SPA fallback: cualquier ruta no-API devuelve index.html ─────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'index.html'));
});

// ── 404 solo para /api ───────────────────────────────────────────
app.use('/api', (_req, res) => res.status(404).json({ ok: false, error: 'Ruta no encontrada.' }));

app.listen(PORT, () => console.log(`🏦 Banco Imperio RP corriendo en http://localhost:${PORT}`));
