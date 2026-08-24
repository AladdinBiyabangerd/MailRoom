import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Fastify from "fastify";
import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import fastifyStatic from "@fastify/static";
import { config, originAllowed } from "./config.js";
import { AppError, Codes, Msg } from "./errors.js";
import { localeFromHeader, t } from "./i18n.js";
import { registerRoutes } from "./routes.js";

const TRANSPARENT_API_PREFIXES = ["/admin/", "/public/", "/actuator/"];

export async function buildApp() {
  const app = Fastify({
    logger: true,
    bodyLimit: 20 * 1024 * 1024,
    trustProxy: true,
  });

  await app.register(cookie);
  await app.register(cors, {
    origin: (origin, cb) => {
      if (originAllowed(origin)) cb(null, true);
      else cb(null, false);
    },
    credentials: true,
  });

  app.setErrorHandler((error, request, reply) => {
    const lang = localeFromHeader(request.headers["accept-language"]);
    if (error instanceof AppError) {
      return reply.status(error.statusCode).send({
        code: error.code,
        message: t(lang, error.messageKey, error.args),
      });
    }
    const status = (error as { statusCode?: number }).statusCode;
    if (status === 400) {
      return reply.status(400).send({
        code: Codes.BAD_REQUEST,
        message: t(lang, Msg.MALFORMED_REQUEST),
      });
    }
    request.log.error(error);
    return reply.status(500).send({
      code: Codes.INTERNAL_ERROR,
      message: t(lang, Msg.INTERNAL_ERROR),
    });
  });

  app.setNotFoundHandler((request, reply) => {
    const lang = localeFromHeader(request.headers["accept-language"]);
    const url = request.url.split("?")[0];
    if (TRANSPARENT_API_PREFIXES.some((p) => url.startsWith(p))) {
      return reply.status(404).send({
        code: Codes.NOT_FOUND,
        message: t(lang, Msg.RESOURCE_NOT_FOUND),
      });
    }
    const webDist = resolveWebDist();
    if (webDist && existsSync(path.join(webDist, "index.html"))) {
      return reply.sendFile("index.html", webDist);
    }
    return reply.status(404).send({
      code: Codes.NOT_FOUND,
      message: t(lang, Msg.RESOURCE_NOT_FOUND),
    });
  });

  await registerRoutes(app);

  const webDist = resolveWebDist();
  if (webDist && existsSync(webDist)) {
    await app.register(fastifyStatic, {
      root: webDist,
      wildcard: false,
    });
  }

  return app;
}

function resolveWebDist(): string | null {
  if (process.env.WEB_DIST) return process.env.WEB_DIST;
  const here = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [
    path.resolve(here, "../../web/dist"),
    path.resolve(process.cwd(), "../web/dist"),
    path.resolve(process.cwd(), "apps/web/dist"),
  ];
  return candidates.find((c) => existsSync(c)) ?? candidates[0];
}
