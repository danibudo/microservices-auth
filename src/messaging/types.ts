export interface MessageEnvelope<T> {
  event: string;
  data: T;
  metadata: {
    timestamp: string;
    correlation_id: string;
  };
}