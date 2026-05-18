import { Router } from 'express';
import { register, login, getMe } from '../controllers/auth.controller';
import { validateRegister, validateLogin } from '../middleware/validate';
import { authenticate } from '../middleware/auth';

const router = Router();

// POST /api/auth/register
router.post('/register', validateRegister, register);

// POST /api/auth/login
router.post('/login', validateLogin, login);

// GET /api/auth/me  (protected)
router.get('/me', authenticate, getMe);

export default router;
