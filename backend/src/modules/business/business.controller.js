const businessService = require('./business.service');
const { passwordBodySchema, updateBusinessSchema } = require('./business.schemas');

async function getBusiness(req, res) {
  res.json(await businessService.getBusiness(req.ctx));
}

async function updateBusiness(req, res) {
  res.json(await businessService.updateBusiness(req.ctx, updateBusinessSchema.parse(req.body)));
}

async function getLogo(req, res) {
  const logo = await businessService.getLogo(req.ctx);
  // private: only this browser may cache it; nosniff: the browser keeps to the checked type.
  res.set({ 'Content-Type': logo.mime, 'Cache-Control': 'private, no-cache', 'X-Content-Type-Options': 'nosniff' });
  res.send(logo.bytes);
}

async function setLogo(req, res) {
  res.json(await businessService.setLogo(req.ctx, req.file));
}

async function removeLogo(req, res) {
  res.json(await businessService.removeLogo(req.ctx));
}

async function deactivate(req, res) {
  const { password } = passwordBodySchema.parse(req.body);
  res.json(await businessService.deactivate(req.ctx, password));
}

async function reactivate(req, res) {
  const { password } = passwordBodySchema.parse(req.body);
  res.json(await businessService.reactivate(req.ctx, password));
}

module.exports = { getBusiness, updateBusiness, getLogo, setLogo, removeLogo, deactivate, reactivate };
