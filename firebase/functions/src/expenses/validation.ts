import * as Joi from 'joi';
import { ApiError } from '../utils/errors';
import { HTTP_STATUS } from '../constants';
import * as admin from 'firebase-admin';
import { sanitizeString } from '../utils/security';
import { 
  ExpenseSplit, 
  CreateExpenseRequest, 
  UpdateExpenseRequest, 
  EXPENSE_CATEGORIES 
} from '../types/expense-types';

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

const expenseSplitSchema = Joi.object({
  userId: Joi.string().required(),
  amount: Joi.number().positive().required(),
  percentage: Joi.number().min(0).max(100).optional()
});

const createExpenseSchema = Joi.object({
  groupId: Joi.string().required(),
  paidBy: Joi.string().required(),
  amount: Joi.number().positive().required(),
  description: Joi.string().trim().min(1).max(200).required(),
  category: Joi.string().valid(...EXPENSE_CATEGORIES).required(),
  date: Joi.string().required(),
  splitType: Joi.string().valid('equal', 'exact', 'percentage').required(),
  participants: Joi.array().items(Joi.string()).min(1).required(),
  splits: Joi.array().items(expenseSplitSchema).optional(),
  receiptUrl: Joi.string().uri().optional().allow('')
});

const updateExpenseSchema = Joi.object({
  amount: Joi.number().positive().optional(),
  description: Joi.string().trim().min(1).max(200).optional(),
  category: Joi.string().valid(...EXPENSE_CATEGORIES).optional(),
  date: Joi.string().optional(),
  splitType: Joi.string().valid('equal', 'exact', 'percentage').optional(),
  participants: Joi.array().items(Joi.string()).min(1).optional(),
  splits: Joi.array().items(expenseSplitSchema).optional(),
  receiptUrl: Joi.string().uri().optional().allow('')
}).min(1);

const sanitizeExpenseData = (data: CreateExpenseRequest | UpdateExpenseRequest): CreateExpenseRequest | UpdateExpenseRequest => {
  const sanitized = { ...data };
  
  if ('description' in sanitized && typeof sanitized.description === 'string') {
    sanitized.description = sanitizeString(sanitized.description);
  }
  
  if ('category' in sanitized && typeof sanitized.category === 'string') {
    sanitized.category = sanitizeString(sanitized.category);
  }
  
  if ('receiptUrl' in sanitized && typeof sanitized.receiptUrl === 'string') {
    sanitized.receiptUrl = sanitizeString(sanitized.receiptUrl);
  }
  
  return sanitized;
};

export const validateExpenseId = (id: any): string => {
  if (typeof id !== 'string' || !id.trim()) {
    throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'INVALID_EXPENSE_ID', 'Invalid expense ID');
  }
  return id.trim();
};

export const validateCreateExpense = (body: any): CreateExpenseRequest => {
  const { error, value } = createExpenseSchema.validate(body, { abortEarly: false });
  
  if (error) {
    const firstError = error.details[0];
    let errorCode = 'INVALID_INPUT';
    let errorMessage = firstError.message;
    
    if (firstError.path.includes('groupId')) {
      errorCode = 'MISSING_GROUP_ID';
      errorMessage = 'Group ID is required';
    } else if (firstError.path.includes('paidBy')) {
      errorCode = 'MISSING_PAYER';
      errorMessage = 'Payer is required';
    } else if (firstError.path.includes('amount')) {
      errorCode = 'INVALID_AMOUNT';
      errorMessage = 'Amount must be a positive number';
    } else if (firstError.path.includes('description')) {
      errorCode = 'INVALID_DESCRIPTION';
      errorMessage = 'Description is required';
    } else if (firstError.path.includes('category')) {
      errorCode = 'INVALID_CATEGORY';
      errorMessage = `Category must be one of: ${EXPENSE_CATEGORIES.join(', ')}`;
    } else if (firstError.path.includes('date')) {
      errorCode = 'INVALID_DATE';
      errorMessage = 'Date is required';
    } else if (firstError.path.includes('splitType')) {
      errorCode = 'INVALID_SPLIT_TYPE';
      errorMessage = 'Split type must be equal, exact, or percentage';
    } else if (firstError.path.includes('participants')) {
      errorCode = 'INVALID_PARTICIPANTS';
      errorMessage = 'At least one participant is required';
    }
    
    throw new ApiError(HTTP_STATUS.BAD_REQUEST, errorCode, errorMessage);
  }

  const expenseDate = new Date(value.date);
  if (isNaN(expenseDate.getTime())) {
    throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'INVALID_DATE', 'Invalid date format');
  }

  if (!value.participants.includes(value.paidBy)) {
    throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'PAYER_NOT_PARTICIPANT', 'Payer must be a participant');
  }

  if (value.splitType === 'exact' || value.splitType === 'percentage') {
    if (!Array.isArray(value.splits) || value.splits.length !== value.participants.length) {
      throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'INVALID_SPLITS', 'Splits must be provided for all participants');
    }

    if (value.splitType === 'exact') {
      const totalSplit = value.splits.reduce((sum: number, split: ExpenseSplit) => sum + (split.amount || 0), 0);
      if (Math.abs(totalSplit - value.amount) > 0.01) {
        throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'INVALID_SPLIT_TOTAL', 'Split amounts must equal total amount');
      }
    } else if (value.splitType === 'percentage') {
      const totalPercentage = value.splits.reduce((sum: number, split: ExpenseSplit) => sum + (split.percentage || 0), 0);
      if (Math.abs(totalPercentage - 100) > 0.01) {
        throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'INVALID_PERCENTAGE_TOTAL', 'Percentages must add up to 100');
      }
    }

    const splitUserIds = value.splits.map((s: ExpenseSplit) => s.userId);
    const uniqueSplitUserIds = new Set(splitUserIds);
    if (splitUserIds.length !== uniqueSplitUserIds.size) {
      throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'DUPLICATE_SPLIT_USERS', 'Each participant can only appear once in splits');
    }

    const participantSet = new Set(value.participants);
    for (const userId of splitUserIds) {
      if (!participantSet.has(userId)) {
        throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'INVALID_SPLIT_USER', 'Split user must be a participant');
      }
    }
  }

  const expenseData = {
    groupId: value.groupId.trim(),
    paidBy: value.paidBy.trim(),
    amount: value.amount,
    description: value.description.trim(),
    category: value.category,
    date: value.date,
    splitType: value.splitType,
    participants: value.participants.map((p: string) => p.trim()),
    splits: value.splits,
    receiptUrl: value.receiptUrl?.trim()
  };

  return sanitizeExpenseData(expenseData) as CreateExpenseRequest;
};

export const validateUpdateExpense = (body: any): UpdateExpenseRequest => {
  const { error, value } = updateExpenseSchema.validate(body, { abortEarly: false });
  
  if (error) {
    const firstError = error.details[0];
    let errorCode = 'INVALID_INPUT';
    let errorMessage = firstError.message;
    
    if (firstError.path.includes('amount')) {
      errorCode = 'INVALID_AMOUNT';
      errorMessage = 'Amount must be a positive number';
    } else if (firstError.path.includes('description')) {
      errorCode = 'INVALID_DESCRIPTION';
      errorMessage = 'Description cannot be empty';
    } else if (firstError.path.includes('category')) {
      errorCode = 'INVALID_CATEGORY';
      errorMessage = `Category must be one of: ${EXPENSE_CATEGORIES.join(', ')}`;
    } else if (firstError.path.includes('date')) {
      errorCode = 'INVALID_DATE';
      errorMessage = 'Date is required';
    } else if (firstError.path.includes('splitType')) {
      errorCode = 'INVALID_SPLIT_TYPE';
      errorMessage = 'Split type must be equal, exact, or percentage';
    } else if (firstError.path.includes('participants')) {
      errorCode = 'INVALID_PARTICIPANTS';
      errorMessage = 'At least one participant is required';
    } else if (firstError.message.includes('at least 1 key')) {
      errorCode = 'NO_UPDATE_FIELDS';
      errorMessage = 'No valid fields to update';
    }
    
    throw new ApiError(HTTP_STATUS.BAD_REQUEST, errorCode, errorMessage);
  }

  const update: UpdateExpenseRequest = {};

  if ('amount' in value) {
    update.amount = value.amount;
  }

  if ('description' in value) {
    update.description = value.description.trim();
  }

  if ('category' in value) {
    update.category = value.category;
  }

  if ('date' in value) {
    const expenseDate = new Date(value.date);
    if (isNaN(expenseDate.getTime())) {
      throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'INVALID_DATE', 'Invalid date format');
    }
    update.date = value.date;
  }

  if ('splitType' in value || 'participants' in value || 'splits' in value) {
    const splitType = value.splitType || 'equal';
    const participants = value.participants || [];
    const splits = value.splits;

    if (splitType === 'exact' || splitType === 'percentage') {
      if (!Array.isArray(splits) || splits.length !== participants.length) {
        throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'INVALID_SPLITS', 'Splits must be provided for all participants');
      }
    }

    update.splitType = splitType;
    update.participants = participants.map((p: string) => p.trim());
    update.splits = splits;
  }

  if ('receiptUrl' in value) {
    update.receiptUrl = value.receiptUrl?.trim();
  }

  return sanitizeExpenseData(update) as UpdateExpenseRequest;
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