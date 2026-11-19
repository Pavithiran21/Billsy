const { z } = require('zod');
const { STATE_CODES } = require('../gst/gstData');
const { checkGstinMatchesState, optionalGstinSchema } = require('../gst/gstSchemas');
const { pageQuerySchema } = require('../../utils/pagination');
const { searchQuerySchema } = require('../../utils/search');
const { optionalEmailSchema, optionalText } = require('../../utils/validation');

const customerFields = {
  name: z.string().trim().min(1, "Enter the customer's name.").max(160, 'Use at most 160 characters.'),
  gstin: optionalGstinSchema,
  // Required: the customer's state is the place of supply.
  stateCode: z.enum(STATE_CODES, "Choose the customer's state; it decides CGST + SGST or IGST."),
  email: optionalEmailSchema,
  address: optionalText(500),
};

const createCustomerSchema = z.object(customerFields).superRefine(checkGstinMatchesState);

const updateCustomerSchema = z
  .object({ ...customerFields, version: z.number().int().positive() })
  .superRefine(checkGstinMatchesState);

const listCustomersQuerySchema = pageQuerySchema.extend({ q: searchQuerySchema });

module.exports = { createCustomerSchema, updateCustomerSchema, listCustomersQuerySchema };
