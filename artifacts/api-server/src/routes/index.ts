import { Router, type IRouter } from "express";
import calendlyWebhookRouter from "./calendly-webhook";
import healthRouter from "./health";
import phoenixRouter from "./phoenix";

const router: IRouter = Router();

router.use(healthRouter);
// Signature-authenticated, so it must sit outside the session/CSRF middleware.
router.use(calendlyWebhookRouter);
router.use(phoenixRouter);

export default router;
