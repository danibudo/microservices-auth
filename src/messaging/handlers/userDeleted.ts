import { Channel, ConsumeMessage } from 'amqplib';
import { deleteFromEvent } from '../../services/credentialService';
import { MessageEnvelope } from '../types';

interface UserDeletedData {
  user_id: string;
}

export function handleUserDeleted(channel: Channel) {
  return async (msg: ConsumeMessage | null): Promise<void> => {
    if (!msg) return;

    let envelope: MessageEnvelope<UserDeletedData>;
    try {
      envelope = JSON.parse(msg.content.toString()) as MessageEnvelope<UserDeletedData>;
    } catch {
      console.error('user.deleted: failed to parse message, sending to DLQ');
      channel.nack(msg, false, false);
      return;
    }

    try {
      const { user_id } = envelope.data;
      await deleteFromEvent(user_id);
      // DELETE is a no-op if the user doesn't exist, so this is naturally idempotent
      channel.ack(msg);
    } catch (err) {
      console.error('user.deleted: unexpected error, sending to DLQ:', err);
      channel.nack(msg, false, false);
    }
  };
}