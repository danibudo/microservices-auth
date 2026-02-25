import amqp, { Channel } from 'amqplib';
import { config } from '../config/env';

// Use the actual return type of amqp.connect() to avoid the Connection/ChannelModel mismatch
type AmqpConnection = Awaited<ReturnType<typeof amqp.connect>>;

const BASE_RETRY_DELAY_MS = 1_000;
const MAX_RETRY_DELAY_MS = 30_000;

let connection: AmqpConnection | null = null;
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
    // Use local variables first so TypeScript can narrow the type for subsequent calls
    const conn = await amqp.connect(config.RABBITMQ_URL);
    const chan = await conn.createChannel();
    await chan.prefetch(config.RABBITMQ_PREFETCH);

    conn.on('error', (err: Error) => {
      console.error('RabbitMQ connection error:', err.message);
    });

    conn.on('close', () => {
      console.warn('RabbitMQ connection closed, reconnecting...');
      channel = null;
      connection = null;
      void connectWithRetry(onConnected, 0);
    });

    connection = conn;
    channel = chan;

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
