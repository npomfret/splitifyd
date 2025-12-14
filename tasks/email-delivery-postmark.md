# Email Delivery Service - Postmark Integration

## Overview

Implement email delivery using Postmark (https://postmarkapp.com) as the transactional email service.

## Why Postmark

- High deliverability rates
- Dedicated IP pools for transactional email
- Real-time analytics and bounce handling
- Simple REST API
- Webhook support for delivery events

## Requirements

- [ ] Send transactional emails (password reset, email verification, etc.)
- [ ] Send notification emails (group invites, expense notifications, etc.)
- [ ] Handle bounces and complaints
- [ ] Track delivery status
- [ ] Support email templates

## Research Needed

- Postmark API documentation
- Server token vs account token usage
- Template system capabilities
- Webhook event types
- Rate limits and pricing tiers

## Technical Considerations

- Service abstraction layer (to allow swapping providers)
- Configuration via environment variables
- Error handling and retry logic
- Email queue for high-volume scenarios
- Development/testing without sending real emails

## Implementation Plan

TBD - needs research and planning

## Resources

- Postmark Login: https://account.postmarkapp.com/login
- API Docs: https://postmarkapp.com/developer
- Node.js Client: https://github.com/ActiveCampaign/postmark.js
