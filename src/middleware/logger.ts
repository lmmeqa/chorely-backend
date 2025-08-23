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

export const logger = async (c: Context, next: Next) => {
  const startTime = Date.now();
  const method = c.req.method;
  const url = c.req.url;
  const userAgent = c.req.header("User-Agent") || "Unknown";
  const ip = c.req.header("X-Forwarded-For") || c.req.header("X-Real-IP") || "Unknown";
  
  // Log request start
  const methodColor = getMethodColor(method);
  console.log(
    `${colors.gray}[${new Date().toISOString()}]${colors.reset} ` +
    `${methodColor}${method}${colors.reset} ` +
    `${colors.cyan}${url}${colors.reset} ` +
    `${colors.gray}from ${ip}${colors.reset} ` +
    `${colors.gray}(${userAgent})${colors.reset}`
  );

  // Log request headers (if not muted)
  if (process.env.MUTE_API_LOGS !== "true") {
    const authHeader = c.req.header("Authorization");
    if (authHeader) {
      const tokenPreview = authHeader.startsWith("Bearer ") 
        ? authHeader.substring(7, 15) + "..." 
        : "[Non-Bearer Auth]";
      console.log(`  ${colors.gray}Authorization: ${colors.yellow}${tokenPreview}${colors.reset}`);
    }
    
    const contentType = c.req.header("Content-Type");
    if (contentType) {
      console.log(`  ${colors.gray}Content-Type: ${colors.cyan}${contentType}${colors.reset}`);
    }
  }

  // Log request body for POST/PUT/PATCH requests
  if (["POST", "PUT", "PATCH"].includes(method.toUpperCase())) {
    try {
      const body = await c.req.json().catch(() => null);
      if (body) {
        console.log(`  ${colors.gray}Request Body: ${colors.white}${formatBody(body)}${colors.reset}`);
      }
    } catch {
      // Body might not be JSON or might be empty
    }
  }

  // Execute the request
  await next();
  
  const endTime = Date.now();
  const duration = endTime - startTime;
  const status = c.res.status;
  const statusColor = getStatusColor(status);
  
  // Log response
  console.log(
    `${colors.gray}[${new Date().toISOString()}]${colors.reset} ` +
    `${methodColor}${method}${colors.reset} ` +
    `${colors.cyan}${url}${colors.reset} ` +
    `${statusColor}${status}${colors.reset} ` +
    `${colors.gray}(${duration}ms)${colors.reset}`
  );

  // Log response details for errors
  if (status >= 400) {
    try {
      const responseBody = await c.res.clone().json().catch(() => null);
      if (responseBody) {
        console.log(`  ${colors.red}Error Response: ${colors.white}${formatBody(responseBody)}${colors.reset}`);
      }
    } catch {
      // Response might not be JSON
    }
  }

  // Log slow requests
  if (duration > 1000) {
    console.log(`  ${colors.yellow}⚠️  Slow request: ${duration}ms${colors.reset}`);
  }

  // Log database errors specifically
  if (status >= 500) {
    console.log(`  ${colors.red}🚨 Server Error - Check database connection and logs${colors.reset}`);
  }
};
