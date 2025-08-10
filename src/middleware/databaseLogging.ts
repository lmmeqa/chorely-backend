/** Database operation logging wrapper */
export const dbGuard = async <T>(fn: () => Promise<T>, msg: string): Promise<T> => {
  try {
    console.log(`[DB] Starting operation: ${msg}`);
    const result = await fn();
    console.log(`[DB] Operation completed: ${msg}`);
    return result;
  } catch (e: any) {
    console.error(`[DB] Operation failed: ${msg}`, e.message);
    throw e;
  }
};
