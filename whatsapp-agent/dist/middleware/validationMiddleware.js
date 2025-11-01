"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ValidationMiddleware = void 0;
const constants_1 = require("../config/constants");
class ValidationMiddleware {
    static validateOrigin(req, res, next) {
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
            origin: [...constants_1.CONFIG.ALLOWED_ORIGINS],
            credentials: true,
        };
    }
}
exports.ValidationMiddleware = ValidationMiddleware;
