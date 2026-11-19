import {
  IconAlertTriangle,
  IconBan,
  IconCircleCheck,
  IconReceiptRefund,
  IconSend,
  IconUserCog,
  IconUserPlus,
  IconX,
} from '@tabler/icons-react';
import { useDispatch, useSelector } from 'react-redux';
import { toastClosed } from './toastSlice';

const ICONS = {
  check: IconCircleCheck,
  send: IconSend,
  credit: IconReceiptRefund,
  ban: IconBan,
  invite: IconUserPlus,
  role: IconUserCog,
  alert: IconAlertTriangle,
};

/** Receipt slips that print in at the bottom right (above the sticky action on phones). */
export function ToastStack() {
  const toasts = useSelector((state) => state.toasts);
  const dispatch = useDispatch();

  return (
    <div className="toasts">
      {toasts.map((toast) => {
        const Icon = ICONS[toast.icon] ?? IconCircleCheck;
        const isError = toast.kind === 'err';
        return (
          <div key={toast.id} className="toast-wrap">
            <div className={`toast ${isError ? 'err' : ''}`} role={isError ? 'alert' : 'status'}>
              <Icon size={19} className="ic" aria-hidden="true" />
              <span>
                {toast.text}
                {toast.strong ? (
                  <>
                    {' '}
                    <b className="mono">{toast.strong}</b>
                  </>
                ) : null}
                {toast.tail ? ` ${toast.tail}` : null}
              </span>
              {isError ? (
                <button type="button" className="x" aria-label="Close" onClick={() => dispatch(toastClosed(toast.id))}>
                  <IconX size={17} aria-hidden="true" />
                </button>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}
