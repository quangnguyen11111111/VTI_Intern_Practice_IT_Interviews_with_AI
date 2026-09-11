import { IUser } from '../models/user.model';
import { JwtTokenPayload } from './auth.type';

declare global {
  namespace Express {
    interface Request {
      requestId: string;
      user?: IUser;
      tokenPayload?: JwtTokenPayload;
      resource?: unknown;
    }
  }
}
