import { Channel, ConsumeMessage } from 'amqplib';
import { resendInviteFromEvent } from '../../services/credentialService';
import { AUTH_SERVICE_EXCHANGE } from '../consumer';
import { parseEnvelope, publishInviteTokenGenerated } from '../utils';

interface UserInviteResentData {
  user_id: string;
  email: string;
}

export function handleUserInviteResent(channel: Channel) {
  return async (msg: ConsumeMessage | null): Promise<void> => {
    if (!msg) return;

    const envelope = parseEnvelope<UserInviteResentData>(msg, channel, 'user.invite_resent');
    if (!envelope) return;

    try {
      const { user_id, email } = envelope.data;
      const { inviteToken, expiresAt } = await resendInviteFromEvent(user_id);
      publishInviteTokenGenerated(
        channel,
        AUTH_SERVICE_EXCHANGE,
        { user_id, email, invite_token: inviteToken, expires_at: expiresAt.toISOString() },
        envelope.metadata.correlation_id,
      );
      channel.ack(msg);
    } catch (err) {
      console.error('user.invite_resent: unexpected error, sending to DLQ:', err);
      channel.nack(msg, false, false);
    }
  };
}