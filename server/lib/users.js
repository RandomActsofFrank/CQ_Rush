const bcrypt = require('bcryptjs');
const prisma = require('./prisma');
const { hashPassword } = require('./appConfig');

function normalizeCallsign(callsign) {
  return String(callsign || '').trim().toUpperCase();
}

function toPublicUser(user) {
  return {
    callsign: user.callsign,
    isAdmin: user.isAdmin,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt
  };
}

async function listUsers() {
  const users = await prisma.appUser.findMany({
    orderBy: { callsign: 'asc' }
  });
  return users.map(toPublicUser);
}

async function getUserCount() {
  return prisma.appUser.count();
}

async function createUser({ callsign, password, isAdmin = false }) {
  const normalized = normalizeCallsign(callsign);
  if (!normalized) {
    throw new Error('Callsign is required');
  }
  if (!password) {
    throw new Error('Password is required');
  }

  const existing = await prisma.appUser.findUnique({ where: { callsign: normalized } });
  if (existing) {
    throw new Error('A user with this callsign already exists');
  }

  const user = await prisma.appUser.create({
    data: {
      callsign: normalized,
      passwordHash: await hashPassword(password),
      isAdmin: Boolean(isAdmin)
    }
  });

  return toPublicUser(user);
}

async function updateUser(callsign, { password, isAdmin }) {
  const normalized = normalizeCallsign(callsign);
  const existing = await prisma.appUser.findUnique({ where: { callsign: normalized } });
  if (!existing) {
    throw new Error('User not found');
  }

  const data = {};
  if (password) {
    if (password.length < 4) {
      throw new Error('Password must be at least 4 characters');
    }
    data.passwordHash = await hashPassword(password);
  }
  if (isAdmin !== undefined) {
    data.isAdmin = Boolean(isAdmin);
  }

  const user = await prisma.appUser.update({
    where: { callsign: normalized },
    data
  });

  return toPublicUser(user);
}

async function deleteUser(callsign) {
  const normalized = normalizeCallsign(callsign);
  await prisma.appUser.delete({ where: { callsign: normalized } });
}

async function verifyUserPassword(callsign, password) {
  const normalized = normalizeCallsign(callsign);
  if (!normalized || !password) {
    return null;
  }

  const user = await prisma.appUser.findUnique({ where: { callsign: normalized } });
  if (!user) {
    return null;
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    return null;
  }

  return user;
}

async function changeUserPassword(callsign, currentPassword, newPassword) {
  const normalized = normalizeCallsign(callsign);
  if (!currentPassword) {
    throw new Error('Current password is required');
  }
  if (!newPassword || newPassword.length < 4) {
    throw new Error('New password must be at least 4 characters');
  }

  const user = await verifyUserPassword(normalized, currentPassword);
  if (!user) {
    throw new Error('Current password is incorrect');
  }

  return updateUser(normalized, { password: newPassword });
}

module.exports = {
  listUsers,
  getUserCount,
  createUser,
  updateUser,
  deleteUser,
  verifyUserPassword,
  changeUserPassword,
  normalizeCallsign,
  toPublicUser
};
