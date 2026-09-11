import { AppError } from '../../../utils/AppError';

export class InvalidStateTransitionException extends AppError {
  constructor(message: string) {
    super(message, 409, 'STATE_CONFLICT');
    this.name = 'InvalidStateTransitionException';
    Object.setPrototypeOf(this, InvalidStateTransitionException.prototype);
  }
}
