/**
 * Fiscal: the FiscalProvider interface, fiscal receipts, corrective documents and the fiscal outbox. Only MockFiscalProvider is implemented until the ATK spec is read (CLAUDE.md section 7).
 *
 * <p>Other modules use this module only through its public service interfaces or domain
 * events, never through its repositories (CLAUDE.md section 4).
 */
package com.tavolina.fiscal;
