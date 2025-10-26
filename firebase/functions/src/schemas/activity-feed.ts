import { ActivityFeedActions, ActivityFeedEventTypes } from '@splitifyd/shared';
import { z } from 'zod';
import { AuditFieldsSchema, createDocumentSchemas, FirestoreTimestampSchema, GroupIdSchema } from './common';

const ActivityFeedDetailsSchema = z
    .object({
        expenseId: z.string().min(1).optional(),
        expenseDescription: z.string().min(1).optional(),
        commentId: z.string().min(1).optional(),
        commentPreview: z.string().min(1).optional(),
        settlementId: z.string().min(1).optional(),
        settlementDescription: z.string().min(1).optional(),
        targetUserId: z.string().min(1).optional(),
        targetUserName: z.string().min(1).optional(),
        previousGroupName: z.string().min(1).optional(),
    })
    .strict()
    .partial();

const ActivityFeedBaseSchema = z
    .object({
        userId: z.string().min(1),
        groupId: GroupIdSchema,
        groupName: z.string().min(1),
        eventType: z.enum(Object.values(ActivityFeedEventTypes) as [string, ...string[]]),
        action: z.enum(Object.values(ActivityFeedActions) as [string, ...string[]]),
        actorId: z.string().min(1),
        actorName: z.string().min(1),
        timestamp: FirestoreTimestampSchema,
        details: ActivityFeedDetailsSchema.default({}),
    })
    .merge(AuditFieldsSchema);

export const ActivityFeedDocumentSchema = createDocumentSchemas(ActivityFeedBaseSchema).DocumentSchema;
export type ActivityFeedDocument = z.infer<typeof ActivityFeedDocumentSchema>;
