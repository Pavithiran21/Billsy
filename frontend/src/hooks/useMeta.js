import { useMetaQuery } from '../features/auth/authApi';

const EMPTY = { states: [], gstRates: [], paymentModes: [] };

/** States, GST rates and payment modes from GET /api/meta (fetched once and kept). */
export function useMeta() {
  const { data } = useMetaQuery();
  const meta = data ?? EMPTY;
  return {
    ...meta,
    stateName: (code) => meta.states.find((state) => state.code === code)?.name ?? code,
    modeLabel: (value) => meta.paymentModes.find((mode) => mode.value === value)?.label ?? value,
  };
}
