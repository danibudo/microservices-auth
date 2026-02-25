import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate';
import { setPasswordHandler } from '../handlers/authHandlers';

const setPasswordSchema = z.object({
  invite_token: z.string().min(1, { message: 'is required' }),
  new_password: z
    .string()
    .min(8, { message: 'must be at least 8 characters' })
    .regex(/[A-Z]/, { message: 'must contain at least one uppercase letter' })
    .regex(/[0-9]/, { message: 'must contain at least one digit' }),
});

const router = Router();

router.post('/set-password', validate(setPasswordSchema), setPasswordHandler);

export default router;