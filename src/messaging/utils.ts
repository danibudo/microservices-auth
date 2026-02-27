import { Channel, ConsumeMessage } from 'amqplib';
import { MessageEnvelope } from './types';

export function publishInviteTokenGenerated(
  channel: Channel,
  exchange: string,
  payload: { user_id: string; email: string; invite_token: string; expires_at: string },
  correlationId: string,
): void {
  channel.publish(
    exchange,
    'auth.invite_token_generated',
    Buffer.from(
      JSON.stringify({
        event: 'auth.invite_token_generated',
        data: payload,
        metadata: {
          timestamp: new Date().toISOString(),
          correlation_id: correlationId,
        },
      }),
    ),
    { persistent: true },
  );
}

export function parseEnvelope<T>(
  message: ConsumeMessage,
  channel: Channel,
  eventName: string,
) {
  try {
    return JSON.parse(message.content.toString()) as MessageEnvelope<T>;
  } catch {
    console.error(`${eventName}: failed to parse message, sending to DLQ`);
    channel.nack(message, false, false);
    return null;
  }
}
