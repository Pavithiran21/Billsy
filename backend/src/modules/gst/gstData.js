// Fixed GST reference data: state codes, the accepted rates and the payment modes.
// The frontend reads all of it from GET /api/meta, so there is one source.

// GST state codes (the first two digits of a GSTIN). 25 (Daman and Diu) merged into 26 in 2020,
// and 28 was the old undivided Andhra Pradesh, so neither is used for new registrations.
const STATES = [
  { code: '01', name: 'Jammu and Kashmir' },
  { code: '02', name: 'Himachal Pradesh' },
  { code: '03', name: 'Punjab' },
  { code: '04', name: 'Chandigarh' },
  { code: '05', name: 'Uttarakhand' },
  { code: '06', name: 'Haryana' },
  { code: '07', name: 'Delhi' },
  { code: '08', name: 'Rajasthan' },
  { code: '09', name: 'Uttar Pradesh' },
  { code: '10', name: 'Bihar' },
  { code: '11', name: 'Sikkim' },
  { code: '12', name: 'Arunachal Pradesh' },
  { code: '13', name: 'Nagaland' },
  { code: '14', name: 'Manipur' },
  { code: '15', name: 'Mizoram' },
  { code: '16', name: 'Tripura' },
  { code: '17', name: 'Meghalaya' },
  { code: '18', name: 'Assam' },
  { code: '19', name: 'West Bengal' },
  { code: '20', name: 'Jharkhand' },
  { code: '21', name: 'Odisha' },
  { code: '22', name: 'Chhattisgarh' },
  { code: '23', name: 'Madhya Pradesh' },
  { code: '24', name: 'Gujarat' },
  { code: '26', name: 'Dadra and Nagar Haveli and Daman and Diu' },
  { code: '27', name: 'Maharashtra' },
  { code: '29', name: 'Karnataka' },
  { code: '30', name: 'Goa' },
  { code: '31', name: 'Lakshadweep' },
  { code: '32', name: 'Kerala' },
  { code: '33', name: 'Tamil Nadu' },
  { code: '34', name: 'Puducherry' },
  { code: '35', name: 'Andaman and Nicobar Islands' },
  { code: '36', name: 'Telangana' },
  { code: '37', name: 'Andhra Pradesh' },
  { code: '38', name: 'Ladakh' },
  { code: '97', name: 'Other Territory' },
];

const STATE_CODES = STATES.map((state) => state.code);

// Owner's choice, 16 Nov 2026: the GST 2.0 slabs (0, 5, 18, 40, plus 0.25 and 3 for special
// goods) and the older 12 and 28 that the approved design still uses. Stored as DECIMAL(5,2).
const GST_RATES = ['0.00', '0.25', '3.00', '5.00', '12.00', '18.00', '28.00', '40.00'];

const PAYMENT_MODES = [
  { value: 'upi', label: 'UPI' },
  { value: 'bank_transfer', label: 'Bank transfer' },
  { value: 'cash', label: 'Cash' },
  { value: 'cheque', label: 'Cheque' },
];

// 15 characters: state code, PAN (5 letters, 4 digits, 1 letter), entity number, "Z", check character.
const GSTIN_PATTERN = /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

function stateName(code) {
  return STATES.find((state) => state.code === code)?.name ?? code;
}

/** "29" -> "Karnataka (29)", as the screens and the PDF show it. */
function stateLabel(code) {
  return `${stateName(code)} (${code})`;
}

/** "18" or 18 or "18.0" -> "18.00" if it is an accepted rate, otherwise null. */
function normaliseRate(value) {
  const asNumber = Number(value);
  if (!Number.isFinite(asNumber)) {
    return null;
  }
  const fixed = asNumber.toFixed(2);
  return GST_RATES.includes(fixed) && /^\d{1,2}(\.\d{1,2})?$/.test(String(value).trim()) ? fixed : null;
}

module.exports = { STATES, STATE_CODES, GST_RATES, PAYMENT_MODES, GSTIN_PATTERN, stateName, stateLabel, normaliseRate };
