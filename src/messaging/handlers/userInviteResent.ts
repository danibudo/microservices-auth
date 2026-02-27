import { Channel, ConsumeMessage } from 'amqplib';
import { resendInviteFromEvent } from '../../services/credentialService';
import { MessageEnvelope } from '../types';
import { AUTH_SERVICE_EXCHANGE } from '../consumer';
import { parseEnvelope } from '../utils';

interface UserInviteResentData {
  user_id: string;
  email: string;
}

export function handleUserInviteResent(channel: Channel) {
  return async (msg: ConsumeMessage | null): Promise<void> => {
    if (!msg) return;

    const envelope = parseEnvelope<UserInviteResentData>(
      msg,
      channel,
      'user.invite_resent',
    );
    if (!envelope) return;

    try {
      const { user_id, email } = envelope.data;
      const { inviteToken, expiresAt } = await resendInviteFromEvent(user_id);
      // Publish to the authServiceExchange - the consumer will be the notification service that will send the invite mail to the user
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
      console.error(
        'user.invite_resent: unexpected error, sending to DLQ:',
        err,
      );
      channel.nack(msg, false, false);
    }
  };
}
