export class ModelError extends Error {
  constructor(
    public code: string,
    message: string,
    public http: number = 500
  ) {
    super(message);
    this.name = 'ModelError';
  }
}
