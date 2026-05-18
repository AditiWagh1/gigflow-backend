import { Router } from 'express';
import {
  getLeads,
  getLeadById,
  createLead,
  updateLead,
  deleteLead,
  exportLeadsCSV,
  getLeadStats,
} from '../controllers/leads.controller';
import { authenticate, requireRole } from '../middleware/auth';
import {
  validateCreateLead,
  validateUpdateLead,
  validateLeadQuery,
} from '../middleware/validate';
import { UserRole } from '../types';

const router = Router();

// All lead routes require authentication
router.use(authenticate);

// GET /api/leads/stats
router.get('/stats', getLeadStats);

// GET /api/leads/export/csv
router.get('/export/csv', validateLeadQuery, exportLeadsCSV);

// GET /api/leads
router.get('/', validateLeadQuery, getLeads);

// POST /api/leads
router.post('/', validateCreateLead, createLead);

// GET /api/leads/:id
router.get('/:id', getLeadById);

// PUT /api/leads/:id
router.put('/:id', validateUpdateLead, updateLead);

// DELETE /api/leads/:id  — admin only
router.delete('/:id', requireRole(UserRole.ADMIN), deleteLead);

export default router;
