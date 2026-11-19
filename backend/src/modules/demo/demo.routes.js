const { Router } = require('express');
const { z } = require('zod');
const { loginIpLimiter } = require('../../middleware/rateLimiters');
const { setRefreshCookie } = require('../auth/authCookies');
const { toAccountResponse } = require('../users/account.mapper');
const demoService = require('./demo.service');

const demoLoginSchema = z.object({ role: z.enum(demoService.DEMO_ROLES, 'Choose Owner, Accountant or Staff.') });

async function listAccounts(_req, res) {
  res.json(demoService.listAccounts());
}

async function loginAs(req, res) {
  const { role } = demoLoginSchema.parse(req.body);
  const { context, session } = await demoService.loginAs(role);
  setRefreshCookie(res, session.refreshToken);
  res.json({ ...toAccountResponse(context), accessToken: session.accessToken });
}

// Mounted at /api/demo only when DEMO_MODE=true (routes.js).
const demoRouter = Router();

demoRouter.get('/accounts', listAccounts);
demoRouter.post('/login', loginIpLimiter, loginAs);

module.exports = { demoRouter };
