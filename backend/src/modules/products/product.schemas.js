const { z } = require('zod');
const { gstRateSchema, hsnSacSchema } = require('../gst/gstSchemas');
const { pageQuerySchema } = require('../../utils/pagination');
const { searchQuerySchema } = require('../../utils/search');
const { moneyString } = require('../../utils/validation');

const productFields = {
  name: z.string().trim().min(1, 'Enter the item name.').max(160, 'Use at most 160 characters.'),
  hsnSac: hsnSacSchema,
  price: moneyString('Enter a rate of 0 or more, up to 2 decimals.'),
  gstRate: gstRateSchema,
};

const createProductSchema = z.object(productFields);

const updateProductSchema = z.object({ ...productFields, version: z.number().int().positive() });

const listProductsQuerySchema = pageQuerySchema.extend({ q: searchQuerySchema });

module.exports = { createProductSchema, updateProductSchema, listProductsQuerySchema };
