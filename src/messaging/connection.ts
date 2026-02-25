import amqp, { Channel, Connection } from 'amqplib';
import { config } from '../config/env';

const BASE_RETRY_DELAY_MS = 1_000;
const MAX_RETRY_DELAY_MS = 30_000;

let connection: Connection | null = null;
let channel: Channel | null = null;

export async function initConnection(
  onConnected: () => Promise<void>,
): Promise<void> {
  await connectWithRetry(onConnected, 0);
}

async function connectWithRetry(
  onConnected: () => Promise<void>,
  attempt: number,
): Promise<void> {
  try {
    connection = await amqp.connect(config.RABBITMQ_URL);
    channel = await connection.createChannel();
    await channel.prefetch(config.RABBITMQ_PREFETCH);

    connection.on('error', (err: Error) => {
      console.error('RabbitMQ connection error:', err.message);
    });

    connection.on('close', () => {
      console.warn('RabbitMQ connection closed, reconnecting...');
      channel = null;
      connection = null;
      void connectWithRetry(onConnected, 0);
    });

    console.log('Connected to RabbitMQ');
    await onConnected();
  } catch (err) {
    const delay = Math.min(BASE_RETRY_DELAY_MS * 2 ** attempt, MAX_RETRY_DELAY_MS);
    console.error(
      `RabbitMQ connection attempt ${attempt + 1} failed, retrying in ${delay}ms...`,
    );
    await sleep(delay);
    await connectWithRetry(onConnected, attempt + 1);
  }
}

export function getChannel(): Channel {
  if (!channel) {
    throw new Error('RabbitMQ channel is not available.');
  }
  return channel;
}

export async function closeConnection(): Promise<void> {
  try {
    await channel?.close();
    await connection?.close();
  } catch {
    // Ignore errors during graceful shutdown
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}