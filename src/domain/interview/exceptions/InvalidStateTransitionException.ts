export class InvalidStateTransitionException extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidStateTransitionException';
    Object.setPrototypeOf(this, InvalidStateTransitionException.prototype);
  }
}
