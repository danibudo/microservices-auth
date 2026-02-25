import { Channel, ConsumeMessage } from 'amqplib';
import { createFromEvent } from '../../services/credentialService';
import { Role } from '../../types/domain';
import { MessageEnvelope } from '../types';

const AUTH_SERVICE_EXCHANGE = 'auth-service.events';

interface UserCreatedData {
  user_id: string;
  email: string;
  role: Role;
}

export function handleUserCreated(channel: Channel) {
  return async (msg: ConsumeMessage | null): Promise<void> => {
    if (!msg) return;

    let envelope: MessageEnvelope<UserCreatedData>;
    try {
      envelope = JSON.parse(msg.content.toString()) as MessageEnvelope<UserCreatedData>;
    } catch {
      console.error('user.created: failed to parse message, sending to DLQ');
      channel.nack(msg, false, false);
      return;
    }

    try {
      const { user_id, email, role } = envelope.data;
      const { inviteToken, expiresAt } = await createFromEvent({ userId: user_id, email, role });

      channel.publish(
        AUTH_SERVICE_EXCHANGE,
        'auth.invite_token_generated',
        Buffer.from(
          JSON.stringify({
            event: 'auth.invite_token_generated',
            data: {
              user_id,
              invite_token: inviteToken,
              email,
              expires_at: expiresAt.toISOString(),
            },
            metadata: {
              timestamp: new Date().toISOString(),
              correlation_id: envelope.metadata.correlation_id,
            },
          }),
        ),
        { persistent: true },
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

function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code: string }).code === '23505'
  );
}