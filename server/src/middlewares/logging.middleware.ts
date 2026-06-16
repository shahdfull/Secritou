import morgan from "morgan";

export const loggingMiddleware = morgan(":method :url :status :response-time ms");
