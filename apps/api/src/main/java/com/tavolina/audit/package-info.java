/**
 * Audit: the append-only audit log. Nothing here is ever updated or deleted.
 *
 * <p>Other modules use this module only through its public service interfaces or domain
 * events, never through its repositories (CLAUDE.md section 4).
 */
package com.tavolina.audit;
