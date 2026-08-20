'use strict';

const asyncHandler = require('../utils/asyncHandler');
const authService = require('../services/auth.service');

const login = asyncHandler(async (req, res) => {
  const { identifier, password } = req.body;
  const { token, user } = await authService.login(identifier, password);
  res.json({ ok: true, token, user });
});

const me = asyncHandler(async (req, res) => {
  const user = await authService.getCurrentUser(req.user);
  res.json({ ok: true, user });
});

const logout = asyncHandler(async (req, res) => {
  await authService.logout(req.user);
  res.json({ ok: true });
});

module.exports = { login, me, logout };