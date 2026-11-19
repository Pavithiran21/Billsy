import { useSelector } from 'react-redux';
import { selectAccount } from '../auth/authSlice';

/**
 * The signed-in person and what the screens need to decide what to show. The server checks every
 * permission again; this only hides buttons and menu items a role can't use.
 */
export function useAccount() {
  const account = useSelector(selectAccount);
  const membership = account?.membership ?? null;
  const role = membership?.role ?? null;
  const business = membership?.business ?? null;
  const active = business?.status === 'active';
  return {
    user: account?.user ?? null,
    membership,
    role,
    business,
    isOwner: role === 'owner',
    isAccountant: role === 'accountant',
    isStaff: role === 'staff',
    // Owner and Staff create and change things, while the business is active.
    canWrite: (role === 'owner' || role === 'staff') && active,
    canSeeReports: role === 'owner' || role === 'accountant',
    canSeeDashboard: role === 'owner' || role === 'staff',
  };
}
