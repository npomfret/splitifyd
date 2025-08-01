# Task: Implement Soft Deletes for Expenses

## Description

The current implementation of deleting expenses permanently removes them from the database. This can lead to issues with historical data and auditing.

## Requirement

Modify the expense deletion logic to implement a "soft delete" mechanism. Instead of permanently deleting the expense record, it should be marked as deleted. This can be achieved by adding a `deletedAt` timestamp field to the expense model.

- When an expense is "deleted" by a user, set the `deletedAt` field to the current timestamp.
- All queries for expenses should be updated to filter out documents where `deletedAt` is not null.
- There should be a mechanism (perhaps an admin-only feature) to permanently delete soft-deleted expenses after a certain period (e.g., 30 days).
