/**
 * db.js – Persistencia en JSON simple (sin base de datos externa)
 * Las cuentas se guardan en backend/data/cuentas.json
 */
const fs   = require('fs');
const path = require('path');

const DATA_DIR  = path.join(__dirname, 'data');
const DB_FILE   = path.join(DATA_DIR, 'cuentas.json');

// Crear carpeta data si no existe
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);
if (!fs.existsSync(DB_FILE))  fs.writeFileSync(DB_FILE, '{}', 'utf8');

function leer() {
  try { return JSON.parse(fs.readFileSync(DB_FILE, 'utf8')); }
  catch { return {}; }
}

function guardar(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
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
