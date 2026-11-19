import { Link } from 'react-router';
import { Logo } from '../../components/Logo';
import { Barcode, RDoubleSep, RFoot, RRow, RTotal, Receipt } from '../../components/Receipt';

// The Log in layout: a split card, the form on smooth paper on the left and, on the cream textured
// side, a tilted receipt with one line on correct GST. The receipt is an illustration of what
// Billsy prints (aria-hidden), not data from the server.

export function AuthSplit({ children }) {
  return (
    <div className="auth-page">
      <div className="auth">
        <div className="left">
          <Link to="/" className="wordmark">
            <Logo size={34} />
            <span>Billsy</span>
          </Link>
          <div className="box">{children}</div>
        </div>
        <div className="right" aria-hidden="true">
          <div style={{ width: 300, maxWidth: '100%', transform: 'rotate(-2deg)' }}>
            <Receipt title="Tax invoice" period="INV/2026-27/0042">
              <RRow label="Taxable value" value="54,587.00" />
              <RRow label="CGST" value="4,820.21" />
              <RRow label="SGST" value="4,820.20" />
              <RDoubleSep />
              <RTotal label="TOTAL" value="₹64,227.41" highlight />
              <RFoot>CGST + SGST · place of supply 29</RFoot>
              <Barcode />
            </Receipt>
          </div>
          <p style={{ marginTop: 22, maxWidth: 320, textAlign: 'center', color: 'var(--text)' }}>
            <b>Correct GST to the paisa.</b> CGST, SGST or IGST picked for you, and invoice numbers that never skip.
          </p>
        </div>
      </div>
    </div>
  );
}
