import { IUser } from '../models/user.model';
import { JwtTokenPayload } from './auth.type';

declare global {
  namespace Express {
    interface Request {
      user?: IUser;
      tokenPayload?: JwtTokenPayload;
      resource?: unknown;
    }
  }
}
