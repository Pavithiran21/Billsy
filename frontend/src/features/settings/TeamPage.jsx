import { zodResolver } from '@hookform/resolvers/zod';
import { IconUserPlus } from '@tabler/icons-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useDispatch } from 'react-redux';
import { z } from 'zod';
import { TableRegion } from '../../components/Controls';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { Dialog } from '../../components/Dialog';
import { Field } from '../../components/Field';
import { ErrorPanel, FormAlert, SkeletonCard } from '../../components/Panels';
import { Pill } from '../../components/Stamps';
import { useAccount } from '../../hooks/useAccount';
import { applyFieldErrors, errorMessage } from '../../lib/apiErrors';
import { ROLE_LABELS } from '../../lib/format';
import { emailField } from '../../lib/schemas';
import { showErrorToast, showToast } from '../../toasts/toastSlice';
import {
  useChangeRoleMutation,
  useInvitationsQuery,
  useInviteMutation,
  useMembersQuery,
  useRemoveMemberMutation,
  useResendInvitationMutation,
  useRevokeInvitationMutation,
} from './businessApi';

const SHORT_DATE = new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short' });
const shortDay = (timestamp) => SHORT_DATE.format(new Date(timestamp));

const inviteSchema = z.object({ email: emailField, role: z.enum(['staff', 'accountant'], 'Choose a role.') });

function InviteDialog({ businessName, onClose }) {
  const dispatch = useDispatch();
  const [invite, { isLoading }] = useInviteMutation();
  const [refusal, setRefusal] = useState(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm({ resolver: zodResolver(inviteSchema), defaultValues: { email: '', role: 'staff' } });

  const submit = handleSubmit(async (values) => {
    setRefusal(null);
    try {
      await invite(values).unwrap();
      dispatch(showToast({ icon: 'invite', text: `Invitation sent to ${values.email}` }));
      onClose();
    } catch (error) {
      if (error.code === 'EMAIL_NOT_SENT') {
        // The invitation is saved; only the email failed. It can be resent from the list.
        dispatch(showErrorToast(error.message));
        onClose();
      } else if (!applyFieldErrors(error, setError, ['email', 'role'])) {
        setRefusal(errorMessage(error));
      }
    }
  });

  return (
    <Dialog
      title={`Invite to ${businessName}`}
      onClose={onClose}
      onSubmit={submit}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-pri" disabled={isLoading}>
            {isLoading ? 'Sending…' : 'Send invitation'}
          </button>
        </>
      }
    >
      {refusal ? <FormAlert>{refusal}</FormAlert> : null}
      <Field id="invite-email" label="Email" type="email" data-autofocus error={errors.email?.message} {...register('email')} />
      <fieldset style={{ border: 0, padding: 0, margin: '0 0 6px' }}>
        <legend className="flabel">Role</legend>
        <label className="chk">
          <input type="radio" value="staff" {...register('role')} />{' '}
          <span>
            <b>Staff</b> · customers, products, invoices, payments
          </span>
        </label>
        <label className="chk">
          <input type="radio" value="accountant" {...register('role')} />{' '}
          <span>
            <b>Accountant</b> · view and export only
          </span>
        </label>
      </fieldset>
      <p className="muted xs">The link works once and expires in 7 days.</p>
    </Dialog>
  );
}

function MemberRow({ member, me, onRemove }) {
  const dispatch = useDispatch();
  const [changeRole, { isLoading }] = useChangeRoleMutation();
  const isOwner = member.role === 'owner';
  const selectId = `role-${member.userId}`;

  async function change(role) {
    try {
      await changeRole({ userId: member.userId, role }).unwrap();
      dispatch(showToast({ icon: 'role', text: `${member.name} is now ${role === 'accountant' ? 'an Accountant' : 'Staff'}` }));
    } catch (error) {
      dispatch(showErrorToast(errorMessage(error)));
    }
  }

  return (
    <tr>
      <td>
        <b>{member.name}</b> {member.userId === me ? <span className="muted xs">(you)</span> : null}
        <div className="muted xs">{member.email}</div>
      </td>
      <td data-l="Role">
        {isOwner ? (
          <Pill tone="issued">Owner</Pill>
        ) : (
          <>
            <label className="sr-only" htmlFor={selectId}>
              Role for {member.name}
            </label>
            <select
              id={selectId}
              className="inp"
              style={{ margin: 0, padding: '5px 8px', fontSize: 13, width: 'auto' }}
              value={member.role}
              disabled={isLoading}
              onChange={(event) => change(event.target.value)}
            >
              <option value="staff">Staff</option>
              <option value="accountant">Accountant</option>
            </select>
          </>
        )}
      </td>
      <td className="r">
        {isOwner ? null : member.isDemo ? (
          <span className="muted xs">Demo accounts can't be removed.</span>
        ) : (
          <button type="button" className="btn btn-text btn-sm btn-bad" onClick={() => onRemove(member)}>
            Remove
          </button>
        )}
      </td>
    </tr>
  );
}

function InvitationRow({ invitation }) {
  const dispatch = useDispatch();
  const [resend, { isLoading: resending }] = useResendInvitationMutation();
  const [revoke, { isLoading: revoking }] = useRevokeInvitationMutation();
  const expired = invitation.status === 'expired';

  async function doResend() {
    try {
      await resend(invitation.id).unwrap();
      dispatch(showToast({ icon: 'invite', text: `Invitation sent to ${invitation.email}` }));
    } catch (error) {
      dispatch(showErrorToast(errorMessage(error)));
    }
  }

  async function doRevoke() {
    try {
      await revoke(invitation.id).unwrap();
      dispatch(showToast({ text: `Invitation to ${invitation.email} revoked` }));
    } catch (error) {
      dispatch(showErrorToast(errorMessage(error)));
    }
  }

  return (
    <tr>
      <td>
        <b className="muted">{invitation.email}</b>
        <div className="muted xs">
          Invited {shortDay(invitation.createdAt)} by {invitation.invitedByName} · {expired ? 'expired' : 'expires'} {shortDay(invitation.expiresAt)}
        </div>
      </td>
      <td data-l="Role">
        <Pill tone={expired ? 'draft' : 'part'}>
          {expired ? 'Expired' : 'Pending'} · {ROLE_LABELS[invitation.role]}
        </Pill>
      </td>
      <td className="r">
        <button type="button" className="btn btn-sm" onClick={doResend} disabled={resending}>
          Resend
        </button>{' '}
        {!expired ? (
          <button type="button" className="btn btn-text btn-sm" onClick={doRevoke} disabled={revoking}>
            Revoke
          </button>
        ) : null}
      </td>
    </tr>
  );
}

/** /settings/team: members with role and Remove, invitations with Resend and Revoke (Owner, UI-UX screen 22). */
export function TeamPage() {
  const dispatch = useDispatch();
  const { user, business } = useAccount();
  const members = useMembersQuery();
  const invitations = useInvitationsQuery();
  const [removeMember] = useRemoveMemberMutation();
  const [inviting, setInviting] = useState(false);
  const [removing, setRemoving] = useState(null);

  async function confirmRemove() {
    await removeMember(removing.userId).unwrap();
    dispatch(showToast({ text: `${removing.name} removed` }));
    setRemoving(null);
  }

  let body;
  if (members.isLoading || invitations.isLoading) {
    body = <SkeletonCard label="Loading the team…" className="pad" />;
  } else if (members.error || invitations.error) {
    body = (
      <ErrorPanel
        error={members.error ?? invitations.error}
        className=""
        onRetry={() => {
          members.refetch();
          invitations.refetch();
        }}
      />
    );
  } else {
    body = (
      <TableRegion label="Team">
        <table className="tbl cards">
          <thead>
            <tr>
              <th>Person</th>
              <th>Role</th>
              <th>
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {members.data.items.map((member) => (
              <MemberRow key={member.userId} member={member} me={user.id} onRemove={setRemoving} />
            ))}
            {invitations.data.items.map((invitation) => (
              <InvitationRow key={invitation.id} invitation={invitation} />
            ))}
            {invitations.data.items.length === 0 ? (
              <tr>
                <td colSpan={3} className="muted sm">
                  No pending invitations
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </TableRegion>
    );
  }

  return (
    <div className="card card-clip" style={{ maxWidth: 980 }}>
      <div className="hd">
        <h1>Team</h1>
        <button type="button" className="btn btn-pri btn-sm" onClick={() => setInviting(true)}>
          <IconUserPlus size={15} aria-hidden="true" /> Invite
        </button>
      </div>
      {body}
      <div className="pager">One Owner per business. Removed people keep their name on the audit log; a role change applies on their next request.</div>
      {inviting ? <InviteDialog businessName={business.legalName} onClose={() => setInviting(false)} /> : null}
      {removing ? (
        <ConfirmDialog
          title={`Remove ${removing.name}?`}
          description="They are logged out at once and can't open this business any more. Their name stays on invoices they worked on."
          safeLabel="Keep them"
          confirmLabel="Remove"
          onConfirm={confirmRemove}
          onClose={() => setRemoving(null)}
        />
      ) : null}
    </div>
  );
}
