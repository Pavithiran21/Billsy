import { Logo } from './Logo';

// The Digital Receipt Summary Card: cream thermal paper, label · dot leader · value rows, dashed and
// double rules, a bold TOTAL (optionally on a mustard highlight) and a serrated bottom edge (a CSS
// mask; the shadow sits on the wrapper so it follows the edge). Used for every total in Billsy.

export function Receipt({ title, period, icon, label, doc = false, className = '', style, wrapStyle, children }) {
  return (
    <div className="rcpt-wrap" style={wrapStyle}>
      <div className={`rcpt ${doc ? 'rcpt-doc' : ''} ${className}`} role="region" aria-label={label} style={style}>
        {title ? (
          <div className="rh">
            {icon ?? <Logo size={20} />}
            <b>{title}</b>
            {period ? <span>{period}</span> : null}
          </div>
        ) : null}
        {children}
      </div>
    </div>
  );
}

/** label ······ value. variant: 'red' (overdue), 'neg' (received, green), 'sub' (a muted note line). */
export function RRow({ label, value, variant }) {
  if (variant === 'sub') {
    return (
      <div className="rrow sub">
        <span>{label}</span>
      </div>
    );
  }
  return (
    <div className={`rrow ${variant ?? ''}`}>
      <span>{label}</span>
      <span className="lead" />
      <span className="v">{value}</span>
    </div>
  );
}

export function RTotal({ label, value, highlight = false, small = false }) {
  return (
    <div className={`rtotal ${highlight ? 'hl' : ''} ${small ? 'small' : ''}`}>
      <span>{label}</span>
      <span className="lead" />
      <span className="v">{value}</span>
    </div>
  );
}

export const RSep = () => <div className="sep" />;
export const RDoubleSep = () => <div className="dsep" />;
export const RFoot = ({ children }) => <div className="rfoot">{children}</div>;
export const Barcode = () => <div className="barcode" aria-hidden="true" />;
