import { getAppBuilder } from '../ApplicationBuilderSingleton';
import { CommentHandlers } from './CommentHandlers';

const commentHandlers = CommentHandlers.createCommentHandlers(getAppBuilder());

export const createComment = commentHandlers.createComment;
export const listGroupComments = commentHandlers.listGroupComments;
export const listExpenseComments = commentHandlers.listExpenseComments;
