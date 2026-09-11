import { randomUUID } from 'crypto';
import { NextFunction, Request, Response } from 'express';

const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const requestContext = (req: Request, res: Response, next: NextFunction): void => {
  const incomingRequestId = req.get('x-request-id')?.trim();
  const requestId = incomingRequestId && uuidRegex.test(incomingRequestId) ? incomingRequestId : randomUUID();

  req.requestId = requestId;
  res.locals.requestId = requestId;
  res.setHeader('X-Request-Id', requestId);
  next();
};
