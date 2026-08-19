package types

// ParseStatusCreditExhausted means document processing stopped because the
// tenant's provider-managed monthly AI credit budget was exhausted. The
// original knowledge object and storage key remain intact so the existing
// reparse path can reset the row to pending after an upgrade or monthly reset
// without requiring another upload.
const ParseStatusCreditExhausted = "credit_exhausted"
