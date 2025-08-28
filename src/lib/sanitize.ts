export function sanitize(s: string): string {
  return s
    .replace(/\x00/g, "")                     // strip null bytes
    .replace(/<script[^>]*>.*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, "")                  // strip tags
    .trim();
}
