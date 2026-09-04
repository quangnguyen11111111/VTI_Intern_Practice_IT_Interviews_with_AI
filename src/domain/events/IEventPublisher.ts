export interface IEventPublisher {
  publish(event: string, payload: any): void;
  subscribe(event: string, callback: (payload: any) => void): void;
  unsubscribe(event: string, callback: (payload: any) => void): void;
}
