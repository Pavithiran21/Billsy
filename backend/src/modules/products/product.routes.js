const { Router } = require('express');
const productController = require('./product.controller');

// Mounted at /api/products behind requireAuth. Everyone reads; Owner and Staff write (service).
const productRouter = Router();

productRouter.get('/', productController.list);
productRouter.post('/', productController.create);
productRouter.get('/:id', productController.get);
productRouter.patch('/:id', productController.update);
productRouter.delete('/:id', productController.remove);

module.exports = { productRouter };
