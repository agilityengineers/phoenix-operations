import express, { type Express } from "express";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cookieParser());
// The raw body is kept for the Calendly webhook, whose authentication *is* an
// HMAC over the exact bytes received.
const jsonBody = (limit: string) => express.json({ limit, verify: (req, _res, buffer) => { (req as express.Request & { rawBody?: Buffer }).rawBody = buffer; } });
const standardBody = jsonBody("100kb");
// A profile photo rides in as a data: URL on a JSON body, and one square photo
// outgrows the default cap. Only that endpoint is given the larger allowance —
// the server still rejects an oversized image on its own terms behind it.
const avatarBody = jsonBody("2mb");
app.use((req, res, next) => (req.path === "/api/me/avatar" ? avatarBody : standardBody)(req, res, next));
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

export default app;
