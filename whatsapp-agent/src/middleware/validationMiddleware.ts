import { Request, Response, NextFunction } from "express";
import { CONFIG } from "../config/constants";

export class ValidationMiddleware {
  static validateOrigin(req: Request, res: Response, next: NextFunction): void {
    const origin = req.headers.origin;
    console.log("origin", origin);
    
    // if (!origin || !CONFIG.ALLOWED_ORIGINS.includes(origin)) {
    //   res.status(403).json({ error: "Unauthorized origin" });
    //   return;
    // }

    next();
  }

  static getCorsOptions() {
    return {
      origin: [...CONFIG.ALLOWED_ORIGINS],
      credentials: true,
    };
  }
} 