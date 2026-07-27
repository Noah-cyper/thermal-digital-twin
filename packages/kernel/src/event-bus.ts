// Kernel L1 — Event Bus (doc 05-12). Pub/sub in-proc + request/respond; cô lập lỗi handler.
export type EventTopic =
  | 'tag.update'
  | 'alarm.transition'
  | 'audit.write'
  | 'plugin.lifecycle'
  | 'sim.step';

export type EventHandler<T> = (payload: T) => void;

export interface IEventBus {
  publish<T>(topic: EventTopic, payload: T): void;
  subscribe<T>(topic: EventTopic, handler: EventHandler<T>): () => void;
  request<Req, Res>(topic: string, req: Req, timeoutMs: number): Promise<Res>;
}

type AnyHandler = (payload: unknown) => void;

export class EventBus implements IEventBus {
  private readonly handlers = new Map<string, Set<AnyHandler>>();
  private seq = 0;

  publish<T>(topic: EventTopic, payload: T): void {
    this.emit(topic, payload);
  }

  subscribe<T>(topic: EventTopic, handler: EventHandler<T>): () => void {
    return this.on(topic, handler as AnyHandler);
  }

  /** Đăng ký responder cho request/reply. */
  respond<Req, Res>(topic: string, handler: (req: Req) => Res | Promise<Res>): () => void {
    return this.on(topic, (msg) => {
      const { replyTopic, req } = msg as { replyTopic: string; req: Req };
      Promise.resolve(handler(req))
        .then((res) => this.emit(replyTopic, res))
        .catch((err: unknown) => this.emit(`${replyTopic}:error`, err));
    });
  }

  request<Req, Res>(topic: string, req: Req, timeoutMs: number): Promise<Res> {
    const replyTopic = `__reply__:${topic}:${++this.seq}`;
    return new Promise<Res>((resolve, reject) => {
      const timer = setTimeout(() => {
        offOk();
        offErr();
        reject(new Error(`request timeout: ${topic}`));
      }, timeoutMs);
      const offOk = this.on(replyTopic, (res) => {
        clearTimeout(timer);
        offOk();
        offErr();
        resolve(res as Res);
      });
      const offErr = this.on(`${replyTopic}:error`, (err) => {
        clearTimeout(timer);
        offOk();
        offErr();
        reject(err instanceof Error ? err : new Error(String(err)));
      });
      this.emit(topic, { replyTopic, req });
    });
  }

  private on(topic: string, handler: AnyHandler): () => void {
    let set = this.handlers.get(topic);
    if (!set) {
      set = new Set();
      this.handlers.set(topic, set);
    }
    set.add(handler);
    return () => {
      set.delete(handler);
      if (set.size === 0) this.handlers.delete(topic);
    };
  }

  private emit(topic: string, payload: unknown): void {
    const set = this.handlers.get(topic);
    if (!set) return;
    for (const h of [...set]) {
      try {
        h(payload);
      } catch {
        // cô lập: một handler lỗi không làm vỡ handler khác / engine (doc 05-12)
      }
    }
  }
}
