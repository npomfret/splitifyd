import { ApiError } from '../utils/errors';
import { HTTP_STATUS } from '../constants';
import * as admin from 'firebase-admin';

export interface ExpenseSplit {
  userId: string;
  amount: number;
  percentage?: number;
}

export interface Expense {
  id: string;
  groupId: string;
  createdBy: string;
  paidBy: string;
  amount: number;
  description: string;
  category: string;
  date: admin.firestore.Timestamp | Date;
  splitType: 'equal' | 'exact' | 'percentage';
  participants: string[];
  splits: ExpenseSplit[];
  memberIds?: string[];
  receiptUrl?: string;
  createdAt: admin.firestore.Timestamp | Date;
  updatedAt: admin.firestore.Timestamp | Date;
}

export interface CreateExpenseRequest {
  groupId: string;
  paidBy: string;
  amount: number;
  description: string;
  category: string;
  date: string;
  splitType: 'equal' | 'exact' | 'percentage';
  participants: string[];
  splits?: ExpenseSplit[];
  receiptUrl?: string;
}

export interface UpdateExpenseRequest {
  amount?: number;
  description?: string;
  category?: string;
  date?: string;
  splitType?: 'equal' | 'exact' | 'percentage';
  participants?: string[];
  splits?: ExpenseSplit[];
  receiptUrl?: string;
}

const EXPENSE_CATEGORIES = [
  'food',
  'transport',
  'utilities',
  'entertainment',
  'shopping',
  'accommodation',
  'healthcare',
  'education',
  'other'
];

export const validateExpenseId = (id: any): string => {
  if (typeof id !== 'string' || !id.trim()) {
    throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'INVALID_EXPENSE_ID', 'Invalid expense ID');
  }
  return id.trim();
};

export const validateCreateExpense = (body: any): CreateExpenseRequest => {
  if (!body || typeof body !== 'object') {
    throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'INVALID_REQUEST_BODY', 'Invalid request body');
  }

  const { groupId, paidBy, amount, description, category, date, splitType, participants, splits, receiptUrl } = body;

  if (!groupId || typeof groupId !== 'string') {
    throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'MISSING_GROUP_ID', 'Group ID is required');
  }

  if (!paidBy || typeof paidBy !== 'string') {
    throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'MISSING_PAYER', 'Payer is required');
  }

  if (typeof amount !== 'number' || amount <= 0) {
    throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'INVALID_AMOUNT', 'Amount must be a positive number');
  }

  if (!description || typeof description !== 'string' || !description.trim()) {
    throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'INVALID_DESCRIPTION', 'Description is required');
  }

  if (!category || !EXPENSE_CATEGORIES.includes(category)) {
    throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'INVALID_CATEGORY', `Category must be one of: ${EXPENSE_CATEGORIES.join(', ')}`);
  }

  if (!date || typeof date !== 'string') {
    throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'INVALID_DATE', 'Date is required');
  }

  const expenseDate = new Date(date);
  if (isNaN(expenseDate.getTime())) {
    throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'INVALID_DATE', 'Invalid date format');
  }

  if (!splitType || !['equal', 'exact', 'percentage'].includes(splitType)) {
    throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'INVALID_SPLIT_TYPE', 'Split type must be equal, exact, or percentage');
  }

  if (!Array.isArray(participants) || participants.length === 0) {
    throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'INVALID_PARTICIPANTS', 'At least one participant is required');
  }

  if (!participants.includes(paidBy)) {
    throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'PAYER_NOT_PARTICIPANT', 'Payer must be a participant');
  }

  if (splitType === 'exact' || splitType === 'percentage') {
    if (!Array.isArray(splits) || splits.length !== participants.length) {
      throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'INVALID_SPLITS', 'Splits must be provided for all participants');
    }

    if (splitType === 'exact') {
      const totalSplit = splits.reduce((sum, split) => sum + (split.amount || 0), 0);
      if (Math.abs(totalSplit - amount) > 0.01) {
        throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'INVALID_SPLIT_TOTAL', 'Split amounts must equal total amount');
      }
    } else if (splitType === 'percentage') {
      const totalPercentage = splits.reduce((sum, split) => sum + (split.percentage || 0), 0);
      if (Math.abs(totalPercentage - 100) > 0.01) {
        throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'INVALID_PERCENTAGE_TOTAL', 'Percentages must add up to 100');
      }
    }

    const splitUserIds = splits.map(s => s.userId);
    const uniqueSplitUserIds = new Set(splitUserIds);
    if (splitUserIds.length !== uniqueSplitUserIds.size) {
      throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'DUPLICATE_SPLIT_USERS', 'Each participant can only appear once in splits');
    }

    const participantSet = new Set(participants);
    for (const userId of splitUserIds) {
      if (!participantSet.has(userId)) {
        throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'INVALID_SPLIT_USER', 'Split user must be a participant');
      }
    }
  }

  return {
    groupId: groupId.trim(),
    paidBy: paidBy.trim(),
    amount,
    description: description.trim(),
    category,
    date,
    splitType,
    participants: participants.map(p => p.trim()),
    splits,
    receiptUrl: receiptUrl?.trim()
  };
};

export const validateUpdateExpense = (body: any): UpdateExpenseRequest => {
  if (!body || typeof body !== 'object') {
    throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'INVALID_REQUEST_BODY', 'Invalid request body');
  }

  const update: UpdateExpenseRequest = {};

  if ('amount' in body) {
    if (typeof body.amount !== 'number' || body.amount <= 0) {
      throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'INVALID_AMOUNT', 'Amount must be a positive number');
    }
    update.amount = body.amount;
  }

  if ('description' in body) {
    if (!body.description || typeof body.description !== 'string' || !body.description.trim()) {
      throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'INVALID_DESCRIPTION', 'Description cannot be empty');
    }
    update.description = body.description.trim();
  }

  if ('category' in body) {
    if (!EXPENSE_CATEGORIES.includes(body.category)) {
      throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'INVALID_CATEGORY', `Category must be one of: ${EXPENSE_CATEGORIES.join(', ')}`);
    }
    update.category = body.category;
  }

  if ('date' in body) {
    const expenseDate = new Date(body.date);
    if (isNaN(expenseDate.getTime())) {
      throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'INVALID_DATE', 'Invalid date format');
    }
    update.date = body.date;
  }

  if ('splitType' in body || 'participants' in body || 'splits' in body) {
    const splitType = body.splitType || 'equal';
    const participants = body.participants || [];
    const splits = body.splits;

    if (!['equal', 'exact', 'percentage'].includes(splitType)) {
      throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'INVALID_SPLIT_TYPE', 'Split type must be equal, exact, or percentage');
    }

    if (!Array.isArray(participants) || participants.length === 0) {
      throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'INVALID_PARTICIPANTS', 'At least one participant is required');
    }

    if (splitType === 'exact' || splitType === 'percentage') {
      if (!Array.isArray(splits) || splits.length !== participants.length) {
        throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'INVALID_SPLITS', 'Splits must be provided for all participants');
      }
    }

    update.splitType = splitType;
    update.participants = participants.map(p => p.trim());
    update.splits = splits;
  }

  if ('receiptUrl' in body) {
    update.receiptUrl = body.receiptUrl?.trim();
  }

  if (Object.keys(update).length === 0) {
    throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'NO_UPDATE_FIELDS', 'No valid fields to update');
  }

  return update;
};

export const calculateSplits = (amount: number, splitType: string, participants: string[], splits?: ExpenseSplit[]): ExpenseSplit[] => {
  if (splitType === 'equal') {
    const splitAmount = amount / participants.length;
    return participants.map(userId => ({
      userId,
      amount: Math.round(splitAmount * 100) / 100
    }));
  }

  if (splitType === 'percentage' && splits) {
    return splits.map(split => ({
      userId: split.userId,
      amount: Math.round((amount * (split.percentage || 0) / 100) * 100) / 100,
      percentage: split.percentage
    }));
  }

  return splits || [];
};