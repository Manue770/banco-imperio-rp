require('dotenv').config();
const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  REST,
  Routes,
  SlashCommandBuilder,
} = require('discord.js');

const db = require('./db');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers, // requiere "Server Members Intent" en Discord Dev Portal
  ],
});

// ── Estado ────────────────────────────────────────────────────────
let botListo = false;

// ══════════════════════════════════════════════════════════════════
//  COMANDOS SLASH
// ══════════════════════════════════════════════════════════════════
const comandos = [
  new SlashCommandBuilder()
    .setName('cuenta')
    .setDescription('Consulta tu cuenta bancaria de Imperio RP')
    .toJSON(),
];

async function registrarComandos() {
  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
  try {
    await rest.put(
      Routes.applicationGuildCommands(client.user.id, process.env.GUILD_ID),
      { body: comandos }
    );
    console.log('[BOT] ✅ Comandos slash registrados.');
  } catch (err) {
    console.error('[BOT] Error registrando comandos:', err.message);
  }
}

// ══════════════════════════════════════════════════════════════════
//  ARRANQUE
// ══════════════════════════════════════════════════════════════════
client.once('clientReady', async () => {
  console.log(`🤖 Bot conectado como ${client.user.tag}`);
  botListo = true;
  await registrarComandos();
});

client.login(process.env.DISCORD_TOKEN).catch(err => {
  console.error('[BOT] Error al conectar:', err.message);
  console.warn('[BOT] ⚠️  Ve a Discord Developer Portal → Tu app → Bot → Privileged Gateway Intents → activa SERVER MEMBERS INTENT');
});

// ══════════════════════════════════════════════════════════════════
//  INTERACCIONES — comando /cuenta
// ══════════════════════════════════════════════════════════════════
client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;
  if (interaction.commandName !== 'cuenta') return;

  const discordId = interaction.user.id;
  const webUrl    = process.env.WEB_URL || 'http://localhost:3000';
  const cuenta    = db.getCuenta(discordId);

  if (cuenta) {
    const embed = new EmbedBuilder()
      .setColor(colorBanco(cuenta.banco))
      .setTitle('🏦 Tu cuenta bancaria · Imperio RP')
      .setDescription(`Hola **${cuenta.nombre}**, aquí tienes el resumen de tu cuenta.`)
      .addFields(
        { name: '🏛️ Banco',       value: nombreBanco(cuenta.banco),                      inline: true  },
        { name: '💳 Nº Cuenta',    value: `•••• •••• •••• ${cuenta.num4}`,                inline: true  },
        { name: '💰 Saldo banco',  value: `€ ${cuenta.saldo.toLocaleString()}`,            inline: true  },
        { name: '💵 Efectivo',     value: `€ ${(cuenta.efectivo || 0).toLocaleString()}`,  inline: true  },
        { name: '🛒 Compras',      value: `${(cuenta.compras || []).length} artículos`,    inline: true  },
        { name: '🌐 Portal web',   value: `[Acceder a mi banca online](${webUrl})`,        inline: false },
      )
      .setFooter({ text: 'Banco Imperio RP' })
      .setTimestamp();
    await interaction.reply({ embeds: [embed], ephemeral: true });
  } else {
    const embed = new EmbedBuilder()
      .setColor(0x1a56db)
      .setTitle('🏦 Banca Imperio RP')
      .setDescription(
        `Hola <@${discordId}>, **aún no tienes cuenta** en el banco.\n\n` +
        `Crea tu cuenta gratuita en el portal web y empieza a gestionar tu dinero en el roleplay.`
      )
      .addFields(
        { name: '🌐 Crear cuenta',  value: `[Abrir portal bancario](${webUrl})`,                                          inline: false },
        { name: '📋 Necesitas',     value: '• Tu **ID de Discord** (ya lo tienes)\n• Elegir un banco\n• PIN de 4 dígitos', inline: false },
      )
      .setFooter({ text: 'Banco Imperio RP · Imperio RP Server' })
      .setTimestamp();
    await interaction.reply({ embeds: [embed], ephemeral: true });
  }
});

// ══════════════════════════════════════════════════════════════════
//  HELPERS INTERNOS
// ══════════════════════════════════════════════════════════════════
async function getMember(discordId) {
  if (!botListo) throw new Error('Bot no conectado a Discord.');
  const guild  = await client.guilds.fetch(process.env.GUILD_ID);
  const member = await guild.members.fetch(discordId);
  return { guild, member };
}

async function logCanal(embed) {
  if (!botListo) return;
  const canalId = process.env.LOG_CHANNEL_ID;
  if (!canalId) return;
  try {
    const canal = await client.channels.fetch(canalId);
    await canal.send({ embeds: [embed] });
  } catch (err) {
    console.warn('[BOT] No se pudo enviar al canal de log:', err.message);
  }
}

function nombreBanco(key) {
  return { caixabank: 'CaixaBank', santander: 'Santander', revolut: 'Revolut', bbva: 'BBVA', cajamar: 'Cajamar' }[key] || key;
}

function colorBanco(key) {
  return { caixabank: 0x0066cc, santander: 0xe5001a, revolut: 0x191c1f, bbva: 0x004481, cajamar: 0x009ddb }[key] || 0x1a56db;
}

// ══════════════════════════════════════════════════════════════════
//  ROLES
// ══════════════════════════════════════════════════════════════════
async function darRol(discordId, rolId) {
  if (!rolId) throw new Error('rolId no definido.');
  const { member } = await getMember(discordId);
  if (member.roles.cache.has(rolId)) return false;
  await member.roles.add(rolId);
  console.log(`[ROLES] ✅ Rol ${rolId} dado a ${discordId}`);
  return true;
}

async function quitarRol(discordId, rolId) {
  if (!rolId) throw new Error('rolId no definido.');
  const { member } = await getMember(discordId);
  if (!member.roles.cache.has(rolId)) return false;
  await member.roles.remove(rolId);
  return true;
}

async function getMemberRoles(discordId) {
  const { member } = await getMember(discordId);
  return [...member.roles.cache.keys()];
}

// ══════════════════════════════════════════════════════════════════
//  NOTIFICACIONES
// ══════════════════════════════════════════════════════════════════
async function notificarCuentaNueva(cuenta) {
  if (!botListo) return;
  const webUrl = process.env.WEB_URL || 'http://localhost:3000';

  // DM de bienvenida
  try {
    const user = await client.users.fetch(cuenta.discordId);
    await user.send({ embeds: [
      new EmbedBuilder()
        .setColor(colorBanco(cuenta.banco))
        .setTitle('🎉 ¡Cuenta bancaria creada!')
        .setDescription(`Bienvenido **${cuenta.nombre}** a la banca de **Imperio RP**.`)
        .addFields(
          { name: '🏛️ Banco',        value: nombreBanco(cuenta.banco),       inline: true  },
          { name: '💳 Nº Cuenta',     value: `•••• •••• •••• ${cuenta.num4}`,  inline: true  },
          { name: '💰 Saldo inicial', value: '€ 1,000',                        inline: true  },
          { name: '🌐 Acceder',       value: `[Portal bancario](${webUrl})`,   inline: false },
        )
        .setFooter({ text: 'Banco Imperio RP · Usa /cuenta para ver tu saldo' })
        .setTimestamp()
    ]});
  } catch (err) {
    console.warn(`[BOT] No se pudo enviar DM de bienvenida a ${cuenta.discordId}:`, err.message);
  }

  // Log en canal
  const canalId = process.env.LOG_CUENTAS_CHANNEL_ID;
  if (canalId) {
    try {
      const canal = await client.channels.fetch(canalId);
      await canal.send({ embeds: [
        new EmbedBuilder()
          .setColor(0x4ade80)
          .setTitle('🏦 Nueva cuenta creada')
          .addFields(
            { name: 'Jugador',   value: `${cuenta.nombre} (<@${cuenta.discordId}>)`, inline: true },
            { name: 'Banco',     value: nombreBanco(cuenta.banco),                    inline: true },
            { name: 'Nº Cuenta', value: `•••• •••• •••• ${cuenta.num4}`,             inline: true },
          )
          .setTimestamp()
      ]});
    } catch (err) {
      console.warn('[BOT] No se pudo enviar al canal de cuentas:', err.message);
    }
  }
}

async function notificarCompra(discordId, nombreJugador, item, rolDado) {
  if (!botListo) return;
  // DM al comprador
  try {
    const user = await client.users.fetch(discordId);
    await user.send({ embeds: [
      new EmbedBuilder()
        .setColor(0x1a56db)
        .setTitle(`${item.icono} ¡Compra confirmada!`)
        .setDescription(`Hola **${nombreJugador}**, tu compra ha sido procesada.`)
        .addFields(
          { name: 'Artículo', value: `${item.icono} ${item.nombre}`,                                            inline: true  },
          { name: 'Precio',   value: `€ ${item.precio.toLocaleString()}`,                                       inline: true  },
          { name: 'Rol',      value: rolDado ? '✅ Rol asignado automáticamente' : '⚠️ Sin rol configurado',    inline: false },
        )
        .setFooter({ text: 'Banco Imperio RP · Tienda' })
        .setTimestamp()
    ]});
  } catch (err) {
    console.warn(`[BOT] No se pudo enviar DM de compra a ${discordId}:`, err.message);
  }
  // Log en canal
  await logCanal(
    new EmbedBuilder()
      .setColor(0xf59e0b)
      .setTitle('🛒 Nueva compra en la tienda')
      .addFields(
        { name: '👤 Jugador',  value: `${nombreJugador} (<@${discordId}>)`, inline: true },
        { name: '📦 Artículo', value: `${item.icono} ${item.nombre}`,        inline: true },
        { name: '💶 Precio',   value: `€ ${item.precio.toLocaleString()}`,   inline: true },
        { name: '🎭 Rol',      value: rolDado ? '✅ Asignado' : '❌ Sin rol', inline: true },
      )
      .setFooter({ text: 'Banco Imperio RP · Tienda' })
      .setTimestamp()
  );
}

async function notificarBizum(discordIdDestino, nombreOrigen, cantidad, metodo) {
  if (!botListo) return;
  try {
    const user = await client.users.fetch(discordIdDestino);
    await user.send({ embeds: [
      new EmbedBuilder()
        .setColor(0x7c3aed)
        .setTitle('📲 Has recibido un Bizum')
        .addFields(
          { name: 'De',       value: nombreOrigen,                                          inline: true },
          { name: 'Cantidad', value: `€ ${cantidad.toLocaleString()}`,                      inline: true },
          { name: 'Método',   value: metodo === 'efectivo' ? '💵 Efectivo' : '💳 Tarjeta',  inline: true },
        )
        .setFooter({ text: 'Banco Imperio RP' })
        .setTimestamp()
    ]});
  } catch (err) {
    console.warn(`[BOT] No se pudo enviar DM de Bizum a ${discordIdDestino}:`, err.message);
  }
  const destCuenta = db.getCuenta(discordIdDestino);
  const destNombre = destCuenta?.nombre || `ID: ${discordIdDestino}`;
  await logCanal(
    new EmbedBuilder()
      .setColor(0x7c3aed)
      .setTitle('📲 Bizum realizado')
      .addFields(
        { name: '📤 Emisor',   value: nombreOrigen,                                         inline: true },
        { name: '📥 Receptor', value: `${destNombre} (<@${discordIdDestino}>)`,             inline: true },
        { name: '💶 Cantidad', value: `€ ${cantidad.toLocaleString()}`,                     inline: true },
        { name: '💳 Método',   value: metodo === 'efectivo' ? '💵 Efectivo' : '💳 Tarjeta', inline: true },
      )
      .setFooter({ text: 'Banco Imperio RP · Bizum' })
      .setTimestamp()
  );
}

async function notificarDeposito(discordId, nombre, cantidad, nuevoSaldo) {
  await logCanal(
    new EmbedBuilder()
      .setColor(0x4ade80)
      .setTitle('💰 Depósito bancario')
      .addFields(
        { name: '👤 Jugador',     value: `${nombre} (<@${discordId}>)`,     inline: true },
        { name: '💶 Depositado',  value: `€ ${cantidad.toLocaleString()}`,   inline: true },
        { name: '🏦 Nuevo saldo', value: `€ ${nuevoSaldo.toLocaleString()}`, inline: true },
      )
      .setFooter({ text: 'Banco Imperio RP · Depósito' })
      .setTimestamp()
  );
}

async function notificarRetirada(discordId, nombre, cantidad, nuevoEfectivo) {
  await logCanal(
    new EmbedBuilder()
      .setColor(0xf87171)
      .setTitle('💸 Retirada de efectivo')
      .addFields(
        { name: '👤 Jugador',        value: `${nombre} (<@${discordId}>)`,       inline: true },
        { name: '💶 Retirado',       value: `€ ${cantidad.toLocaleString()}`,     inline: true },
        { name: '💵 Nuevo efectivo', value: `€ ${nuevoEfectivo.toLocaleString()}`,inline: true },
      )
      .setFooter({ text: 'Banco Imperio RP · Retirada' })
      .setTimestamp()
  );
}

async function notificarCobro(discordId, nombre, total, roles, nuevoSaldo) {
  const detalle = roles.map(r => `<@&${r.rolId}>: +€${r.monto.toLocaleString()}`).join('\n') || '—';
  await logCanal(
    new EmbedBuilder()
      .setColor(0x22c55e)
      .setTitle('💼 Nómina cobrada')
      .addFields(
        { name: '👤 Jugador',     value: `${nombre} (<@${discordId}>)`,     inline: true  },
        { name: '💶 Total',       value: `€ ${total.toLocaleString()}`,      inline: true  },
        { name: '🏦 Nuevo saldo', value: `€ ${nuevoSaldo.toLocaleString()}`, inline: true  },
        { name: '🎭 Roles',       value: detalle,                            inline: false },
      )
      .setFooter({ text: 'Banco Imperio RP · Nómina' })
      .setTimestamp()
  );
}

module.exports = {
  darRol, quitarRol, getMemberRoles,
  notificarCuentaNueva, notificarCompra, notificarBizum,
  notificarDeposito, notificarRetirada, notificarCobro,
};
