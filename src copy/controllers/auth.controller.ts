import { Request, Response, NextFunction } from 'express';
import { User } from '../models/User';
import { generateToken } from '../utils/jwt';
import { sendSuccess, sendError } from '../utils/response';
import { UserRole } from '../types';

// POST /api/auth/register
export const register = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { name, email, password, role } = req.body;

    // Prevent privilege escalation — only allow admin role if explicitly set in env
    const assignedRole =
      role === UserRole.ADMIN && process.env.ALLOW_ADMIN_REGISTER === 'true'
        ? UserRole.ADMIN
        : UserRole.SALES;

    const existing = await User.findOne({ email });
    if (existing) {
      sendError(res, 'An account with this email already exists.', 409);
      return;
    }

    const user = await User.create({ name, email, password, role: assignedRole });

    const token = generateToken({
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      role: user.role,
    });

    sendSuccess(
      res,
      { token, user },
      'Account created successfully.',
      201
    );
  } catch (err) {
    next(err);
  }
};

// POST /api/auth/login
export const login = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { email, password } = req.body;

    // Explicitly select password (excluded by default in schema)
    const user = await User.findOne({ email }).select('+password');

    if (!user || !(await user.comparePassword(password))) {
      sendError(res, 'Invalid email or password.', 401);
      return;
    }

    const token = generateToken({
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      role: user.role,
    });

    // Strip password from response object
    const userObj = user.toJSON();

    sendSuccess(res, { token, user: userObj }, 'Login successful.');
  } catch (err) {
    next(err);
  }
};

// GET /api/auth/me  (protected)
export const getMe = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // req.user is set by authenticate middleware
    const authReq = req as import('../types').AuthRequest;
    const user = await User.findById(authReq.user!.id);

    if (!user) {
      sendError(res, 'User not found.', 404);
      return;
    }

    sendSuccess(res, user, 'User fetched successfully.');
  } catch (err) {
    next(err);
  }
};
