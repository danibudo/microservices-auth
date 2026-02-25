import { Channel, ConsumeMessage } from 'amqplib';
import { updateRoleFromEvent } from '../../services/credentialService';
import { Role } from '../../types/domain';
import { MessageEnvelope } from '../types';

interface UserRoleUpdatedData {
  user_id: string;
  role: Role;
}

export function handleUserRoleUpdated(channel: Channel) {
  return async (msg: ConsumeMessage | null): Promise<void> => {
    if (!msg) return;

    let envelope: MessageEnvelope<UserRoleUpdatedData>;
    try {
      envelope = JSON.parse(msg.content.toString()) as MessageEnvelope<UserRoleUpdatedData>;
    } catch {
      console.error('user.role_updated: failed to parse message, sending to DLQ');
      channel.nack(msg, false, false);
      return;
    }

    try {
      const { user_id, role } = envelope.data;
      await updateRoleFromEvent(user_id, role);
      channel.ack(msg);
    } catch (err) {
      console.error('user.role_updated: unexpected error, sending to DLQ:', err);
      channel.nack(msg, false, false);
    }
  };
}