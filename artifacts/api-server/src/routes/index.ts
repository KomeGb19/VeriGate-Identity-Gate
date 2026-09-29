import { Router, type IRouter } from "express";
import healthRouter from "./health";
import verigateRouter from "./verigate";

const router: IRouter = Router();

router.use(healthRouter);
router.use(verigateRouter);

export default router;
