const { Router } = require('express');
const { env } = require('./config/env');
const { requireAuth } = require('./middleware/requireAuth');
const { authRouter } = require('./modules/auth/auth.routes');
const { businessRouter } = require('./modules/business/business.routes');
const { creditNoteRouter } = require('./modules/creditNotes/creditNote.routes');
const { customerRouter } = require('./modules/customers/customer.routes');
const { invoiceRouter } = require('./modules/invoices/invoice.routes');
const { metaRouter } = require('./modules/meta/meta.routes');
const { paymentRouter } = require('./modules/payments/payment.routes');
const { productRouter } = require('./modules/products/product.routes');
const { dashboardRouter, reportRouter } = require('./modules/reports/report.routes');
const { invitationRouter, teamRouter } = require('./modules/team/team.routes');
const { profileRouter } = require('./modules/users/profile.routes');

// Every API route is mounted here, under /api (see app.js). Logging in only proves who the
// caller is; which role may do what is checked in each service (utils/roles.js, BACKEND.md).
const apiRouter = Router();

// Public
apiRouter.use(metaRouter);
apiRouter.use('/auth', authRouter);
apiRouter.use('/invitations', invitationRouter);
// "Log in as <role>" buttons: demos only (DEMO_MODE=true), never a normal run.
if (env.DEMO_MODE) {
  apiRouter.use('/demo', require('./modules/demo/demo.routes').demoRouter);
}

// Logged in (requireAuth loads req.ctx: the user, their role and their business)
apiRouter.use('/me', requireAuth, profileRouter);
apiRouter.use('/business', requireAuth, businessRouter);
apiRouter.use('/team', requireAuth, teamRouter);
apiRouter.use('/customers', requireAuth, customerRouter);
apiRouter.use('/products', requireAuth, productRouter);
apiRouter.use('/invoices', requireAuth, invoiceRouter);
apiRouter.use('/credit-notes', requireAuth, creditNoteRouter);
apiRouter.use('/payments', requireAuth, paymentRouter);
apiRouter.use('/reports', requireAuth, reportRouter);
apiRouter.use('/dashboard', requireAuth, dashboardRouter);

module.exports = { apiRouter };
