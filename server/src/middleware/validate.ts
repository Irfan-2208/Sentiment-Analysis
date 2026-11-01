import { Request, Response, NextFunction } from 'express';
import { AnyZodObject, ZodError } from 'zod';

type RequestPart = 'body' | 'query' | 'params';

export function validate(schema: AnyZodObject, part: RequestPart = 'body') {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = await schema.parseAsync(req[part]);
      req[part] = parsed;
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Request validation failed',
            details: err.flatten().fieldErrors,
          },
        });
        return;
      }
      next(err);
    }
  };
}
