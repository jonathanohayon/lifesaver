export type DraftStatus = 'draft' | 'approved' | 'rejected';

export type DraftType = 'content' | 'support_reply' | 'general';

export type DraftRow = {
  id: string;
  workspace_id: string;
  user_id: string | null;
  draft_type: DraftType | string;
  prompt: string;
  content: string;
  status: DraftStatus | string;
  metadata: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
};

export type DraftResponse = {
  id: string;
  draftType: string;
  prompt: string;
  content: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  metadata: Record<string, unknown>;
};
