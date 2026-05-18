import { Response, NextFunction } from 'express';
import { FilterQuery } from 'mongoose';
import { Lead } from '../models/Lead';
import { sendSuccess, sendError, sendPaginated } from '../utils/response';
import { AuthRequest, ILead, LeadQueryParams, UserRole } from '../types';

// ─── Helper: build MongoDB filter from query params ───────────────────────────
const buildFilter = (
  query: LeadQueryParams,
  userId: string,
  role: UserRole
): FilterQuery<ILead> => {
  const filter: FilterQuery<ILead> = {};

  // Sales users can only see their own leads; admins see all
  if (role === UserRole.SALES) {
    filter.createdBy = userId;
  }

  if (query.status) filter.status = query.status;
  if (query.source) filter.source = query.source;

  if (query.search) {
    const regex = new RegExp(query.search, 'i'); // case-insensitive
    filter.$or = [{ name: regex }, { email: regex }];
  }

  return filter;
};

// ─── GET /api/leads ───────────────────────────────────────────────────────────
export const getLeads = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const query = req.query as LeadQueryParams;
    const page = Math.max(1, parseInt(query.page || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(query.limit || '10', 10)));
    const skip = (page - 1) * limit;
    const sortOrder = query.sort === 'oldest' ? 1 : -1;

    const filter = buildFilter(query, req.user!.id, req.user!.role);

    const [leads, total] = await Promise.all([
      Lead.find(filter)
        .populate('createdBy', 'name email')
        .sort({ createdAt: sortOrder })
        .skip(skip)
        .limit(limit),
      Lead.countDocuments(filter),
    ]);

    sendPaginated(res, leads, total, page, limit, 'Leads fetched successfully.');
  } catch (err) {
    next(err);
  }
};

// ─── GET /api/leads/:id ───────────────────────────────────────────────────────
export const getLeadById = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const lead = await Lead.findById(req.params.id).populate('createdBy', 'name email');

    if (!lead) {
      sendError(res, 'Lead not found.', 404);
      return;
    }

    // Sales user can only view their own leads
    if (
      req.user!.role === UserRole.SALES &&
      lead.createdBy.toString() !== req.user!.id
    ) {
      sendError(res, 'Access denied.', 403);
      return;
    }

    sendSuccess(res, lead, 'Lead fetched successfully.');
  } catch (err) {
    next(err);
  }
};

// ─── POST /api/leads ──────────────────────────────────────────────────────────
export const createLead = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { name, email, status, source, notes } = req.body;

    const lead = await Lead.create({
      name,
      email,
      status,
      source,
      notes,
      createdBy: req.user!.id,
    });

    sendSuccess(res, lead, 'Lead created successfully.', 201);
  } catch (err) {
    next(err);
  }
};

// ─── PUT /api/leads/:id ───────────────────────────────────────────────────────
export const updateLead = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const lead = await Lead.findById(req.params.id);

    if (!lead) {
      sendError(res, 'Lead not found.', 404);
      return;
    }

    // Sales user can only update their own leads
    if (
      req.user!.role === UserRole.SALES &&
      lead.createdBy.toString() !== req.user!.id
    ) {
      sendError(res, 'Access denied.', 403);
      return;
    }

    const { name, email, status, source, notes } = req.body;
    const updated = await Lead.findByIdAndUpdate(
      req.params.id,
      { name, email, status, source, notes },
      { new: true, runValidators: true }
    ).populate('createdBy', 'name email');

    sendSuccess(res, updated, 'Lead updated successfully.');
  } catch (err) {
    next(err);
  }
};

// ─── DELETE /api/leads/:id  (admin only) ─────────────────────────────────────
export const deleteLead = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const lead = await Lead.findByIdAndDelete(req.params.id);

    if (!lead) {
      sendError(res, 'Lead not found.', 404);
      return;
    }

    sendSuccess(res, { id: req.params.id }, 'Lead deleted successfully.');
  } catch (err) {
    next(err);
  }
};

// ─── GET /api/leads/export/csv ────────────────────────────────────────────────
export const exportLeadsCSV = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const query = req.query as LeadQueryParams;
    const filter = buildFilter(query, req.user!.id, req.user!.role);

    const leads = await Lead.find(filter)
      .populate('createdBy', 'name')
      .sort({ createdAt: -1 });

    const headers = ['Name', 'Email', 'Status', 'Source', 'Notes', 'Created By', 'Created At'];
    const rows = leads.map((l) => [
      l.name,
      l.email,
      l.status,
      l.source,
      l.notes || '',
      (l.createdBy as { name?: string })?.name || '',
      new Date(l.createdAt).toISOString().split('T')[0],
    ]);

    const csv = [headers, ...rows]
      .map((row) => row.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','))
      .join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=gigflow_leads.csv');
    res.status(200).send(csv);
  } catch (err) {
    next(err);
  }
};

// ─── GET /api/leads/stats ─────────────────────────────────────────────────────
export const getLeadStats = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const matchStage =
      req.user!.role === UserRole.SALES
        ? { $match: { createdBy: req.user!.id } }
        : { $match: {} };

    const [statusStats, sourceStats, total] = await Promise.all([
      Lead.aggregate([matchStage, { $group: { _id: '$status', count: { $sum: 1 } } }]),
      Lead.aggregate([matchStage, { $group: { _id: '$source', count: { $sum: 1 } } }]),
      Lead.countDocuments(
        req.user!.role === UserRole.SALES ? { createdBy: req.user!.id } : {}
      ),
    ]);

    const byStatus = Object.fromEntries(statusStats.map((s) => [s._id, s.count]));
    const bySource = Object.fromEntries(sourceStats.map((s) => [s._id, s.count]));

    sendSuccess(res, { total, byStatus, bySource }, 'Stats fetched successfully.');
  } catch (err) {
    next(err);
  }
};
