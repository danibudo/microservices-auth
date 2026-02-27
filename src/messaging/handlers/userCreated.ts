import { Channel, ConsumeMessage } from 'amqplib';
import { createFromEvent } from '../../services/credentialService';
import { Role } from '../../types/domain';
import { AUTH_SERVICE_EXCHANGE } from '../consumer';
import { parseEnvelope, publishInviteTokenGenerated } from '../utils';
import { isUniqueViolation } from '../../db/errors';

interface UserCreatedData {
  user_id: string;
  email: string;
  role: Role;
}

export function handleUserCreated(channel: Channel) {
  return async (msg: ConsumeMessage | null): Promise<void> => {
    if (!msg) return;

    const envelope = parseEnvelope<UserCreatedData>(msg, channel, 'user.created');
    if (!envelope) return;

    try {
      const { user_id, email, role } = envelope.data;
      const { inviteToken, expiresAt } = await createFromEvent({ userId: user_id, email, role });
      publishInviteTokenGenerated(
        channel,
        AUTH_SERVICE_EXCHANGE,
        { user_id, email, invite_token: inviteToken, expires_at: expiresAt.toISOString() },
        envelope.metadata.correlation_id,
      );
      channel.ack(msg);
    } catch (err) {
      if (isUniqueViolation(err)) {
        console.warn('user.created: duplicate event for user, acknowledging');
        channel.ack(msg);
        return;
      }
      console.error('user.created: unexpected error, sending to DLQ:', err);
      channel.nack(msg, false, false);
    }
  };
}