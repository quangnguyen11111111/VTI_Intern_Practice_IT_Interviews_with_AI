import { Request, Response, NextFunction } from 'express';
import { ZodSchema } from 'zod';

/**
 * Middleware để validate req.body, req.query, req.params dựa trên Zod Schema
 */
export const validate =
  (schema: ZodSchema) =>
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const validatedData: any = await schema.parseAsync({
        body: req.body,
        query: req.query,
        params: req.params,
      });
      
      // Gán lại dữ liệu đã được Zod parse/transform (vd: ép kiểu string thành number, trim string)
      if (validatedData.body !== undefined) {
        req.body = validatedData.body;
      }
      if (validatedData.params !== undefined) {
        req.params = validatedData.params;
      }
      if (validatedData.query !== undefined) {
        try {
          req.query = validatedData.query;
        } catch {
          Object.defineProperty(req, 'query', {
            value: validatedData.query,
            writable: true,
            enumerable: true,
            configurable: true,
          });
        }
      }
      
      next();
    } catch (error) {
      // Nếu có lỗi, đẩy xuống Global Error Handler để xử lý
      next(error);
    }
  };
