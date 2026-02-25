import { Router } from 'express';
import { tokenHandler, revokeHandler } from '../handlers/oauthHandlers';

const router = Router();

router.post('/token', tokenHandler);
router.post('/revoke', revokeHandler);

export default router;