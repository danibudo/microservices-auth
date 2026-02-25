import { Channel, ConsumeMessage } from 'amqplib';
import { resendInviteFromEvent } from '../../services/credentialService';
import { MessageEnvelope } from '../types';

const AUTH_SERVICE_EXCHANGE = 'auth-service.events';

interface UserInviteResentData {
  user_id: string;
  email: string;
}

export function handleUserInviteResent(channel: Channel) {
  return async (msg: ConsumeMessage | null): Promise<void> => {
    if (!msg) return;

    let envelope: MessageEnvelope<UserInviteResentData>;
    try {
      envelope = JSON.parse(msg.content.toString()) as MessageEnvelope<UserInviteResentData>;
    } catch {
      console.error('user.invite_resent: failed to parse message, sending to DLQ');
      channel.nack(msg, false, false);
      return;
    }

    try {
      const { user_id, email } = envelope.data;
      const { inviteToken, expiresAt } = await resendInviteFromEvent(user_id);

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
      console.error('user.invite_resent: unexpected error, sending to DLQ:', err);
      channel.nack(msg, false, false);
    }
  };
}