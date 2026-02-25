import { getChannel } from './connection';
import { handleUserCreated } from './handlers/userCreated';
import { handleUserRoleUpdated } from './handlers/userRoleUpdated';
import { handleUserDeleted } from './handlers/userDeleted';

const USER_SERVICE_EXCHANGE = 'user-service.events';
const AUTH_SERVICE_EXCHANGE = 'auth-service.events';
const DLX = 'dlx.auth-service';

const QUEUES = {
  USER_CREATED: 'auth-service.user.created',
  USER_ROLE_UPDATED: 'auth-service.user.role_updated',
  USER_DELETED: 'auth-service.user.deleted',
} as const;

const DLQ = {
  USER_CREATED: 'dlx.auth-service.user.created',
  USER_ROLE_UPDATED: 'dlx.auth-service.user.role_updated',
  USER_DELETED: 'dlx.auth-service.user.deleted',
} as const;

export async function startConsumers(): Promise<void> {
  const channel = getChannel();

  // Exchanges
  await channel.assertExchange(USER_SERVICE_EXCHANGE, 'topic', { durable: true });
  await channel.assertExchange(AUTH_SERVICE_EXCHANGE, 'topic', { durable: true });
  await channel.assertExchange(DLX, 'direct', { durable: true });

  // Dead-letter queues
  await channel.assertQueue(DLQ.USER_CREATED, { durable: true });
  await channel.assertQueue(DLQ.USER_ROLE_UPDATED, { durable: true });
  await channel.assertQueue(DLQ.USER_DELETED, { durable: true });

  // Main queues with DLX routing
  const queueArgs = (dlqRoutingKey: string) => ({
    durable: true,
    arguments: {
      'x-dead-letter-exchange': DLX,
      'x-dead-letter-routing-key': dlqRoutingKey,
    },
  });

  await channel.assertQueue(QUEUES.USER_CREATED, queueArgs(DLQ.USER_CREATED));
  await channel.assertQueue(QUEUES.USER_ROLE_UPDATED, queueArgs(DLQ.USER_ROLE_UPDATED));
  await channel.assertQueue(QUEUES.USER_DELETED, queueArgs(DLQ.USER_DELETED));

  // Bindings
  await channel.bindQueue(QUEUES.USER_CREATED, USER_SERVICE_EXCHANGE, 'user.created');
  await channel.bindQueue(QUEUES.USER_ROLE_UPDATED, USER_SERVICE_EXCHANGE, 'user.role_updated');
  await channel.bindQueue(QUEUES.USER_DELETED, USER_SERVICE_EXCHANGE, 'user.deleted');

  // Consumers
  await channel.consume(QUEUES.USER_CREATED, handleUserCreated(channel));
  await channel.consume(QUEUES.USER_ROLE_UPDATED, handleUserRoleUpdated(channel));
  await channel.consume(QUEUES.USER_DELETED, handleUserDeleted(channel));

  console.log('RabbitMQ consumers started');
}