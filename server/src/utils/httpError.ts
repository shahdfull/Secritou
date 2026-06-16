export class HttpError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
  }
}

export function notFound(resource: string) {
  return new HttpError(404, `${resource} not found`);
}
