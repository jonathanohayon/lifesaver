import { AppError } from '../../common/errors/AppError.js';
import { isDatabaseConfigured } from '../../db/pool.js';
import {
  assertSupportTicketSafeForBrowser,
  buildSupportImportPreview,
  parseSupportImportMessages,
  supportTicketRowToSafeResponse,
} from './support-readonly-import.model.js';
import { listRecentSupportTickets, upsertSupportTicket } from './support-readonly-import.repository.js';
import type { SafeSupportTicketResponse, SupportImportPreviewResult, SupportImportResult } from './support-readonly-import.types.js';

function assertDatabaseReady() {
  if (!isDatabaseConfigured) {
    throw new AppError(503, 'DATABASE_NOT_CONFIGURED', 'Database is required to import support tickets.');
  }
}

export function previewReadOnlySupportImport(input: unknown): SupportImportPreviewResult {
  const preview = buildSupportImportPreview(input);
  assertSupportTicketSafeForBrowser(preview);
  return preview;
}

export async function importReadOnlySupportTickets(params: {
  workspaceId: string;
  userId: string;
  input: unknown;
}): Promise<SupportImportResult> {
  assertDatabaseReady();
  const parsed = parseSupportImportMessages(params.input);
  const tickets: SafeSupportTicketResponse[] = [];

  for (let index = 0; index < parsed.tickets.length; index += 1) {
    const row = await upsertSupportTicket({
      workspaceId: params.workspaceId,
      userId: params.userId,
      ticket: parsed.tickets[index],
      rawProviderPayload: parsed.rawPayloads[index] ?? {},
    });
    tickets.push(supportTicketRowToSafeResponse(row));
  }

  const result: SupportImportResult = {
    imported: true,
    externalApiCalled: false,
    emailSent: false,
    createdOrUpdatedCount: tickets.length,
    tickets,
    warnings: parsed.warnings,
  };
  assertSupportTicketSafeForBrowser(result);
  return result;
}

export async function listRecentSafeSupportTickets(workspaceId: string, limit?: number): Promise<{ tickets: SafeSupportTicketResponse[]; externalApiCalled: false; emailSent: false }> {
  assertDatabaseReady();
  const rows = await listRecentSupportTickets(workspaceId, limit);
  const tickets = rows.map(supportTicketRowToSafeResponse);
  const result = { tickets, externalApiCalled: false as const, emailSent: false as const };
  assertSupportTicketSafeForBrowser(result);
  return result;
}
