export class ModelError extends Error {
  code: string;
  http: number;
  
  constructor(code: string, message: string, http = 400) {
    super(message);
    this.code = code;
    this.http = http;
  }
}
