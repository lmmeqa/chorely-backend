import { Context, Next } from "hono";

// ANSI color codes for terminal output
const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  white: "\x1b[37m",
  gray: "\x1b[90m",
};

// Status code color mapping
const getStatusColor = (status: number): string => {
  if (status >= 500) return colors.red;
  if (status >= 400) return colors.yellow;
  if (status >= 300) return colors.blue;
  if (status >= 200) return colors.green;
  return colors.white;
};

// Method color mapping
const getMethodColor = (method: string): string => {
  switch (method.toUpperCase()) {
    case "GET": return colors.green;
    case "POST": return colors.blue;
    case "PUT": return colors.yellow;
    case "DELETE": return colors.red;
    case "PATCH": return colors.magenta;
    default: return colors.white;
  }
};

// Truncate long strings for display
const truncate = (str: string, maxLength: number = 100): string => {
  if (str.length <= maxLength) return str;
  return str.substring(0, maxLength) + "...";
};

// Format request body for logging
const formatBody = (body: any): string => {
  if (!body) return "{}";
  try {
    const str = typeof body === "string" ? body : JSON.stringify(body);
    return truncate(str, 200);
  } catch {
    return "[Unable to stringify body]";
  }
};

// Format response body for logging
const formatResponse = (response: Response): string => {
  try {
    const contentType = response.headers.get("content-type");
    if (contentType?.includes("application/json")) {
      // For JSON responses, we can't easily get the body without cloning
      return "[JSON Response]";
    }
    return `[${contentType || "unknown"}]`;
  } catch {
    return "[Unable to format response]";
  }
};

const isProdEnv = (env: any) => (env?.NODE_ENV ?? process.env.NODE_ENV) === 'production';

export const logger = async (c: Context, next: Next) => {
  const start = Date.now();
  await next();
  const dur = Date.now() - start;

  if (isProdEnv(c.env)) {
    // Minimal, PII-safe line in production
    console.log(`[${c.req.method}] ${c.req.url} ${dur}ms`);
    return;
  }

  // Dev: slightly richer, but never dump bodies
  const method = c.req.method;
  const url = c.req.url;
  const status = c.res.status;
  const methodColor = getMethodColor(method);
  const statusColor = getStatusColor(status);
  
  console.log(
    `${colors.gray}[dev]${colors.reset} ` +
    `${methodColor}${method}${colors.reset} ` +
    `${colors.cyan}${url}${colors.reset} ` +
    `${statusColor}${status}${colors.reset} ` +
    `${colors.gray}(${dur}ms)${colors.reset}`
  );

  // Log slow requests in dev
  if (dur > 1000) {
    console.log(`  ${colors.yellow}⚠️  Slow request: ${dur}ms${colors.reset}`);
  }

  // Log server errors in dev
  if (status >= 500) {
    console.log(`  ${colors.red}🚨 Server Error - Check database connection and logs${colors.reset}`);
  }
};
