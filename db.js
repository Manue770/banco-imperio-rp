/**
 * db.js – Persistencia en JSON simple
 * Busca cuentas.json en la raíz del repo (Railway) o en data/ (local)
 */
const fs   = require('fs');
const path = require('path');

// En Railway el archivo está en la raíz del repo
// En local está en backend/data/cuentas.json
const ROOT_FILE = path.join(__dirname, 'cuentas.json');
const DATA_DIR  = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'cuentas.json');

// Determinar qué archivo usar
function getDbFile() {
  // Si existe en la raíz (Railway), usarlo
  if (fs.existsSync(ROOT_FILE)) return ROOT_FILE;
  // Si no, usar data/ (local)
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, '{}', 'utf8');
  return DATA_FILE;
}

function leer() {
  try { return JSON.parse(fs.readFileSync(getDbFile(), 'utf8')); }
  catch { return {}; }
}

function guardar(data) {
  fs.writeFileSync(getDbFile(), JSON.stringify(data, null, 2), 'utf8');
}

function getCuenta(discordId) {
  return leer()[discordId] || null;
}

function setCuenta(discordId, cuenta) {
  const db = leer();
  db[discordId] = cuenta;
  guardar(db);
}

function existeCuenta(discordId) {
  return !!leer()[discordId];
}

function todas() {
  return leer();
}

module.exports = { getCuenta, setCuenta, existeCuenta, todas };
