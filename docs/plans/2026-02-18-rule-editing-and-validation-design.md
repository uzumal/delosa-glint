# Rule Editing & Validation Design

**Goal:** Allow users to edit existing rules and add field validation to the wizard.

## Rule Editing

Reuse `CreateRuleWizard` with an optional `editRule?: Rule` prop. When provided, wizard initializes from the rule and preserves its `id`/`createdAt` on save.

- `RuleCard` gets an edit button
- `RuleList` propagates `onEditRule`
- `App.tsx` adds `"edit"` view with `editingRule` state
- Wizard shows "Update Rule" instead of "Save Rule" in edit mode

## Validation

Pure validation functions in `src/lib/validators.ts`:
- `validateWebhookUrl` — valid URL, must be http(s)
- `validateUrlPattern` — non-empty
- `validateRuleName` — non-empty, max 100 chars
- `validateSelector` — non-empty, valid CSS

Inline error messages shown on blur. Next/Save stays disabled until valid.
