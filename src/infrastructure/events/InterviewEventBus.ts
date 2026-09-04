import { EventEmitter } from 'events';
import { singleton } from 'tsyringe';
import { IEventPublisher } from '../../domain/events/IEventPublisher';

@singleton()
export class InterviewEventBus implements IEventPublisher {
  private emitter = new EventEmitter();

  constructor() {
    // Increase limit if there are many concurrent SSE connections
    this.emitter.setMaxListeners(100);
  }

  publish(event: string, payload: any): void {
    this.emitter.emit(event, payload);
  }

  subscribe(event: string, callback: (payload: any) => void): void {
    this.emitter.on(event, callback);
  }

  unsubscribe(event: string, callback: (payload: any) => void): void {
    this.emitter.off(event, callback);
  }
}
