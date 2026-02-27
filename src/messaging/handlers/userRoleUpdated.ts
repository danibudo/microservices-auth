import { Channel, ConsumeMessage } from 'amqplib';
import { updateRoleFromEvent } from '../../services/credentialService';
import { Role } from '../../types/domain';
import { MessageEnvelope } from '../types';
import { parseEnvelope } from '../utils';

interface UserRoleUpdatedData {
  user_id: string;
  role: Role;
}

export function handleUserRoleUpdated(channel: Channel) {
  return async (msg: ConsumeMessage | null): Promise<void> => {
    if (!msg) return;

    const envelope = parseEnvelope<UserRoleUpdatedData>(
      msg,
      channel,
      'user.role_updated',
    );
    if (!envelope) return;

    try {
      const { user_id, role } = envelope.data;
      await updateRoleFromEvent(user_id, role);
      channel.ack(msg);
    } catch (err) {
      console.error(
        'user.role_updated: unexpected error, sending to DLQ:',
        err,
      );
      channel.nack(msg, false, false);
    }
  };
}
