// Shared Hono test client utility
import app from '../../src/worker';

// Test environment configuration
const testEnv = {
  DATABASE_URL: process.env.DATABASE_URL!,
  SUPABASE_URL: process.env.SUPABASE_URL!,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY!,
  SUPABASE_JWT_SECRET: process.env.SUPABASE_JWT_SECRET,
  SUPABASE_BUCKET: process.env.SUPABASE_BUCKET || 'uploads',
  SUPABASE_SIGNED_URL_TTL: process.env.SUPABASE_SIGNED_URL_TTL || '3600'
};

export interface TestResponse {
  status: number;
  json: any;
  text: string;
  headers: Headers;
}

/**
 * Hono test client - replaces Supertest functionality
 */
export async function json(
  method: string, 
  url: string, 
  body?: any, 
  headers?: Record<string, string>
): Promise<TestResponse> {
  
  const requestHeaders = new Headers({
    'Content-Type': 'application/json',
    ...headers
  });

  const hasBody = !['GET', 'HEAD'].includes(method.toUpperCase());
  
  const request = new Request(`http://localhost${url}`, {
    method: method.toUpperCase(),
    headers: requestHeaders,
    body: hasBody ? JSON.stringify(body ?? {}) : undefined
  });

  const response = await app.fetch(request, testEnv);
  const text = await response.text();
  
  let parsedJson;
  try {
    parsedJson = text ? JSON.parse(text) : {};
  } catch {
    parsedJson = text;
  }

  return {
    status: response.status,
    json: parsedJson,
    text: text,
    headers: response.headers
  };
}

/**
 * Send a multipart form request with file attachment
 */
export async function multipart(
  method: string,
  url: string,
  fieldName: string,
  fileBuffer: Buffer,
  fileOptions: { filename: string; contentType: string },
  headers?: Record<string, string>
): Promise<TestResponse> {
  const formData = new FormData();
  const blob = new Blob([fileBuffer], { type: fileOptions.contentType });
  formData.append(fieldName, blob, fileOptions.filename);

  const requestHeaders = new Headers(headers || {});
  // Don't set Content-Type for FormData - let the browser set it with boundary
  
  const request = new Request(`http://localhost${url}`, {
    method: method.toUpperCase(),
    headers: requestHeaders,
    body: formData
  });

  const response = await app.fetch(request, testEnv);
  const text = await response.text();
  
  let parsedJson;
  try {
    parsedJson = text ? JSON.parse(text) : {};
  } catch {
    parsedJson = text;
  }

  return {
    status: response.status,
    json: parsedJson,
    text: text,
    headers: response.headers
  };
}

/**
 * Create a test client that can be chained (similar to Supertest agent)
 */
export const testClient = {
  get: (url: string, headers?: Record<string, string>) => json('GET', url, undefined, headers),
  post: (url: string, body?: any, headers?: Record<string, string>) => json('POST', url, body, headers),
  patch: (url: string, body?: any, headers?: Record<string, string>) => json('PATCH', url, body, headers),
  delete: (url: string, body?: any, headers?: Record<string, string>) => json('DELETE', url, body, headers),
  put: (url: string, body?: any, headers?: Record<string, string>) => json('PUT', url, body, headers)
};

/**
 * Fluent API test client (similar to Supertest)
 */
export class RequestBuilder implements PromiseLike<TestResponse> {
  private method: string;
  private url: string;
  private headers: Record<string, string> = {};
  private body?: any;
  private attachment?: { field: string; buffer: Buffer; options: { filename: string; contentType: string } };

  constructor(method: string, url: string) {
    this.method = method;
    this.url = url;
  }

  set(headers: Record<string, string>): RequestBuilder {
    Object.assign(this.headers, headers);
    return this;
  }

  send(data: any): RequestBuilder {
    this.body = data;
    return this;
  }

  attach(field: string, buffer: Buffer, options: { filename: string; contentType: string }): RequestBuilder {
    this.attachment = { field, buffer, options };
    return this;
  }

  then<TResult1 = TestResponse, TResult2 = never>(
    onfulfilled?: ((value: TestResponse) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null
  ): PromiseLike<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected);
  }

  private async execute(): Promise<TestResponse> {
    if (this.attachment) {
      return multipart(this.method, this.url, this.attachment.field, this.attachment.buffer, this.attachment.options, this.headers);
    }
    return json(this.method, this.url, this.body, this.headers);
  }
}

/**
 * Agent-style test client (backward compatibility)
 */
export const agent = {
  get: (url: string) => new RequestBuilder('GET', url),
  post: (url: string) => new RequestBuilder('POST', url),
  patch: (url: string) => new RequestBuilder('PATCH', url),
  delete: (url: string) => new RequestBuilder('DELETE', url),
  put: (url: string) => new RequestBuilder('PUT', url)
};

export default testClient;