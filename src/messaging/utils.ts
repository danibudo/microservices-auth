import { Channel, ConsumeMessage } from 'amqplib';
import { MessageEnvelope } from './types';

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
