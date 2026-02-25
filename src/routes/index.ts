import { Router } from 'express';
import oauthRouter from './oauth';
import authRouter from './auth';

const router = Router();

router.use('/oauth', oauthRouter);
router.use('/auth', authRouter);

export default router;