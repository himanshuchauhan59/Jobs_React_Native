/**
 * Follow-up Storage & State Management
 * Handles tracking, persistence in AsyncStorage, reply synchronization with Gmail Webhook,
 * and automated status progression.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { extractCompanyFromEmail, getElapsedDays } from './followUpTemplates';
import { INITIAL_SENT_LOG } from '@/constants/initialSentLog';

export type FollowUpStatus =
  | 'needs_followup' // >= 3 days since initial sent or >= 5 days since last follow-up, no reply
  | 'waiting' // < 3 days since initial sent, awaiting initial response
  | 'followed_up' // follow-up sent recently, awaiting response
  | 'replied' // recruiter replied in Gmail
  | 'interview' // interview scheduled / high interest
  | 'closed'; // closed / not interested / rejected

export interface FollowUpHistoryEntry {
  sentAt: string;
  templateType: string;
  subject: string;
}

export interface FollowUpRecord {
  id: string;
  email: string;
  companyName: string;
  roleTitle: string;
  initialSentAt: string;
  followUpCount: number;
  lastFollowUpAt?: string;
  history?: FollowUpHistoryEntry[];
  status: FollowUpStatus;
  notes?: string;
  replySnippet?: string;
  replyDate?: string;
  messageId?: string;
}

const STORAGE_KEY = '@job_emails_followup_tracker_v2';

/**
 * Determine dynamic status based on time elapsed and reply state
 */
export function computeRecordStatus(record: FollowUpRecord): FollowUpStatus {
  // If explicitly designated terminal or positive states, retain them
  if (['replied', 'interview', 'closed'].includes(record.status)) {
    return record.status;
  }

  const initialDays = getElapsedDays(record.initialSentAt);

  if (record.followUpCount === 0) {
    // Has not been followed up yet
    return initialDays >= 3 ? 'needs_followup' : 'waiting';
  } else {
    // Has been followed up at least once
    const daysSinceLastFollowUp = getElapsedDays(record.lastFollowUpAt || record.initialSentAt);
    if (daysSinceLastFollowUp >= 5 && record.followUpCount < 3) {
      return 'needs_followup';
    }
    return 'followed_up';
  }
}

/**
 * Retrieve all follow-up records with real-time status calculation
 */
export async function getFollowUpRecords(): Promise<FollowUpRecord[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    let records: FollowUpRecord[] = [];

    if (raw) {
      records = JSON.parse(raw);
    } else {
      // First run: automatically initialize with the pre-compiled sent log history
      records = await initializeFromSeed();
    }

    // Refresh dynamic status and sort in descending order (LIFO stack-wise: newest first)
    return records
      .map((r) => ({
        ...r,
        status: computeRecordStatus(r),
      }))
      .sort((a, b) => {
        const timeA = new Date(a.lastFollowUpAt || a.replyDate || a.initialSentAt || 0).getTime();
        const timeB = new Date(b.lastFollowUpAt || b.replyDate || b.initialSentAt || 0).getTime();
        const safeA = isNaN(timeA) ? 0 : timeA;
        const safeB = isNaN(timeB) ? 0 : timeB;
        if (safeB !== safeA) return safeB - safeA;
        return b.id.localeCompare(a.id);
      });
  } catch (err) {
    console.warn('Failed to load follow-up records from storage', err);
    return [];
  }
}

/**
 * Persist records to AsyncStorage
 */
export async function saveFollowUpRecords(records: FollowUpRecord[]): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  } catch (err) {
    console.error('Failed to save follow-up records', err);
  }
}

/**
 * Seed initial 209 historical applications from sent_emails_log
 */
export async function initializeFromSeed(): Promise<FollowUpRecord[]> {
  const records: FollowUpRecord[] = INITIAL_SENT_LOG.map((item, idx) => {
    const email = item.email.trim().toLowerCase();
    const company = extractCompanyFromEmail(email);
    const rec: FollowUpRecord = {
      id: `seed-${idx}-${email}`,
      email,
      companyName: company,
      roleTitle: 'Full Stack Developer',
      initialSentAt: item.sentAt,
      followUpCount: 0,
      status: 'needs_followup',
      messageId: item.messageId,
    };
    rec.status = computeRecordStatus(rec);
    return rec;
  });

  await saveFollowUpRecords(records);
  return records;
}

/**
 * Automatically record newly dispatched emails from main Dispatch screen
 */
export async function addSentBatch(
  emails: string[],
  options?: { roleTitle?: string; customSentAt?: string }
): Promise<FollowUpRecord[]> {
  const current = await getFollowUpRecords();
  const existingMap = new Map<string, FollowUpRecord>();

  for (const r of current) {
    existingMap.set(r.email.toLowerCase(), r);
  }

  const now = options?.customSentAt || new Date().toISOString();
  const role = options?.roleTitle || 'Full Stack Developer';

  for (const rawEmail of emails) {
    const email = rawEmail.trim().toLowerCase();
    if (!email || !email.includes('@')) continue;

    if (!existingMap.has(email)) {
      const company = extractCompanyFromEmail(email);
      const newRec: FollowUpRecord = {
        id: `rec-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        email,
        companyName: company,
        roleTitle: role,
        initialSentAt: now,
        followUpCount: 0,
        status: 'waiting',
      };
      existingMap.set(email, newRec);
    }
  }

  const updated = Array.from(existingMap.values());
  await saveFollowUpRecords(updated);
  return updated;
}

/**
 * Manually add a single company application to follow-up tracker
 */
export async function addSingleApplication(
  email: string,
  options?: {
    companyName?: string;
    roleTitle?: string;
    initialSentAt?: string;
    status?: FollowUpStatus;
    notes?: string;
  }
): Promise<FollowUpRecord> {
  const current = await getFollowUpRecords();
  const cleanEmail = email.trim().toLowerCase();
  const existingIndex = current.findIndex((r) => r.email.toLowerCase() === cleanEmail);

  const company = options?.companyName?.trim() || extractCompanyFromEmail(cleanEmail);
  const role = options?.roleTitle?.trim() || 'Full Stack Developer';
  const now = options?.initialSentAt || new Date().toISOString();
  const initialStatus = options?.status || 'needs_followup';

  if (existingIndex >= 0) {
    // Update existing record
    const updated: FollowUpRecord = {
      ...current[existingIndex],
      companyName: company || current[existingIndex].companyName,
      roleTitle: role || current[existingIndex].roleTitle,
      status: initialStatus,
      notes: options?.notes !== undefined ? options.notes : current[existingIndex].notes,
    };
    current[existingIndex] = updated;
    await saveFollowUpRecords(current);
    return updated;
  } else {
    // Insert new record at top
    const newRecord: FollowUpRecord = {
      id: `manual-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      email: cleanEmail,
      companyName: company,
      roleTitle: role,
      initialSentAt: now,
      followUpCount: 0,
      status: initialStatus,
      notes: options?.notes,
    };
    const updated = [newRecord, ...current];
    await saveFollowUpRecords(updated);
    return newRecord;
  }
}

/**
 * Record a successful follow-up dispatch
 */
export async function recordFollowUpSent(
  id: string,
  entry: { templateType: string; subject: string }
): Promise<FollowUpRecord | null> {
  const records = await getFollowUpRecords();
  const target = records.find((r) => r.id === id);

  if (!target) return null;

  const now = new Date().toISOString();
  target.followUpCount = (target.followUpCount || 0) + 1;
  target.lastFollowUpAt = now;
  target.status = 'followed_up';

  if (!target.history) {
    target.history = [];
  }

  target.history.unshift({
    sentAt: now,
    templateType: entry.templateType,
    subject: entry.subject,
  });

  await saveFollowUpRecords(records);
  return target;
}

/**
 * Manually update status of a record (e.g. marked as Replied, Interview, Closed)
 */
export async function updateRecordStatus(
  id: string,
  newStatus: FollowUpStatus,
  notes?: string
): Promise<void> {
  const records = await getFollowUpRecords();
  const target = records.find((r) => r.id === id);
  if (!target) return;

  target.status = newStatus;
  if (notes !== undefined) {
    target.notes = notes;
  }

  await saveFollowUpRecords(records);
}

/**
 * Update notes or job description for a specific application record
 */
export async function updateRecordNotes(
  id: string,
  notes: string
): Promise<FollowUpRecord | null> {
  const records = await getFollowUpRecords();
  const target = records.find((r) => r.id === id);
  if (!target) return null;

  target.notes = notes;
  await saveFollowUpRecords(records);
  return target;
}

/**
 * Sync with Gmail Webhook to detect recruiter responses
 */
export async function syncWithGmailReplies(
  webhookUrl: string
): Promise<{ success: boolean; updatedCount: number; repliesCount: number; error?: string }> {
  if (!webhookUrl || !webhookUrl.startsWith('http')) {
    return { success: false, updatedCount: 0, repliesCount: 0, error: 'Invalid or missing Webhook URL' };
  }

  try {
    // Call GET ?action=replies
    const url = webhookUrl.includes('?') ? `${webhookUrl}&action=replies` : `${webhookUrl}?action=replies`;
    const res = await fetch(url);
    const data = await res.json();

    if (!data || data.success === false) {
      throw new Error(data?.error || 'Webhook failed to return recruiter replies');
    }

    const replies: Array<{
      from: string;
      subject: string;
      snippet: string;
      date: string;
      isUnread: boolean;
    }> = data.replies || [];

    const records = await getFollowUpRecords();
    let updatedCount = 0;

    for (const reply of replies) {
      const fromLower = (reply.from || '').toLowerCase();

      // Find matching record
      const match = records.find((r) => {
        const targetEmail = r.email.toLowerCase();
        return fromLower.includes(targetEmail);
      });

      if (match) {
        if (match.status !== 'replied' && match.status !== 'interview') {
          match.status = 'replied';
          match.replySnippet = reply.snippet;
          match.replyDate = reply.date;
          updatedCount++;
        }
      }
    }

    if (updatedCount > 0) {
      await saveFollowUpRecords(records);
    }

    return {
      success: true,
      updatedCount,
      repliesCount: replies.length,
    };
  } catch (err: any) {
    return {
      success: false,
      updatedCount: 0,
      repliesCount: 0,
      error: err?.message || 'Failed to sync with Gmail',
    };
  }
}

/**
 * Dispatch follow-up email via Webhook
 */
export async function dispatchFollowUp({
  webhookUrl,
  recipientEmail,
  subject,
  textBody,
  htmlBody,
  candidate,
  recordId,
  templateType,
}: {
  webhookUrl?: string;
  recipientEmail: string;
  subject: string;
  textBody: string;
  htmlBody: string;
  candidate?: any;
  recordId: string;
  templateType: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    if (webhookUrl && webhookUrl.trim().startsWith('http')) {
      const res = await fetch(webhookUrl.trim(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'send_single',
          to: recipientEmail.trim(),
          subject,
          textBody,
          htmlBody,
          candidate,
        }),
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
    } else {
      // Local development simulation delay
      await new Promise((resolve) => setTimeout(resolve, 800));
    }

    // Record follow-up in storage
    await recordFollowUpSent(recordId, { templateType, subject });

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to send follow-up' };
  }
}
