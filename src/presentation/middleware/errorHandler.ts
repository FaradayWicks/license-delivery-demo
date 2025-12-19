// Global Error Handler Middleware

import { Request, Response, NextFunction } from 'express';

export function errorHandler(
    err: Error,
    req: Request,
    res: Response,
    next: NextFunction
): void {
    console.error('[ErrorHandler] Unhandled error:', err);

    const statusCode = res.statusCode !== 200 ? res.statusCode : 500;

    res.status(statusCode).json({
        error: {
            message: err.message,
            stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
        },
    });
}

// Request Logger Middleware
export function requestLogger(req: Request, res: Response, next: NextFunction): void {
    const start = Date.now();

    res.on('finish', () => {
        const duration = Date.now() - start;
        console.log(`[${req.method}] ${req.path} - ${res.statusCode} (${duration}ms)`);
    });

    next();
}
