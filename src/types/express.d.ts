import { JwtPayload } from './domain';

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}
