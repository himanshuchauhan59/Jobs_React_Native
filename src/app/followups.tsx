import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  Modal,
  Platform,
  ActivityIndicator,
  useColorScheme,
  Alert,
  Vibration,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { useConfig } from '@/context/ConfigContext';
import { CANDIDATE } from '@/services/emailService';
import {
  FollowUpRecord,
  FollowUpStatus,
  getFollowUpRecords,
  updateRecordStatus,
  updateRecordNotes,
  syncWithGmailReplies,
  dispatchFollowUp,
} from '@/services/followUpStorage';
import {
  buildFollowUpEmail,
  FollowUpTemplateType,
  formatSentDate,
  getElapsedDays,
} from '@/services/followUpTemplates';

export default function FollowUpsScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme !== 'light';
  const { config } = useConfig();

  // State
  const [records, setRecords] = useState<FollowUpRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'due' | 'replied' | 'waiting' | 'followed_up'>('all');
  const [isSyncingReplies, setIsSyncingReplies] = useState<boolean>(false);
  const [bannerMessage, setBannerMessage] = useState<string | null>(null);

  // Multi-Selection State (Only for cards with status === 'needs_followup')
  const [isSelectionMode, setIsSelectionMode] = useState<boolean>(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Bulk Follow-Up State (Unified in Composer)
  const [composerBulkActive, setComposerBulkActive] = useState<boolean>(false);
  const [bulkDispatchProgress, setBulkDispatchProgress] = useState<{
    currentIndex: number;
    total: number;
    currentCompany: string;
    completed: boolean;
  } | null>(null);

  // Application Detail Bottom Sheet Modal State
  const [detailRecord, setDetailRecord] = useState<FollowUpRecord | null>(null);
  const [isEditingNotes, setIsEditingNotes] = useState<boolean>(false);
  const [editedNotesText, setEditedNotesText] = useState<string>('');
  const [isSavingNotes, setIsSavingNotes] = useState<boolean>(false);
  const [copiedNotes, setCopiedNotes] = useState<boolean>(false);
  const [copiedReply, setCopiedReply] = useState<boolean>(false);

  const openDetailSheet = (record: FollowUpRecord) => {
    setDetailRecord(record);
    setIsEditingNotes(false);
    setEditedNotesText(record.notes || '');
  };

  // Status Action Sheet Modal
  const [statusMenuRecord, setStatusMenuRecord] = useState<FollowUpRecord | null>(null);

  // Follow-Up Composer Modal State
  const [composerRecord, setComposerRecord] = useState<FollowUpRecord | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<FollowUpTemplateType>('bump');
  const [editableSubject, setEditableSubject] = useState<string>('');
  const [editableBody, setEditableBody] = useState<string>('');
  const [isDispatching, setIsDispatching] = useState<boolean>(false);

  // Load records
  const loadData = useCallback(async () => {
    setLoading(true);
    const data = await getFollowUpRecords();
    setRecords(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const showBanner = (msg: string) => {
    setBannerMessage(msg);
    setTimeout(() => setBannerMessage(null), 3500);
  };

  // Sync Gmail replies via Google Apps Script Webhook
  const handleSyncReplies = async () => {
    if (!config.webhookUrl || !config.webhookUrl.trim().startsWith('http')) {
      Alert.alert(
        'Webhook Required',
        'Please enter your Google Apps Script Webhook URL in Settings first to sync incoming recruiter replies.'
      );
      return;
    }

    setIsSyncingReplies(true);
    const result = await syncWithGmailReplies(config.webhookUrl);
    setIsSyncingReplies(false);

    if (result.success) {
      await loadData();
      showBanner(
        result.updatedCount > 0
          ? `Detected ${result.updatedCount} new recruiter ${result.updatedCount === 1 ? 'reply' : 'replies'}!`
          : `Checked Gmail (${result.repliesCount} total HR emails scanned). No new replies.`
      );
    } else {
      Alert.alert('Sync Failed', result.error || 'Could not connect to Gmail script.');
    }
  };


  // Metrics computation
  const metrics = useMemo(() => {
    let due = 0;
    let replied = 0;
    let waiting = 0;
    let followedUp = 0;

    for (const r of records) {
      if (r.status === 'needs_followup') due++;
      else if (r.status === 'replied' || r.status === 'interview') replied++;
      else if (r.status === 'waiting') waiting++;
      else if (r.status === 'followed_up') followedUp++;
    }

    return { total: records.length, due, replied, waiting, followedUp };
  }, [records]);

  // Pagination State
  const [currentPage, setCurrentPage] = useState<number>(1);
  const ITEMS_PER_PAGE = 10;

  // Filtered and searched records (sorted by default in descending order / LIFO stack-wise)
  const filteredRecords = useMemo(() => {
    const list = records.filter((r) => {
      // 1. Text filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const matchEmail = r.email.toLowerCase().includes(query);
        const matchCompany = r.companyName.toLowerCase().includes(query);
        const matchRole = r.roleTitle.toLowerCase().includes(query);
        if (!matchEmail && !matchCompany && !matchRole) return false;
      }

      // 2. Tab filter
      if (activeFilter === 'due') return r.status === 'needs_followup';
      if (activeFilter === 'replied') return r.status === 'replied' || r.status === 'interview';
      if (activeFilter === 'waiting') return r.status === 'waiting';
      if (activeFilter === 'followed_up') return r.status === 'followed_up';

      return true;
    });

    // Sort descending by time (LIFO / Stack-wise: newest activity/application first)
    return [...list].sort((a, b) => {
      const timeA = new Date(a.lastFollowUpAt || a.replyDate || a.initialSentAt || 0).getTime();
      const timeB = new Date(b.lastFollowUpAt || b.replyDate || b.initialSentAt || 0).getTime();
      const safeA = isNaN(timeA) ? 0 : timeA;
      const safeB = isNaN(timeB) ? 0 : timeB;
      if (safeB !== safeA) return safeB - safeA;
      return b.id.localeCompare(a.id);
    });
  }, [records, searchQuery, activeFilter]);

  // Reset page when filter or search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [activeFilter, searchQuery]);

  // Pagination calculations
  const totalPages = Math.max(1, Math.ceil(filteredRecords.length / ITEMS_PER_PAGE));
  const paginatedRecords = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredRecords.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredRecords, currentPage]);

  // Records that currently require a follow-up
  const dueRecords = useMemo(() => {
    return filteredRecords.filter((r) => r.status === 'needs_followup');
  }, [filteredRecords]);

  // Selected follow-up record objects
  const selectedRecords = useMemo(() => {
    return records.filter((r) => selectedIds.has(r.id) && r.status === 'needs_followup');
  }, [records, selectedIds]);

  const allDueSelected = useMemo(() => {
    if (dueRecords.length === 0) return false;
    return dueRecords.every((r) => selectedIds.has(r.id));
  }, [dueRecords, selectedIds]);

  // Handle card long-press: only allow on cards requiring follow-up
  const handleCardLongPress = (item: FollowUpRecord) => {
    if (item.status !== 'needs_followup') {
      showBanner('Only cards with pending follow-ups can be selected.');
      return;
    }

    if (Platform.OS !== 'web') {
      try {
        Vibration.vibrate(40);
      } catch {}
    }

    if (!isSelectionMode) {
      setIsSelectionMode(true);
      setSelectedIds(new Set([item.id]));
    } else {
      toggleCardSelection(item.id);
    }
  };

  // Toggle selection for a card
  const toggleCardSelection = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      if (next.size === 0) {
        setIsSelectionMode(false);
      }
      return next;
    });
  };

  // Handle card regular tap
  const handleCardPress = (item: FollowUpRecord) => {
    if (isSelectionMode) {
      if (item.status === 'needs_followup') {
        toggleCardSelection(item.id);
      } else {
        showBanner('This card does not require a follow-up email.');
      }
    } else {
      openDetailSheet(item);
    }
  };

  // Select all or deselect all due cards
  const handleToggleSelectAllDue = () => {
    if (allDueSelected) {
      setSelectedIds(new Set());
      setIsSelectionMode(false);
    } else {
      setIsSelectionMode(true);
      const next = new Set(selectedIds);
      dueRecords.forEach((r) => next.add(r.id));
      setSelectedIds(next);
    }
  };

  // Exit multi-selection mode
  const exitSelectionMode = () => {
    setIsSelectionMode(false);
    setSelectedIds(new Set());
  };

  // Open Bulk Follow-up Composer Modal for Selected Cards
  const openBulkComposer = (defaultTemplate?: FollowUpTemplateType) => {
    if (selectedRecords.length === 0) return;
    const initialTpl: FollowUpTemplateType = defaultTemplate || 'bump';
    setSelectedTemplate(initialTpl);
    setComposerBulkActive(true);
    setComposerRecord(selectedRecords[0]);

    const generated = buildFollowUpEmail({
      recipientEmail: selectedRecords[0].email,
      roleTitle: config.roleTitle || 'Full Stack Developer',
      templateType: initialTpl,
      candidateName: config.candidateName || CANDIDATE.fullName,
      noticePeriod: config.noticePeriod || CANDIDATE.noticePeriod,
    });

    setEditableSubject(generated.subject);
    setEditableBody(generated.textBody);
  };

  // Open Follow-up Composer Modal for a Single Card
  const openComposer = (record: FollowUpRecord, defaultTemplate?: FollowUpTemplateType) => {
    setComposerBulkActive(false);
    setComposerRecord(record);
    const initialTpl: FollowUpTemplateType =
      defaultTemplate ||
      (record.status === 'replied'
        ? 'questionnaire'
        : record.followUpCount > 0
        ? 'value'
        : 'bump');

    setSelectedTemplate(initialTpl);

    const generated = buildFollowUpEmail({
      recipientEmail: record.email,
      roleTitle: record.roleTitle || config.roleTitle,
      initialSentAt: record.initialSentAt,
      followUpCount: record.followUpCount,
      templateType: initialTpl,
      candidateName: config.candidateName || CANDIDATE.fullName,
      noticePeriod: config.noticePeriod || CANDIDATE.noticePeriod,
    });

    setEditableSubject(generated.subject);
    setEditableBody(generated.textBody);
  };

  // When user changes template in Composer
  const handleSelectTemplate = (type: FollowUpTemplateType) => {
    if (!composerRecord) return;
    setSelectedTemplate(type);

    const generated = buildFollowUpEmail({
      recipientEmail: composerRecord.email,
      roleTitle: composerRecord.roleTitle || config.roleTitle,
      initialSentAt: composerRecord.initialSentAt,
      followUpCount: composerRecord.followUpCount,
      templateType: type,
      candidateName: config.candidateName || CANDIDATE.fullName,
      noticePeriod: config.noticePeriod || CANDIDATE.noticePeriod,
    });

    setEditableSubject(generated.subject);
    setEditableBody(generated.textBody);
  };

  // Dispatch Follow-up via Webhook (Single or Bulk)
  const handleSendFollowUp = async () => {
    if (composerBulkActive && selectedRecords.length > 0) {
      if (!config.webhookUrl || !config.webhookUrl.trim().startsWith('http')) {
        Alert.alert(
          'Webhook Required',
          'Please enter your Google Apps Script Webhook URL in Settings first to send 1-Tap follow-up emails.'
        );
        return;
      }

      setIsDispatching(true);
      setBulkDispatchProgress({
        currentIndex: 0,
        total: selectedRecords.length,
        currentCompany: selectedRecords[0].companyName,
        completed: false,
      });

      let successCount = 0;
      const delayMs = Math.max(1500, (config.delaySeconds || 3) * 1000);

      for (let i = 0; i < selectedRecords.length; i++) {
        const item = selectedRecords[i];
        setBulkDispatchProgress({
          currentIndex: i + 1,
          total: selectedRecords.length,
          currentCompany: item.companyName,
          completed: false,
        });

        const emailContent = buildFollowUpEmail({
          recipientEmail: item.email,
          roleTitle: item.roleTitle || config.roleTitle,
          initialSentAt: item.initialSentAt,
          followUpCount: item.followUpCount,
          templateType: selectedTemplate,
          candidateName: config.candidateName || CANDIDATE.fullName,
          noticePeriod: config.noticePeriod || CANDIDATE.noticePeriod,
        });

        const res = await dispatchFollowUp({
          webhookUrl: config.webhookUrl,
          recipientEmail: item.email,
          subject: editableSubject,
          textBody: editableBody,
          htmlBody: emailContent.htmlBody,
          candidate: {
            fullName: config.candidateName || CANDIDATE.fullName,
            email: CANDIDATE.email,
            roleTitle: config.roleTitle || CANDIDATE.title,
            noticePeriod: config.noticePeriod || CANDIDATE.noticePeriod,
            portfolio: CANDIDATE.portfolio,
          },
          recordId: item.id,
          templateType: selectedTemplate,
        });

        if (res.success) {
          successCount++;
        }

        if (i < selectedRecords.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, delayMs));
        }
      }

      setBulkDispatchProgress((prev) => (prev ? { ...prev, completed: true } : null));
      setIsDispatching(false);

      await loadData();
      exitSelectionMode();
      setComposerRecord(null);
      setComposerBulkActive(false);
      setBulkDispatchProgress(null);
      showBanner(`Successfully dispatched follow-up emails to ${successCount} recipients!`);
      return;
    }

    if (!composerRecord) return;

    setIsDispatching(true);

    const generated = buildFollowUpEmail({
      recipientEmail: composerRecord.email,
      roleTitle: composerRecord.roleTitle || config.roleTitle,
      initialSentAt: composerRecord.initialSentAt,
      followUpCount: composerRecord.followUpCount,
      templateType: selectedTemplate,
      candidateName: config.candidateName || CANDIDATE.fullName,
      noticePeriod: config.noticePeriod || CANDIDATE.noticePeriod,
    });

    const result = await dispatchFollowUp({
      webhookUrl: config.webhookUrl.trim() || undefined,
      recipientEmail: composerRecord.email,
      subject: editableSubject,
      textBody: editableBody,
      htmlBody: generated.htmlBody,
      recordId: composerRecord.id,
      templateType: selectedTemplate,
      candidate: {
        ...CANDIDATE,
        fullName: config.candidateName || CANDIDATE.fullName,
        noticePeriod: config.noticePeriod || CANDIDATE.noticePeriod,
        title: config.roleTitle || CANDIDATE.title,
      },
    });

    setIsDispatching(false);

    if (result.success) {
      setComposerRecord(null);
      setComposerBulkActive(false);
      await loadData();
      showBanner(`Follow-up dispatched to ${composerRecord.email}!`);
    } else {
      Alert.alert('Send Error', result.error || 'Failed to dispatch follow-up.');
    }
  };

  // Open in native Email client (Single or Bulk)
  const handleOpenInMailClient = async () => {
    if (composerBulkActive && selectedRecords.length > 0) {
      const bcc = selectedRecords.map((r) => r.email).join(',');
      const mailtoUrl = `mailto:?bcc=${encodeURIComponent(bcc)}&subject=${encodeURIComponent(
        editableSubject
      )}&body=${encodeURIComponent(editableBody)}`;

      const supported = await Linking.canOpenURL(mailtoUrl);
      if (supported) {
        await Linking.openURL(mailtoUrl);
        Alert.alert(
          'Mark Selected as Followed Up?',
          `Did you dispatch follow-ups to these ${selectedRecords.length} recipients in your mail app?`,
          [
            { text: 'Not Yet', style: 'cancel' },
            {
              text: 'Yes, Mark All Sent',
              onPress: async () => {
                for (const item of selectedRecords) {
                  await updateRecordStatus(item.id, 'followed_up');
                }
                await loadData();
                exitSelectionMode();
                setComposerRecord(null);
                setComposerBulkActive(false);
                showBanner(`Marked ${selectedRecords.length} applications as followed up!`);
              },
            },
          ]
        );
      } else {
        Alert.alert('Cannot Open Mail', 'Could not open native email client.');
      }
      return;
    }

    if (!composerRecord) return;
    const mailtoUrl = `mailto:${composerRecord.email}?subject=${encodeURIComponent(
      editableSubject
    )}&body=${encodeURIComponent(editableBody)}`;

    const supported = await Linking.canOpenURL(mailtoUrl);
    if (supported) {
      await Linking.openURL(mailtoUrl);
      Alert.alert('Mark as Followed Up?', 'Did you send this email from your mail app?', [
        { text: 'Not Yet', style: 'cancel' },
        {
          text: 'Yes, Mark Sent',
          onPress: async () => {
            await updateRecordStatus(composerRecord.id, 'followed_up');
            setComposerRecord(null);
            setComposerBulkActive(false);
            await loadData();
          },
        },
      ]);
    } else {
      Alert.alert('Cannot Open Mail', 'Could not open native email client.');
    }
  };

  // Copy email text
  const handleCopyText = async () => {
    const fullText = `Subject: ${editableSubject}\n\n${editableBody}`;
    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
      await navigator.clipboard.writeText(fullText);
      showBanner('Subject & message copied to clipboard!');
    } else {
      Alert.alert('Email Preview', fullText);
    }
  };

  // Update status from menu
  const handleSetStatus = async (status: FollowUpStatus) => {
    if (!statusMenuRecord) return;
    await updateRecordStatus(statusMenuRecord.id, status);
    setStatusMenuRecord(null);
    await loadData();
    showBanner(`Status updated to ${status}`);
  };

  // Save edited notes/description directly from the detail modal
  const handleSaveEditedNotes = async () => {
    if (!detailRecord) return;
    setIsSavingNotes(true);
    try {
      const updated = await updateRecordNotes(detailRecord.id, editedNotesText);
      if (updated) {
        setDetailRecord(updated);
      } else {
        setDetailRecord({ ...detailRecord, notes: editedNotesText });
      }
      await loadData();
      setIsEditingNotes(false);
      showBanner('Description / Notes saved successfully!');
    } catch (err) {
      console.error('Failed to update notes:', err);
      Alert.alert('Error', 'Failed to save description notes.');
    } finally {
      setIsSavingNotes(false);
    }
  };

  // Copy full description to clipboard
  const handleCopyDescription = async (text: string) => {
    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
      await navigator.clipboard.writeText(text);
      setCopiedNotes(true);
      showBanner('Description copied to clipboard!');
      setTimeout(() => setCopiedNotes(false), 2000);
    } else {
      Alert.alert('Job Description & Notes', text);
    }
  };

  // Copy recruiter reply to clipboard
  const handleCopyReply = async (text: string) => {
    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
      await navigator.clipboard.writeText(text);
      setCopiedReply(true);
      showBanner('Recruiter message copied to clipboard!');
      setTimeout(() => setCopiedReply(false), 2000);
    } else {
      Alert.alert('Recruiter Message', text);
    }
  };

  const currentTheme = isDark ? darkTheme : lightTheme;

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: currentTheme.pageBackground }]}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled">

        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerTopRow}>
            <View style={[styles.applePill, { backgroundColor: currentTheme.glassHighlight }]}>
              <Text style={[styles.applePillText, { color: currentTheme.textSecondary }]}>
                RECRUITER CRM & CADENCE
              </Text>
            </View>
            <View style={styles.headerActions}>
              <Pressable
                onPress={handleSyncReplies}
                disabled={isSyncingReplies}
                style={({ pressed }) => [
                  styles.headerActionButton,
                  {
                    backgroundColor: pressed ? currentTheme.glassActive : currentTheme.glassHighlight,
                    borderColor: currentTheme.glassBorder,
                  },
                ]}>
                {isSyncingReplies ? (
                  <ActivityIndicator size="small" color={currentTheme.appleBlue} />
                ) : (
                  <Ionicons name="sync" size={14} color={currentTheme.textPrimary} style={{ marginRight: 4 }} />
                )}
                <Text style={[styles.headerActionText, { color: currentTheme.textPrimary }]}>
                  {isSyncingReplies ? 'Syncing...' : 'Sync Replies'}
                </Text>
              </Pressable>
            </View>
          </View>

          <Text style={[styles.title, { color: currentTheme.textPrimary }]}>
            Follow-Ups
          </Text>
          <Text style={[styles.subtitle, { color: currentTheme.textSecondary }]}>
            Track sent job applications, detect HR responses, and dispatch tailored follow-ups.
          </Text>
        </View>

        {/* Global Feedback Banner */}
        {bannerMessage && (
          <View style={[styles.bannerCard, { backgroundColor: 'rgba(52, 199, 89, 0.15)', borderColor: '#34C759' }]}>
            <Text style={styles.bannerText}>{bannerMessage}</Text>
          </View>
        )}

        {/* Analytics Summary - 2 Column x 2 Row Grid */}
        <View style={styles.metricsGrid}>
          {/* Row 1 */}
          <View style={styles.metricsRow}>
            <View
              style={[
                styles.metricCard,
                { backgroundColor: currentTheme.glassBackground, borderColor: currentTheme.glassBorder },
                metrics.due > 0 && styles.metricCardDue,
              ]}>
              <Text style={[styles.metricNumber, { color: metrics.due > 0 ? '#FF9500' : currentTheme.textPrimary }]}>
                {metrics.due}
              </Text>
              <Text style={[styles.metricLabel, { color: metrics.due > 0 ? '#FF9500' : currentTheme.textSecondary }]}>
                Due (3d+)
              </Text>
            </View>

            <View style={[styles.metricCard, { backgroundColor: currentTheme.glassBackground, borderColor: currentTheme.glassBorder }]}>
              <Text style={[styles.metricNumber, { color: '#34C759' }]}>
                {metrics.replied}
              </Text>
              <Text style={[styles.metricLabel, { color: currentTheme.textSecondary }]}>
                Replies
              </Text>
            </View>
          </View>

          {/* Row 2 */}
          <View style={styles.metricsRow}>
            <View style={[styles.metricCard, { backgroundColor: currentTheme.glassBackground, borderColor: currentTheme.glassBorder }]}>
              <Text style={[styles.metricNumber, { color: '#AF52DE' }]}>
                {metrics.followedUp}
              </Text>
              <Text style={[styles.metricLabel, { color: currentTheme.textSecondary }]}>
                Followed Up
              </Text>
            </View>

            <View style={[styles.metricCard, { backgroundColor: currentTheme.glassBackground, borderColor: currentTheme.glassBorder }]}>
              <Text style={[styles.metricNumber, { color: currentTheme.textPrimary }]}>
                {metrics.total}
              </Text>
              <Text style={[styles.metricLabel, { color: currentTheme.textSecondary }]}>
                Total Sent
              </Text>
            </View>
          </View>
        </View>

        {/* Multi-Selection Active Bar */}
        {isSelectionMode && (
          <View
            style={[
              styles.selectionBar,
              {
                backgroundColor: isDark ? 'rgba(0, 122, 255, 0.15)' : 'rgba(0, 122, 255, 0.08)',
                borderColor: currentTheme.appleBlue,
              },
            ]}>
            <View style={styles.selectionBarLeft}>
              <Pressable onPress={exitSelectionMode} style={styles.selectionCloseBtn}>
                <Ionicons name="close" size={20} color={currentTheme.textPrimary} />
              </Pressable>
              <Text style={[styles.selectionCountText, { color: currentTheme.textPrimary }]}>
                {selectedIds.size} Selected
              </Text>
            </View>

            <View style={styles.selectionBarRight}>
              <Pressable
                onPress={handleToggleSelectAllDue}
                style={[styles.selectAllBtn, { borderColor: currentTheme.appleBlue, backgroundColor: currentTheme.glassHighlight }]}>
                <Text style={[styles.selectAllBtnText, { color: currentTheme.appleBlue }]}>
                  {allDueSelected ? 'Deselect All' : `Select All Due (${dueRecords.length})`}
                </Text>
              </Pressable>
            </View>
          </View>
        )}

        {/* Informational Selection Hint (shown when not in selection mode & due cards exist) */}
        {!isSelectionMode && metrics.due > 0 && (
          <View
            style={[
              styles.selectionHintBanner,
              {
                backgroundColor: isDark ? 'rgba(255, 149, 0, 0.1)' : 'rgba(255, 149, 0, 0.08)',
                borderColor: 'rgba(255, 149, 0, 0.3)',
              },
            ]}>
            <Ionicons name="information-circle-outline" size={16} color="#FF9500" style={{ marginRight: 8 }} />
            <Text style={[styles.selectionHintText, { color: currentTheme.textSecondary }]}>
              Long-press any <Text style={{ color: '#FF9500', fontWeight: '700' }}>Due</Text> card to multi-select and send follow-ups in batch.
            </Text>
          </View>
        )}

        {/* Search Bar */}
        <View
          style={[
            styles.searchContainer,
            { backgroundColor: currentTheme.inputBackground, borderColor: currentTheme.glassBorder },
          ]}>
          <Ionicons name="search" size={16} color={currentTheme.placeholder} style={styles.searchIcon} />
          <TextInput
            style={[styles.searchInput, { color: currentTheme.textPrimary }]}
            placeholder="Search company, recruiter email, or title..."
            placeholderTextColor={currentTheme.placeholder}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {searchQuery.length > 0 && (
            <Pressable onPress={() => setSearchQuery('')} style={styles.clearSearchButton}>
              <Ionicons name="close-circle" size={16} color={currentTheme.textSecondary} />
            </Pressable>
          )}
        </View>

        {/* Filter Pills */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterScroll}
          style={styles.filterWrapper}>
          {[
            { id: 'all', label: `All (${records.length})` },
            { id: 'due', label: `Due (${metrics.due})` },
            { id: 'replied', label: `Replies (${metrics.replied})` },
            { id: 'waiting', label: `Waiting (${metrics.waiting})` },
            { id: 'followed_up', label: `Followed Up (${metrics.followedUp})` },
          ].map((tab) => {
            const isSelected = activeFilter === tab.id;
            return (
              <Pressable
                key={tab.id}
                onPress={() => setActiveFilter(tab.id as any)}
                style={[
                  styles.filterPill,
                  isSelected
                    ? { backgroundColor: currentTheme.appleBlue }
                    : { backgroundColor: currentTheme.glassHighlight, borderColor: currentTheme.glassBorder },
                ]}>
                <Text
                  style={[
                    styles.filterPillText,
                    { color: isSelected ? '#ffffff' : currentTheme.textSecondary },
                  ]}>
                  {tab.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Applications List */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={currentTheme.appleBlue} />
            <Text style={[styles.loadingText, { color: currentTheme.textSecondary }]}>
              Loading recruiter applications...
            </Text>
          </View>
        ) : filteredRecords.length === 0 ? (
          <View
            style={[
              styles.emptyCard,
              { backgroundColor: currentTheme.glassBackground, borderColor: currentTheme.glassBorder },
            ]}>
            <Ionicons name="mail-unread-outline" size={44} color={currentTheme.textTertiary} style={{ marginBottom: 12 }} />
            <Text style={[styles.emptyTitle, { color: currentTheme.textPrimary }]}>
              No Applications in this View
            </Text>
            <Text style={[styles.emptySubtitle, { color: currentTheme.textSecondary }]}>
              {searchQuery
                ? 'Try searching with a different keyword or company domain.'
                : 'All clear! No pending follow-ups match this filter.'}
            </Text>
            <Pressable
              onPress={() => router.push('/')}
              style={[styles.emptyActionButton, { backgroundColor: currentTheme.appleBlue }]}>
              <Text style={styles.emptyActionButtonText}>Send Job Emails</Text>
            </Pressable>
          </View>
        ) : (
          <View>
            <View style={styles.cardsList}>
              {paginatedRecords.map((item) => {
                const daysAgo = getElapsedDays(item.initialSentAt);
                const formattedDate = formatSentDate(item.initialSentAt);
                const isFollowUpDue = item.status === 'needs_followup';
                const isSelected = selectedIds.has(item.id);

                return (
                  <Pressable
                    key={item.id}
                    onPress={() => handleCardPress(item)}
                    onLongPress={() => handleCardLongPress(item)}
                    delayLongPress={300}
                    style={({ pressed }) => [
                      styles.applicationCard,
                      {
                        backgroundColor: isSelected
                          ? isDark
                            ? 'rgba(0, 122, 255, 0.18)'
                            : 'rgba(0, 122, 255, 0.08)'
                          : pressed
                          ? currentTheme.glassActive
                          : currentTheme.glassBackground,
                        borderColor: isSelected
                          ? currentTheme.appleBlue
                          : currentTheme.glassBorder,
                        borderWidth: isSelected ? 2 : 1,
                        opacity: isSelectionMode && !isFollowUpDue ? 0.45 : 1,
                      },
                      item.status === 'needs_followup' && !isSelected && styles.cardDueBorder,
                      item.status === 'replied' && styles.cardRepliedBorder,
                    ]}>
                    {/* Top Row: Checkbox (if in selection mode), Company & Status Badge */}
                    <View style={styles.cardHeaderRow}>
                      {isSelectionMode && isFollowUpDue && (
                        <View style={styles.cardCheckboxWrapper}>
                          <Ionicons
                            name={isSelected ? 'checkbox' : 'square-outline'}
                            size={22}
                            color={isSelected ? currentTheme.appleBlue : currentTheme.textTertiary}
                          />
                        </View>
                      )}
                      <View style={styles.companyInfo}>
                        <Text style={[styles.companyName, { color: currentTheme.textPrimary }]}>
                          {item.companyName}
                        </Text>
                        <Text style={[styles.recipientEmail, { color: currentTheme.textSecondary }]}>
                          {item.email}
                        </Text>
                      </View>

                      {/* Status Badge */}
                      <View style={[styles.statusBadge, getStatusBadgeStyle(item.status)]}>
                        <Text style={[styles.statusBadgeText, getStatusTextStyle(item.status)]}>
                          {getStatusLabel(item.status, daysAgo, item.followUpCount)}
                        </Text>
                      </View>
                    </View>

                    {/* Role Title in white text */}
                    {item.roleTitle ? (
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
                        <Ionicons name="briefcase-outline" size={13} color="#FFFFFF" style={{ marginRight: 6 }} />
                        <Text style={[styles.cardRoleText, { color: '#FFFFFF', marginBottom: 0 }]}>
                          {item.roleTitle}
                        </Text>
                      </View>
                    ) : null}

                    {/* Notes / Description in white text */}
                    {item.notes ? (
                      <View style={[styles.cardDescriptionBubble, { backgroundColor: currentTheme.glassHighlight }]}>
                        <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                          <Ionicons name="document-text-outline" size={13} color="#FFFFFF" style={{ marginRight: 6, marginTop: 2 }} />
                          <Text style={[styles.cardDescriptionText, { color: '#FFFFFF', flex: 1 }]} numberOfLines={2}>
                            {item.notes}
                          </Text>
                        </View>
                      </View>
                    ) : null}

                    {/* Recruiter Reply Bubble with white description text */}
                    {item.replySnippet ? (
                      <View style={styles.replyBubble}>
                        <View style={styles.replyHeader}>
                          <Ionicons name="chatbubble-ellipses" size={14} color="#34C759" style={{ marginRight: 4 }} />
                          <Text style={styles.replyTitle}>HR Response Detected</Text>
                          {item.replyDate && (
                            <Text style={styles.replyDate}>{formatSentDate(item.replyDate)}</Text>
                          )}
                        </View>
                        <Text style={[styles.replySnippet, { color: '#FFFFFF' }]} numberOfLines={3}>
                          &ldquo;{item.replySnippet}&rdquo;
                        </Text>
                      </View>
                    ) : null}

                    {/* Meta Details Row */}
                    <View style={styles.cardMetaRow}>
                      <Text style={[styles.cardMetaText, { color: currentTheme.textTertiary }]}>
                        Initial: {formattedDate} ({daysAgo === 0 ? 'Today' : `${daysAgo}d ago`})
                      </Text>
                      {item.followUpCount > 0 && (
                        <Text style={[styles.cardMetaText, { color: '#AF52DE' }]}>
                          • Followed up {item.followUpCount}x
                        </Text>
                      )}
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                        <Text style={[styles.cardTapToView, { color: currentTheme.appleBlue }]}>
                          Details
                        </Text>
                        <Ionicons name="chevron-forward" size={12} color={currentTheme.appleBlue} />
                      </View>
                    </View>

                    {/* Card Action Buttons */}
                    <View style={styles.cardFooterActions}>
                      <Pressable
                        onPress={(e) => {
                          e?.stopPropagation?.();
                          if (isSelectionMode) {
                            if (isFollowUpDue) {
                              toggleCardSelection(item.id);
                            } else {
                              showBanner('This card does not require a follow-up email.');
                            }
                          } else {
                            openComposer(item);
                          }
                        }}
                        style={({ pressed }) => [
                          styles.followUpButton,
                          {
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 6,
                            backgroundColor:
                              item.status === 'needs_followup'
                                ? currentTheme.appleBlue
                                : pressed
                                ? currentTheme.glassActive
                                : currentTheme.glassHighlight,
                          },
                        ]}>
                        <Ionicons
                          name="paper-plane"
                          size={13}
                          color={item.status === 'needs_followup' ? '#FFFFFF' : currentTheme.appleBlue}
                        />
                        <Text
                          style={[
                            styles.followUpButtonText,
                            {
                              color: item.status === 'needs_followup' ? '#FFFFFF' : currentTheme.appleBlue,
                            },
                          ]}>
                          Follow Up
                        </Text>
                      </Pressable>

                      <Pressable
                        onPress={(e) => {
                          e?.stopPropagation?.();
                          if (isSelectionMode) {
                            if (isFollowUpDue) {
                              toggleCardSelection(item.id);
                            }
                          } else {
                            setStatusMenuRecord(item);
                          }
                        }}
                        style={({ pressed }) => [
                          styles.statusMenuButton,
                          { backgroundColor: pressed ? currentTheme.glassActive : currentTheme.glassHighlight },
                        ]}>
                        <Text style={[styles.statusMenuButtonText, { color: currentTheme.textSecondary }]}>
                          ⋯
                        </Text>
                      </Pressable>
                    </View>
                  </Pressable>
                );
              })}
            </View>

            {/* Pagination Controls (10 items per page) */}
            {totalPages > 1 && (
              <View
                style={[
                  styles.paginationBar,
                  { backgroundColor: currentTheme.glassBackground, borderColor: currentTheme.glassBorder },
                ]}>
                <Pressable
                  disabled={currentPage <= 1}
                  onPress={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  style={({ pressed }) => [
                    styles.paginationNavBtn,
                    currentPage <= 1
                      ? styles.paginationNavBtnDisabled
                      : {
                          backgroundColor: pressed ? currentTheme.glassActive : currentTheme.glassHighlight,
                          borderColor: currentTheme.glassBorder,
                        },
                  ]}>
                  <Text
                    style={[
                      styles.paginationNavBtnText,
                      { color: currentPage <= 1 ? currentTheme.textTertiary : currentTheme.appleBlue },
                    ]}>
                    ← Prev
                  </Text>
                </Pressable>

                <View style={styles.paginationCenterInfo}>
                  <Text style={[styles.paginationPageText, { color: currentTheme.textPrimary }]}>
                    Page {currentPage} of {totalPages}
                  </Text>
                  <Text style={[styles.paginationItemsText, { color: currentTheme.textSecondary }]}>
                    Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1}–
                    {Math.min(currentPage * ITEMS_PER_PAGE, filteredRecords.length)} of {filteredRecords.length}
                  </Text>
                </View>

                <Pressable
                  disabled={currentPage >= totalPages}
                  onPress={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  style={({ pressed }) => [
                    styles.paginationNavBtn,
                    currentPage >= totalPages
                      ? styles.paginationNavBtnDisabled
                      : {
                          backgroundColor: pressed ? currentTheme.glassActive : currentTheme.glassHighlight,
                          borderColor: currentTheme.glassBorder,
                        },
                  ]}>
                  <Text
                    style={[
                      styles.paginationNavBtnText,
                      { color: currentPage >= totalPages ? currentTheme.textTertiary : currentTheme.appleBlue },
                    ]}>
                    Next →
                  </Text>
                </Pressable>
              </View>
            )}
          </View>
        )}

        {/* Bottom padding ensuring clearance for floating bar */}
        <View style={{ height: isSelectionMode && selectedIds.size > 0 ? 140 : 100 }} />
      </ScrollView>

      {/* Floating Bulk Action Bar */}
      {isSelectionMode && selectedIds.size > 0 && (
        <View
          style={[
            styles.floatingActionBar,
            {
              backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF',
              borderColor: isDark ? '#2C2C2E' : '#E5E5EA',
            },
          ]}>
          <View style={styles.floatingActionInfo}>
            <Text style={[styles.floatingActionTitle, { color: currentTheme.textPrimary }]}>
              {selectedIds.size} {selectedIds.size === 1 ? 'Card' : 'Cards'} Selected
            </Text>
            <Text style={[styles.floatingActionSub, { color: currentTheme.textSecondary }]}>
              Ready to send follow-up emails
            </Text>
          </View>

          <View style={styles.floatingActionButtons}>
            <Pressable
              onPress={exitSelectionMode}
              style={[
                styles.floatingCancelBtn,
                { backgroundColor: currentTheme.glassHighlight, borderColor: currentTheme.glassBorder },
              ]}>
              <Text style={[styles.floatingCancelBtnText, { color: currentTheme.textSecondary }]}>
                Cancel
              </Text>
            </Pressable>

            <Pressable
              onPress={() => openBulkComposer()}
              style={({ pressed }) => [
                styles.floatingSendBtn,
                {
                  backgroundColor: pressed ? currentTheme.appleBluePressed : currentTheme.appleBlue,
                },
              ]}>
              <Ionicons name="paper-plane" size={15} color="#FFFFFF" style={{ marginRight: 6 }} />
              <Text style={styles.floatingSendBtnText}>
                Mail ({selectedIds.size})
              </Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* ---------------------------------------------------------------------- */}
      {/* 1. FOLLOW-UP COMPOSER MODAL (APPLE SHEET) */}
      {/* ---------------------------------------------------------------------- */}
      <Modal
        visible={!!composerRecord}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => {
          if (!isDispatching) {
            setComposerRecord(null);
            setComposerBulkActive(false);
          }
        }}>
        <SafeAreaView
          style={[
            styles.modalSafeArea,
            { backgroundColor: currentTheme.pageBackground },
            Platform.OS === 'web' ? ({ height: '100vh', maxHeight: '100vh', display: 'flex' } as any) : null,
          ]}>
          <ScrollView
            style={styles.modalScrollView}
            contentContainerStyle={styles.modalScrollContent}
            showsVerticalScrollIndicator={true}
            keyboardShouldPersistTaps="handled">

            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <Text style={[styles.modalTitle, { color: currentTheme.textPrimary }]}>
                  {composerBulkActive ? 'Compose Bulk Follow-Up' : 'Compose Follow-Up'}
                </Text>
                <Text style={[styles.modalSubtitle, { color: currentTheme.textSecondary }]} numberOfLines={1}>
                  {composerBulkActive
                    ? `To: ${selectedRecords.length} Selected Recipients`
                    : `To: ${composerRecord?.email}`}
                </Text>
              </View>
              <Pressable
                disabled={isDispatching}
                onPress={() => {
                  setComposerRecord(null);
                  setComposerBulkActive(false);
                }}
                style={[styles.modalCloseButton, { backgroundColor: currentTheme.glassHighlight }]}>
                <Ionicons name="close" size={20} color={currentTheme.textPrimary} />
              </Pressable>
            </View>

            {/* Recipient / Batch Info Card */}
            <View
              style={[
                styles.modalCard,
                { backgroundColor: currentTheme.glassBackground, borderColor: currentTheme.glassBorder },
              ]}>
              <Text style={[styles.composerFieldLabel, { color: currentTheme.textSecondary }]}>
                {composerBulkActive ? `SELECTED RECIPIENTS (${selectedRecords.length})` : 'APPLICATION DETAILS'}
              </Text>

              <View style={styles.composerNoticePill}>
                <Text style={styles.composerNoticeText}>
                  {composerBulkActive
                    ? `Sending follow-up emails to ${selectedRecords.length} pending applications with rate protection.`
                    : `Recipient: ${composerRecord?.email} • Applied ${formatSentDate(composerRecord?.initialSentAt)} (${getElapsedDays(composerRecord?.initialSentAt)} days ago) • Attempt #${((composerRecord?.followUpCount || 0) + 1)}`}
                </Text>
              </View>
            </View>

            {/* Progress Display (When sending bulk in composer) */}
            {composerBulkActive && bulkDispatchProgress && (
              <View
                style={[
                  styles.modalCard,
                  {
                    backgroundColor: bulkDispatchProgress.completed
                      ? 'rgba(52, 199, 89, 0.12)'
                      : 'rgba(0, 122, 255, 0.12)',
                    borderColor: bulkDispatchProgress.completed
                      ? 'rgba(52, 199, 89, 0.3)'
                      : 'rgba(0, 122, 255, 0.3)',
                  },
                ]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  {bulkDispatchProgress.completed ? (
                    <Ionicons name="checkmark-circle" size={24} color="#34C759" />
                  ) : (
                    <ActivityIndicator size="small" color={currentTheme.appleBlue} />
                  )}
                  <View style={{ flex: 1 }}>
                    <Text
                      style={[
                        styles.bulkProgressTitle,
                        { color: bulkDispatchProgress.completed ? '#34C759' : currentTheme.textPrimary },
                      ]}>
                      {bulkDispatchProgress.completed
                        ? 'All Follow-Up Emails Dispatched!'
                        : `Dispatching ${bulkDispatchProgress.currentIndex} of ${bulkDispatchProgress.total}...`}
                    </Text>
                    <Text style={[styles.bulkProgressSub, { color: currentTheme.textSecondary }]}>
                      {bulkDispatchProgress.completed
                        ? 'Applications marked as followed up.'
                        : `Currently emailing: ${bulkDispatchProgress.currentCompany}`}
                    </Text>
                  </View>
                </View>
              </View>
            )}

            {/* Template Selector Tabs */}
            <View
              style={[
                styles.modalCard,
                { backgroundColor: currentTheme.glassBackground, borderColor: currentTheme.glassBorder },
              ]}>
              <Text style={[styles.composerFieldLabel, { color: currentTheme.textSecondary }]}>
                SELECT HIGH-CONVERTING TEMPLATE
              </Text>
              <View style={styles.templateTabsGrid}>
                {[
                  { id: 'bump', title: '1. Gentle Bump', sub: 'Day 3–5 Follow-up' },
                  { id: 'value', title: '2. Project Spotlight', sub: 'Day 6–10 Depth' },
                  { id: 'short', title: '3. Quick Status', sub: 'Short Mobile Ping' },
                  { id: 'questionnaire', title: '4. HR Q&A Reply', sub: 'Screening & Details' },
                ].map((tpl) => {
                  const isSelected = selectedTemplate === tpl.id;
                  return (
                    <Pressable
                      key={tpl.id}
                      disabled={isDispatching}
                      onPress={() => handleSelectTemplate(tpl.id as FollowUpTemplateType)}
                      style={[
                        styles.templateTabGridItem,
                        isSelected
                          ? { backgroundColor: currentTheme.appleBlue, borderColor: currentTheme.appleBlue }
                          : { backgroundColor: currentTheme.glassHighlight, borderColor: currentTheme.glassBorder },
                      ]}>
                      <Text
                        style={[
                          styles.templateTabTitle,
                          { color: isSelected ? '#FFFFFF' : currentTheme.textPrimary },
                        ]}>
                        {tpl.title}
                      </Text>
                      <Text
                        style={[
                          styles.templateTabSub,
                          { color: isSelected ? 'rgba(255,255,255,0.85)' : currentTheme.textSecondary },
                        ]}>
                        {tpl.sub}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* Subject Line */}
            <View
              style={[
                styles.modalCard,
                { backgroundColor: currentTheme.glassBackground, borderColor: currentTheme.glassBorder },
              ]}>
              <Text style={[styles.composerFieldLabel, { color: currentTheme.textSecondary }]}>
                SUBJECT LINE
              </Text>
              <TextInput
                style={[
                  styles.composerInput,
                  {
                    color: currentTheme.textPrimary,
                    borderColor: currentTheme.glassBorder,
                    backgroundColor: currentTheme.inputBackground,
                  },
                ]}
                value={editableSubject}
                onChangeText={setEditableSubject}
                editable={!isDispatching}
              />
            </View>

            {/* Message Body */}
            <View
              style={[
                styles.modalCard,
                { backgroundColor: currentTheme.glassBackground, borderColor: currentTheme.glassBorder },
              ]}>
              <View style={styles.bodyHeaderRow}>
                <Text style={[styles.composerFieldLabel, { color: currentTheme.textSecondary }]}>
                  EMAIL BODY (EDITABLE)
                </Text>
                <Pressable onPress={handleCopyText} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Ionicons name="copy-outline" size={13} color={currentTheme.appleBlue} />
                  <Text style={[styles.copyButtonText, { color: currentTheme.appleBlue }]}>
                    Copy Text
                  </Text>
                </Pressable>
              </View>
              <TextInput
                style={[
                  styles.composerBodyInput,
                  {
                    color: currentTheme.textPrimary,
                    borderColor: currentTheme.glassBorder,
                    backgroundColor: currentTheme.inputBackground,
                  },
                ]}
                multiline
                numberOfLines={10}
                value={editableBody}
                onChangeText={setEditableBody}
                textAlignVertical="top"
                editable={!isDispatching}
              />
            </View>

            {/* Primary Action Button: Dispatch via Webhook */}
            <Pressable
              disabled={isDispatching}
              onPress={handleSendFollowUp}
              style={({ pressed }) => [
                styles.primarySendButton,
                {
                  backgroundColor: pressed ? currentTheme.appleBluePressed : currentTheme.appleBlue,
                },
              ]}>
              {isDispatching ? (
                <View style={styles.sendingRow}>
                  <ActivityIndicator color="#ffffff" size="small" />
                  <Text style={styles.primarySendButtonText}>
                    {composerBulkActive && bulkDispatchProgress
                      ? `Dispatching ${bulkDispatchProgress.currentIndex} of ${bulkDispatchProgress.total}...`
                      : 'Dispatching with Resume PDF...'}
                  </Text>
                </View>
              ) : (
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                  <Ionicons name="paper-plane" size={15} color="#FFFFFF" />
                  <Text style={styles.primarySendButtonText}>
                    {composerBulkActive
                      ? `Send Follow-Ups (${selectedRecords.length} via Gmail)`
                      : 'Send Follow-Up (1-Tap via Gmail)'}
                  </Text>
                </View>
              )}
            </Pressable>

            {/* Secondary Action: Open in Native Mail Client */}
            <Pressable
              disabled={isDispatching}
              onPress={handleOpenInMailClient}
              style={({ pressed }) => [
                styles.secondaryMailButton,
                {
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  backgroundColor: pressed ? currentTheme.glassActive : currentTheme.glassHighlight,
                  borderColor: currentTheme.glassBorder,
                },
              ]}>
              <Ionicons name="mail-outline" size={16} color={currentTheme.textPrimary} />
              <Text style={[styles.secondaryMailButtonText, { color: currentTheme.textPrimary }]}>
                {composerBulkActive ? 'Open in Mail App (BCC Batch)' : 'Open in Gmail / Mail App'}
              </Text>
            </Pressable>

            <View style={{ height: 40 }} />
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* ---------------------------------------------------------------------- */}
      {/* 2. STATUS DROPDOWN MENU MODAL */}
      {/* ---------------------------------------------------------------------- */}
      <Modal
        visible={!!statusMenuRecord}
        transparent
        animationType="fade"
        onRequestClose={() => setStatusMenuRecord(null)}>
        <Pressable style={styles.modalOverlay} onPress={() => setStatusMenuRecord(null)}>
          <View
            style={[
              styles.statusMenuSheet,
              { backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF', borderColor: currentTheme.glassBorder },
            ]}>
            <Text style={[styles.statusMenuTitle, { color: currentTheme.textPrimary }]}>
              Update Status for {statusMenuRecord?.companyName}
            </Text>
            <Text style={[styles.statusMenuSubtitle, { color: currentTheme.textSecondary }]}>
              {statusMenuRecord?.email}
            </Text>

            <View style={styles.statusOptionsList}>
              <Pressable
                onPress={() => handleSetStatus('replied')}
                style={[styles.statusOptionItem, { borderBottomColor: currentTheme.glassBorder }]}>
                <Ionicons name="chatbubble-ellipses-outline" size={22} color="#34C759" style={{ width: 28, textAlign: 'center' }} />
                <View>
                  <Text style={[styles.statusOptionTitle, { color: '#34C759' }]}>Mark as Replied</Text>
                  <Text style={[styles.statusOptionSub, { color: currentTheme.textSecondary }]}>
                    Recruiter responded with feedback or inquiry
                  </Text>
                </View>
              </Pressable>

              <Pressable
                onPress={() => handleSetStatus('interview')}
                style={[styles.statusOptionItem, { borderBottomColor: currentTheme.glassBorder }]}>
                <Ionicons name="checkmark-done-circle-outline" size={22} color="#30B0C7" style={{ width: 28, textAlign: 'center' }} />
                <View>
                  <Text style={[styles.statusOptionTitle, { color: '#30B0C7' }]}>Interview Scheduled</Text>
                  <Text style={[styles.statusOptionSub, { color: currentTheme.textSecondary }]}>
                    Invited for technical interview or screening
                  </Text>
                </View>
              </Pressable>

              <Pressable
                onPress={() => handleSetStatus('needs_followup')}
                style={[styles.statusOptionItem, { borderBottomColor: currentTheme.glassBorder }]}>
                <Ionicons name="alert-circle-outline" size={22} color="#FF9500" style={{ width: 28, textAlign: 'center' }} />
                <View>
                  <Text style={[styles.statusOptionTitle, { color: '#FF9500' }]}>Mark Follow-Up Due</Text>
                  <Text style={[styles.statusOptionSub, { color: currentTheme.textSecondary }]}>
                    Flag for immediate follow-up outreach
                  </Text>
                </View>
              </Pressable>

              <Pressable
                onPress={() => handleSetStatus('closed')}
                style={[styles.statusOptionItem, { borderBottomColor: currentTheme.glassBorder }]}>
                <Ionicons name="archive-outline" size={22} color={currentTheme.textSecondary} style={{ width: 28, textAlign: 'center' }} />
                <View>
                  <Text style={[styles.statusOptionTitle, { color: currentTheme.textSecondary }]}>
                    Close / Archive
                  </Text>
                  <Text style={[styles.statusOptionSub, { color: currentTheme.textSecondary }]}>
                    Position closed or not moving forward
                  </Text>
                </View>
              </Pressable>
            </View>

            <Pressable
              onPress={() => setStatusMenuRecord(null)}
              style={[styles.cancelMenuButton, { backgroundColor: currentTheme.glassHighlight }]}>
              <Text style={[styles.cancelMenuButtonText, { color: currentTheme.textPrimary }]}>
                Cancel
              </Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>


      {/* ---------------------------------------------------------------------- */}
      {/* 4. APPLICATION DETAIL BOTTOM SHEET MODAL */}
      {/* ---------------------------------------------------------------------- */}
      <Modal
        visible={!!detailRecord}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => {
          setIsEditingNotes(false);
          setDetailRecord(null);
        }}>
        <SafeAreaView
          style={[
            styles.modalSafeArea,
            { backgroundColor: currentTheme.pageBackground },
            Platform.OS === 'web' ? ({ height: '100vh', maxHeight: '100vh', display: 'flex' } as any) : null,
          ]}>
          <ScrollView
            style={styles.detailModalScrollView}
            contentContainerStyle={styles.detailModalScrollContent}
            showsVerticalScrollIndicator={true}
            bounces={true}
            alwaysBounceVertical={true}
            keyboardShouldPersistTaps="handled">

            {/* Drag Handle Indicator */}
            <View style={styles.sheetHandleContainer}>
              <View style={[styles.sheetHandleBar, { backgroundColor: currentTheme.glassBorder }]} />
            </View>

            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <View style={{ flex: 1, marginRight: 12 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                  <Text style={[styles.detailSheetCompany, { color: currentTheme.textPrimary }]}>
                    {detailRecord?.companyName}
                  </Text>
                  {detailRecord && (
                    <View style={[styles.statusBadge, getStatusBadgeStyle(detailRecord.status)]}>
                      <Text style={[styles.statusBadgeText, getStatusTextStyle(detailRecord.status)]}>
                        {getStatusLabel(
                          detailRecord.status,
                          getElapsedDays(detailRecord.initialSentAt),
                          detailRecord.followUpCount
                        )}
                      </Text>
                    </View>
                  )}
                </View>
                <Text style={[styles.detailSheetEmail, { color: currentTheme.appleBlue }]}>
                  {detailRecord?.email}
                </Text>
              </View>
              <Pressable
                onPress={() => {
                  setIsEditingNotes(false);
                  setDetailRecord(null);
                }}
                style={[styles.modalCloseButton, { backgroundColor: currentTheme.glassHighlight }]}>
                <Ionicons name="close" size={20} color={currentTheme.textPrimary} />
              </Pressable>
            </View>

            {/* Role Title Card */}
            <View
              style={[
                styles.modalCard,
                { backgroundColor: currentTheme.glassBackground, borderColor: currentTheme.glassBorder },
              ]}>
              <Text style={[styles.composerFieldLabel, { color: currentTheme.textSecondary }]}>
                TARGET ROLE & POSITION
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
                <Ionicons name="briefcase-outline" size={15} color="#FFFFFF" />
                <Text style={[styles.detailSheetRoleTitle, { color: '#FFFFFF', flex: 1 }]}>
                  {detailRecord?.roleTitle || 'Full Stack Developer'}
                </Text>
              </View>
            </View>

            {/* Recruiter Reply Card (if available) */}
            {detailRecord?.replySnippet ? (
              <View
                style={[
                  styles.modalCard,
                  {
                    backgroundColor: 'rgba(52, 199, 89, 0.12)',
                    borderColor: 'rgba(52, 199, 89, 0.4)',
                  },
                ]}>
                <View style={styles.replyHeader}>
                  <Ionicons name="chatbubble-ellipses" size={15} color="#34C759" style={{ marginRight: 4 }} />
                  <Text style={styles.replyTitle}>INCOMING HR / RECRUITER RESPONSE</Text>
                  {detailRecord.replyDate && (
                    <Text style={styles.replyDate}>{formatSentDate(detailRecord.replyDate)}</Text>
                  )}
                  <Pressable
                    onPress={() => handleCopyReply(detailRecord.replySnippet || '')}
                    style={[styles.smallActionBtn, { backgroundColor: currentTheme.glassHighlight, flexDirection: 'row', alignItems: 'center', gap: 4 }]}>
                    <Ionicons
                      name={copiedReply ? 'checkmark' : 'copy-outline'}
                      size={12}
                      color={currentTheme.appleBlue}
                    />
                    <Text style={[styles.smallActionBtnText, { color: currentTheme.appleBlue }]}>
                      {copiedReply ? 'Copied' : 'Copy'}
                    </Text>
                  </Pressable>
                </View>
                <View style={styles.descriptionContentBox}>
                  <Text selectable style={[styles.detailSheetFullText, { color: '#FFFFFF' }]}>
                    &ldquo;{detailRecord.replySnippet}&rdquo;
                  </Text>
                </View>
              </View>
            ) : null}

            {/* Job Description & Screening Notes */}
            <View
              style={[
                styles.modalCard,
                { backgroundColor: currentTheme.glassBackground, borderColor: currentTheme.glassBorder },
              ]}>
              <View style={styles.descriptionCardHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
                  <Ionicons name="document-text-outline" size={14} color={currentTheme.textSecondary} />
                  <Text style={[styles.composerFieldLabel, { color: currentTheme.textSecondary, marginBottom: 0 }]}>
                    RECRUITER NOTES & JOB DESCRIPTION
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  {detailRecord?.notes ? (
                    <Pressable
                      onPress={() => handleCopyDescription(detailRecord.notes || '')}
                      style={[styles.smallActionBtn, { backgroundColor: currentTheme.glassHighlight, flexDirection: 'row', alignItems: 'center', gap: 4 }]}>
                      <Ionicons
                        name={copiedNotes ? 'checkmark' : 'copy-outline'}
                        size={12}
                        color={currentTheme.appleBlue}
                      />
                      <Text style={[styles.smallActionBtnText, { color: currentTheme.appleBlue }]}>
                        {copiedNotes ? 'Copied' : 'Copy'}
                      </Text>
                    </Pressable>
                  ) : null}
                  <Pressable
                    onPress={() => {
                      setIsEditingNotes((prev) => !prev);
                      setEditedNotesText(detailRecord?.notes || '');
                    }}
                    style={[styles.smallActionBtn, { backgroundColor: currentTheme.glassHighlight, flexDirection: 'row', alignItems: 'center', gap: 4 }]}>
                    <Ionicons
                      name={isEditingNotes ? 'close' : 'pencil'}
                      size={12}
                      color={currentTheme.appleBlue}
                    />
                    <Text style={[styles.smallActionBtnText, { color: currentTheme.appleBlue }]}>
                      {isEditingNotes ? 'Cancel' : 'Edit'}
                    </Text>
                  </Pressable>
                </View>
              </View>

              {isEditingNotes ? (
                <View style={{ marginTop: 10 }}>
                  <TextInput
                    style={[
                      styles.detailNotesTextInput,
                      {
                        color: '#FFFFFF',
                        backgroundColor: currentTheme.inputBackground,
                        borderColor: currentTheme.glassBorder,
                      },
                    ]}
                    multiline
                    numberOfLines={10}
                    value={editedNotesText}
                    onChangeText={setEditedNotesText}
                    placeholder="Paste full job description, screening questions & answers, salary or recruiter info..."
                    placeholderTextColor={currentTheme.placeholder}
                    textAlignVertical="top"
                  />
                  <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
                    <Pressable
                      disabled={isSavingNotes}
                      onPress={handleSaveEditedNotes}
                      style={({ pressed }) => [
                        styles.inlineSaveBtn,
                        { backgroundColor: pressed ? currentTheme.appleBluePressed : currentTheme.appleBlue },
                      ]}>
                      {isSavingNotes ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Ionicons name="save-outline" size={14} color="#FFFFFF" />
                          <Text style={styles.inlineSaveBtnText}>Save Description</Text>
                        </View>
                      )}
                    </Pressable>
                    <Pressable
                      onPress={() => setIsEditingNotes(false)}
                      style={[
                        styles.inlineCancelBtn,
                        { backgroundColor: currentTheme.glassHighlight, borderColor: currentTheme.glassBorder },
                      ]}>
                      <Text style={[styles.inlineCancelBtnText, { color: currentTheme.textSecondary }]}>
                        Cancel
                      </Text>
                    </Pressable>
                  </View>
                </View>
              ) : detailRecord?.notes ? (
                <View style={styles.descriptionContentBox}>
                  <Text selectable style={[styles.detailSheetFullText, { color: '#FFFFFF' }]}>
                    {detailRecord.notes}
                  </Text>
                </View>
              ) : (
                <View style={{ paddingVertical: 10 }}>
                  <Text style={{ fontSize: 13, color: currentTheme.textTertiary, fontStyle: 'italic', marginBottom: 8 }}>
                    No job description or recruiter notes saved yet for this company.
                  </Text>
                  <Pressable
                    onPress={() => {
                      setIsEditingNotes(true);
                      setEditedNotesText('');
                    }}
                    style={[styles.smallActionBtn, { backgroundColor: currentTheme.glassHighlight, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 4 }]}>
                    <Ionicons name="add" size={14} color={currentTheme.appleBlue} />
                    <Text style={[styles.smallActionBtnText, { color: currentTheme.appleBlue }]}>
                      Add Description / JD Notes
                    </Text>
                  </Pressable>
                </View>
              )}
            </View>

            {/* Application Cadence & Timing Metrics */}
            <View
              style={[
                styles.modalCard,
                { backgroundColor: currentTheme.glassBackground, borderColor: currentTheme.glassBorder },
              ]}>
              <Text style={[styles.composerFieldLabel, { color: currentTheme.textSecondary }]}>
                APPLICATION TIMELINE & ACTIVITY
              </Text>

              <View style={styles.timelineRow}>
                <Text style={[styles.timelineLabel, { color: currentTheme.textSecondary }]}>Initial Application:</Text>
                <Text style={[styles.timelineValue, { color: currentTheme.textPrimary }]}>
                  {formatSentDate(detailRecord?.initialSentAt)} ({getElapsedDays(detailRecord?.initialSentAt)} days ago)
                </Text>
              </View>

              <View style={styles.timelineRow}>
                <Text style={[styles.timelineLabel, { color: currentTheme.textSecondary }]}>Follow-Up Cadence:</Text>
                <Text style={[styles.timelineValue, { color: detailRecord?.followUpCount ? '#AF52DE' : currentTheme.textPrimary }]}>
                  {detailRecord?.followUpCount ? `${detailRecord.followUpCount} outreach sent` : 'None yet (Awaiting)'}
                </Text>
              </View>

              {detailRecord?.lastFollowUpAt ? (
                <View style={styles.timelineRow}>
                  <Text style={[styles.timelineLabel, { color: currentTheme.textSecondary }]}>Last Follow-Up:</Text>
                  <Text style={[styles.timelineValue, { color: currentTheme.textPrimary }]}>
                    {formatSentDate(detailRecord.lastFollowUpAt)} ({getElapsedDays(detailRecord.lastFollowUpAt)} days ago)
                  </Text>
                </View>
              ) : null}
            </View>

            {/* Follow-Up History (if any) */}
            {detailRecord?.history && detailRecord.history.length > 0 ? (
              <View
                style={[
                  styles.modalCard,
                  { backgroundColor: currentTheme.glassBackground, borderColor: currentTheme.glassBorder },
                ]}>
                <Text style={[styles.composerFieldLabel, { color: currentTheme.textSecondary }]}>
                  FOLLOW-UP OUTREACH HISTORY
                </Text>
                {detailRecord.history.map((hist, index) => (
                  <View key={index} style={styles.historyLogItem}>
                    <Text style={[styles.historyLogSubject, { color: currentTheme.textPrimary }]}>
                      • {hist.subject}
                    </Text>
                    <Text style={[styles.historyLogMeta, { color: currentTheme.textSecondary }]}>
                      {formatSentDate(hist.sentAt)} • Template: {hist.templateType}
                    </Text>
                  </View>
                ))}
              </View>
            ) : null}

            {/* Quick Action Dock */}
            <Pressable
              onPress={() => {
                const target = detailRecord;
                setDetailRecord(null);
                if (target) {
                  openComposer(target);
                }
              }}
              style={({ pressed }) => [
                styles.primarySendButton,
                {
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  backgroundColor: pressed ? currentTheme.appleBluePressed : currentTheme.appleBlue,
                  marginBottom: 10,
                },
              ]}>
              <Ionicons name="paper-plane" size={15} color="#FFFFFF" />
              <Text style={styles.primarySendButtonText}>
                Compose Follow-Up / Reply
              </Text>
            </Pressable>

            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 12 }}>
              <Pressable
                onPress={() => {
                  const target = detailRecord;
                  setDetailRecord(null);
                  if (target) {
                    setStatusMenuRecord(target);
                  }
                }}
                style={({ pressed }) => [
                  styles.secondaryMailButton,
                  {
                    flex: 1,
                    backgroundColor: pressed ? currentTheme.glassActive : currentTheme.glassHighlight,
                    borderColor: currentTheme.glassBorder,
                  },
                ]}>
                <Text style={[styles.secondaryMailButtonText, { color: currentTheme.textPrimary }]}>
                  ⋯ Status
                </Text>
              </Pressable>

              <Pressable
                onPress={async () => {
                  if (!detailRecord) return;
                  const mailto = `mailto:${detailRecord.email}`;
                  if (await Linking.canOpenURL(mailto)) {
                    await Linking.openURL(mailto);
                  }
                }}
                style={({ pressed }) => [
                  styles.secondaryMailButton,
                  {
                    flex: 1,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    backgroundColor: pressed ? currentTheme.glassActive : currentTheme.glassHighlight,
                    borderColor: currentTheme.glassBorder,
                  },
                ]}>
                <Ionicons name="mail-outline" size={15} color={currentTheme.textPrimary} />
                <Text style={[styles.secondaryMailButtonText, { color: currentTheme.textPrimary }]}>
                  Mail App
                </Text>
              </Pressable>
            </View>

            <Pressable
              onPress={() => {
                setIsEditingNotes(false);
                setDetailRecord(null);
              }}
              style={({ pressed }) => [
                styles.secondaryMailButton,
                {
                  backgroundColor: pressed ? currentTheme.glassActive : currentTheme.glassHighlight,
                  borderColor: currentTheme.glassBorder,
                },
              ]}>
              <Text style={[styles.secondaryMailButtonText, { color: currentTheme.textSecondary }]}>
                Close
              </Text>
            </Pressable>

            <View style={{ height: 60 }} />
          </ScrollView>
        </SafeAreaView>
      </Modal>


    </SafeAreaView>
  );
}

// ----------------------------------------------------------------------------
// Helpers for Status Styles & Badges
// ----------------------------------------------------------------------------
function getStatusLabel(status: FollowUpStatus, daysAgo: number, followUpCount: number): string {
  switch (status) {
    case 'needs_followup':
      return followUpCount > 0 ? `Follow-up #${followUpCount + 1} Due` : `Follow-up Due (${daysAgo}d)`;
    case 'replied':
      return 'HR Replied';
    case 'interview':
      return 'Interview';
    case 'followed_up':
      return followUpCount > 0 ? `Followed Up (${followUpCount}x)` : 'Followed Up';
    case 'waiting':
      return `Waiting (${daysAgo}d)`;
    case 'closed':
      return 'Closed / Archived';
    default:
      return 'Sent';
  }
}

function getStatusBadgeStyle(status: FollowUpStatus) {
  switch (status) {
    case 'needs_followup':
      return { backgroundColor: 'rgba(255, 149, 0, 0.15)', borderColor: 'rgba(255, 149, 0, 0.4)' };
    case 'replied':
      return { backgroundColor: 'rgba(52, 199, 89, 0.15)', borderColor: 'rgba(52, 199, 89, 0.4)' };
    case 'interview':
      return { backgroundColor: 'rgba(48, 176, 199, 0.15)', borderColor: 'rgba(48, 176, 199, 0.4)' };
    case 'followed_up':
      return { backgroundColor: 'rgba(175, 82, 222, 0.15)', borderColor: 'rgba(175, 82, 222, 0.4)' };
    default:
      return { backgroundColor: 'rgba(142, 142, 147, 0.15)', borderColor: 'rgba(142, 142, 147, 0.3)' };
  }
}

function getStatusTextStyle(status: FollowUpStatus) {
  switch (status) {
    case 'needs_followup':
      return { color: '#FF9500' };
    case 'replied':
      return { color: '#34C759' };
    case 'interview':
      return { color: '#30B0C7' };
    case 'followed_up':
      return { color: '#AF52DE' };
    default:
      return { color: '#8E8E93' };
  }
}

// ----------------------------------------------------------------------------
// Theme Tokens
// ----------------------------------------------------------------------------
const darkTheme = {
  pageBackground: '#000000',
  glassBackground: 'rgba(28, 28, 30, 0.75)',
  glassHighlight: 'rgba(255, 255, 255, 0.08)',
  glassActive: 'rgba(255, 255, 255, 0.16)',
  glassBorder: 'rgba(255, 255, 255, 0.12)',
  inputBackground: 'rgba(0, 0, 0, 0.45)',
  textPrimary: '#FFFFFF',
  textSecondary: '#8E8E93',
  textTertiary: '#636366',
  placeholder: '#48484A',
  appleBlue: '#007AFF',
  appleBluePressed: '#005ec4',
};

const lightTheme = {
  pageBackground: '#F2F2F7',
  glassBackground: 'rgba(255, 255, 255, 0.90)',
  glassHighlight: 'rgba(0, 0, 0, 0.04)',
  glassActive: 'rgba(0, 0, 0, 0.08)',
  glassBorder: 'rgba(0, 0, 0, 0.08)',
  inputBackground: 'rgba(255, 255, 255, 0.95)',
  textPrimary: '#000000',
  textSecondary: '#6C6C70',
  textTertiary: '#8E8E93',
  placeholder: '#AEAEB2',
  appleBlue: '#007AFF',
  appleBluePressed: '#005ec4',
};

// ----------------------------------------------------------------------------
// Styles
// ----------------------------------------------------------------------------
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    maxWidth: 720,
    width: '100%',
    alignSelf: 'center',
  },
  header: {
    marginBottom: 16,
  },
  headerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  applePill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  applePillText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  headerActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
  },
  headerActionIcon: {
    fontSize: 13,
  },
  headerActionText: {
    fontSize: 12,
    fontWeight: '600',
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 19,
  },
  bannerCard: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 16,
  },
  bannerText: {
    color: '#34C759',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  metricsGrid: {
    gap: 10,
    marginBottom: 16,
  },
  metricsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  metricCard: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 10,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricCardDue: {
    borderColor: 'rgba(255, 149, 0, 0.4)',
    backgroundColor: 'rgba(255, 149, 0, 0.08)',
  },
  metricNumber: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 2,
  },
  metricLabel: {
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    height: 44,
    marginBottom: 12,
  },
  searchIcon: {
    fontSize: 14,
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    height: '100%',
  },
  clearSearchButton: {
    padding: 6,
  },
  filterWrapper: {
    marginBottom: 16,
  },
  filterScroll: {
    gap: 8,
  },
  filterPill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 14,
    borderWidth: 1,
  },
  filterPillText: {
    fontSize: 13,
    fontWeight: '600',
  },
  loadingContainer: {
    paddingVertical: 40,
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
  },
  emptyCard: {
    padding: 32,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 20,
  },
  emptyEmoji: {
    fontSize: 40,
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '600',
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 16,
    maxWidth: 280,
  },
  emptyActionButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
  },
  emptyActionButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  cardsList: {
    gap: 12,
  },
  applicationCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  cardDueBorder: {
    borderColor: 'rgba(255, 149, 0, 0.4)',
  },
  cardRepliedBorder: {
    borderColor: 'rgba(52, 199, 89, 0.4)',
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  companyInfo: {
    flex: 1,
    marginRight: 10,
  },
  companyName: {
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 2,
  },
  recipientEmail: {
    fontSize: 13,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  replyBubble: {
    backgroundColor: 'rgba(52, 199, 89, 0.08)',
    borderLeftWidth: 3,
    borderLeftColor: '#34C759',
    borderRadius: 8,
    padding: 10,
    marginVertical: 8,
  },
  replyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  replyIcon: {
    fontSize: 14,
  },
  replyTitle: {
    color: '#34C759',
    fontSize: 12,
    fontWeight: '700',
    flex: 1,
  },
  replyDate: {
    color: '#8E8E93',
    fontSize: 11,
  },
  cardRoleText: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
  },
  cardDescriptionBubble: {
    borderRadius: 10,
    padding: 10,
    marginVertical: 6,
  },
  cardDescriptionText: {
    fontSize: 13,
    lineHeight: 18,
  },
  replySnippet: {
    fontSize: 13,
    color: '#FFFFFF',
    fontStyle: 'italic',
    lineHeight: 19,
  },
  cardMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
  },
  cardMetaText: {
    fontSize: 12,
    fontWeight: '500',
  },
  cardTapToView: {
    fontSize: 12,
    fontWeight: '700',
    marginLeft: 'auto',
  },
  sheetHandleContainer: {
    alignItems: 'center',
    marginBottom: 12,
    marginTop: -4,
  },
  sheetHandleBar: {
    width: 44,
    height: 5,
    borderRadius: 3,
  },
  detailSheetCompany: {
    fontSize: 22,
    fontWeight: '700',
  },
  detailSheetEmail: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  detailSheetRoleTitle: {
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 22,
  },
  detailSheetFullText: {
    fontSize: 14,
    lineHeight: 22,
    color: '#FFFFFF',
    ...(Platform.OS === 'web'
      ? ({
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        } as any)
      : {}),
  },
  descriptionCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  smallActionBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  smallActionBtnText: {
    fontSize: 12,
    fontWeight: '600',
  },
  descriptionContentBox: {
    paddingVertical: 4,
  },
  detailNotesTextInput: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    lineHeight: 22,
    minHeight: 140,
  },
  inlineSaveBtn: {
    flex: 1,
    height: 42,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inlineSaveBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  inlineCancelBtn: {
    height: 42,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inlineCancelBtnText: {
    fontSize: 14,
    fontWeight: '600',
  },
  timelineRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  timelineLabel: {
    fontSize: 13,
  },
  timelineValue: {
    fontSize: 13,
    fontWeight: '600',
  },
  historyLogItem: {
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  historyLogSubject: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 2,
  },
  historyLogMeta: {
    fontSize: 12,
  },
  cardFooterActions: {
    flexDirection: 'row',
    gap: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
    paddingTop: 12,
  },
  followUpButton: {
    flex: 1,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  followUpButtonText: {
    fontSize: 14,
    fontWeight: '700',
  },
  statusMenuButton: {
    width: 44,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusMenuButtonText: {
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 18,
  },
  paginationBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 16,
  },
  paginationNavBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  paginationNavBtnDisabled: {
    opacity: 0.35,
    borderColor: 'transparent',
    backgroundColor: 'transparent',
  },
  paginationNavBtnText: {
    fontSize: 13,
    fontWeight: '600',
  },
  paginationCenterInfo: {
    alignItems: 'center',
  },
  paginationPageText: {
    fontSize: 13,
    fontWeight: '700',
  },
  paginationItemsText: {
    fontSize: 11,
    marginTop: 2,
  },
  // Modal styles
  modalSafeArea: {
    flex: 1,
    height: '100%',
    width: '100%',
  },
  modalScrollView: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  modalScrollContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 100,
    maxWidth: 720,
    width: '100%',
    alignSelf: 'center',
  },
  detailModalScrollView: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  detailModalScrollContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 120,
    maxWidth: 720,
    width: '100%',
    alignSelf: 'center',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '700',
  },
  modalSubtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  modalCloseButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCloseText: {
    fontSize: 15,
    fontWeight: '600',
  },
  modalCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    marginBottom: 14,
  },
  composerFieldLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    marginBottom: 8,
  },
  composerInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
  },
  composerNoticePill: {
    marginTop: 8,
  },
  composerNoticeText: {
    fontSize: 12,
    color: '#8E8E93',
  },
  templateTabsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  templateTabGridItem: {
    width: '48.5%',
    flexGrow: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  templateTabTitle: {
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 2,
  },
  templateTabSub: {
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'center',
  },
  statusSelectRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  statusSelectPill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  statusSelectText: {
    fontSize: 12,
    fontWeight: '600',
  },
  bodyHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  copyButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
  composerBodyInput: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    lineHeight: 20,
    minHeight: 180,
  },
  primarySendButton: {
    height: 50,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  primarySendButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  sendingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  secondaryMailButton: {
    height: 46,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryMailButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  // Status Menu Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'flex-end',
  },
  statusMenuSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    padding: 20,
    maxWidth: 600,
    width: '100%',
    alignSelf: 'center',
  },
  statusMenuTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 2,
  },
  statusMenuSubtitle: {
    fontSize: 13,
    marginBottom: 16,
  },
  statusOptionsList: {
    marginBottom: 16,
  },
  statusOptionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  statusOptionEmoji: {
    fontSize: 22,
  },
  statusOptionTitle: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 2,
  },
  statusOptionSub: {
    fontSize: 12,
  },
  cancelMenuButton: {
    height: 46,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelMenuButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
  // Multi-Selection Bar
  selectionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1.5,
    marginBottom: 12,
  },
  selectionBarLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  selectionCloseBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectionCountText: {
    fontSize: 15,
    fontWeight: '700',
  },
  selectionBarRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  selectAllBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
  },
  selectAllBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  selectionHintBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  selectionHintText: {
    fontSize: 12,
    flex: 1,
    lineHeight: 16,
  },
  cardCheckboxWrapper: {
    marginRight: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  floatingActionBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopWidth: 1,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 24 : 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    zIndex: 999,
  },
  floatingActionInfo: {
    flex: 1,
    marginRight: 12,
  },
  floatingActionTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  floatingActionSub: {
    fontSize: 12,
    marginTop: 2,
  },
  floatingActionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  floatingCancelBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  floatingCancelBtnText: {
    fontSize: 13,
    fontWeight: '600',
  },
  floatingSendBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
  },
  floatingSendBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  bulkRecipientsList: {
    marginTop: 4,
  },
  bulkRecipientItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  bulkRecipientCompany: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  bulkRecipientEmail: {
    fontSize: 12,
  },
  bulkProgressTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  bulkProgressSub: {
    fontSize: 12,
    marginTop: 2,
  },
});
