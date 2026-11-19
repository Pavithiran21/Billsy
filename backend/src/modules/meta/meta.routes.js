const { Router } = require('express');
const { isDbUp } = require('../../db/knex');
const { GST_RATES, PAYMENT_MODES, STATES } = require('../gst/gstData');

const metaRouter = Router();

// Used by the start scripts and run-all-e2e to know the API is ready.
metaRouter.get('/health', async (_req, res) => {
  const dbUp = await isDbUp();
  res.status(dbUp ? 200 : 503).json({ status: dbUp ? 'ok' : 'degraded', db: dbUp ? 'up' : 'down' });
});

// Public reference data for the forms (state picker, GST rate select, payment modes).
metaRouter.get('/meta', (_req, res) => {
  res.set('Cache-Control', 'public, max-age=3600');
  res.json({ states: STATES, gstRates: GST_RATES, paymentModes: PAYMENT_MODES });
});

module.exports = { metaRouter };
