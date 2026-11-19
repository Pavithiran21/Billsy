const { Router } = require('express');
const multer = require('multer');
const { passwordCheckLimiter } = require('../../middleware/rateLimiters');
const businessController = require('./business.controller');
const { LOGO_MAX_BYTES } = require('./business.service');

// The logo is kept in memory (at most 1 MB; a bigger file is stopped while it streams in) and
// goes straight into the LONGBLOB column. Only one file, in the "logo" field.
const logoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: LOGO_MAX_BYTES, files: 1, fields: 0 },
}).single('logo');

// Mounted at /api/business behind requireAuth. Role checks are in the service.
const businessRouter = Router();

businessRouter.get('/', businessController.getBusiness);
businessRouter.patch('/', businessController.updateBusiness);
businessRouter.get('/logo', businessController.getLogo);
businessRouter.put('/logo', logoUpload, businessController.setLogo);
businessRouter.delete('/logo', businessController.removeLogo);
businessRouter.post('/deactivate', passwordCheckLimiter, businessController.deactivate);
businessRouter.post('/reactivate', passwordCheckLimiter, businessController.reactivate);

module.exports = { businessRouter };
