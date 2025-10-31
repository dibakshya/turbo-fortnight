import type { Response } from 'express';

type Listener = {
  id: string;
  res: Response;
};

class SSEBroker {
  private listeners = new Map<string, Listener[]>();

  addListener(channel: string, listener: Listener) {
    const current = this.listeners.get(channel) ?? [];
    this.listeners.set(channel, [...current, listener]);
  }

  removeListener(channel: string, listenerId: string) {
    const current = this.listeners.get(channel) ?? [];
    this.listeners.set(
      channel,
      current.filter((l) => l.id !== listenerId)
    );
  }

  publish(channel: string, payload: unknown) {
    const listeners = this.listeners.get(channel);
    if (!listeners) return;
    const data = `data: ${JSON.stringify(payload)}\n\n`;
    listeners.forEach(({ res }) => {
      res.write(data);
    });
  }
}

export const sseBroker = new SSEBroker();
