import type { MiddlewareHandler } from "hono";

export function basicAuth(user: string, password: string): MiddlewareHandler {
  return async (c, next) => {
    const header = c.req.header("Authorization");
    if (header?.startsWith("Basic ")) {
      const decoded = atob(header.slice(6));
      const colon = decoded.indexOf(":");
      if (colon !== -1) {
        const suppliedUser = decoded.slice(0, colon);
        const suppliedPassword = decoded.slice(colon + 1);
        if (suppliedUser === user && suppliedPassword === password) {
          await next();
          return;
        }
      }
    }
    c.header("WWW-Authenticate", 'Basic realm="Untaingled"');
    return c.text("Unauthorized", 401);
  };
}
