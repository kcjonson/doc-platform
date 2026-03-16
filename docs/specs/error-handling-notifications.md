# Error Handling & Notifications Specification

This specification defines a universal toast/notification system and consistent error handling across all features.

---

## Overview

Create a unified approach to user-facing feedback:
- **Toast notifications** for transient messages (success, error, warning, info)
- **Consistent error handling** across all API endpoints and frontend features
- **Save state indicators** for document persistence status

---

## Requirements

### Toast System
- Toast component in `@specboard/ui` with success, error, warning, info variants
- `ToastProvider` context for app-wide notifications
- `useToast` hook for triggering toasts
- Configurable auto-dismiss timing and manual dismiss
- Accessible (screen readers, focus management)
- Stacking behavior for multiple simultaneous toasts

### Error Handling Standardization
- Audit all API endpoints for consistent error response format
- Audit all frontend features for consistent error display
- Standardized error response shape from API

### Save State Notifications
- "Saved locally" indicator (local storage mode)
- "Saved to cloud" indicator (S3/cloud storage mode)
- "Pushed to GitHub" confirmation (after successful commit)
- Clear visual distinction between pending changes vs committed

---

## Dependencies

None

## Status

Needs implementation
