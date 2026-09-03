import { Router, type IRouter } from "express";
import healthRouter from "./health";
import phoenixRouter from "./phoenix";

const router: IRouter = Router();

router.use(healthRouter);
router.use(phoenixRouter);

export default router;
