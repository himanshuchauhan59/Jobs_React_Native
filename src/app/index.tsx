import React, { useState, useMemo, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  useColorScheme,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { useConfig } from '@/context/ConfigContext';
import {
  CANDIDATE,
  parseEmailList,
  sendEmailBatch,
  EmailDispatchItem,
  DispatchProgress,
} from '@/services/emailService';
import { addSentBatch } from '@/services/followUpStorage';

export default function JobEmailSenderScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme !== 'light';
  const { config } = useConfig();

  // Form State
  const [rawEmails, setRawEmails] = useState<string>('');
  const [customDelay, setCustomDelay] = useState<string | null>(null);
  const delayThreshold = customDelay ?? String(config.delaySeconds || 3);
  const setDelayThreshold = (val: string) => setCustomDelay(val);

  // Dispatch State
  const [isSending, setIsSending] = useState<boolean>(false);
  const [dispatchProgress, setDispatchProgress] = useState<DispatchProgress | null>(null);
  const [sentHistory, setSentHistory] = useState<EmailDispatchItem[]>([]);
  const abortRef = useRef<boolean>(false);

  // Parsed valid emails
  const validEmails = useMemo(() => parseEmailList(rawEmails), [rawEmails]);
  const parsedDelay = useMemo(() => {
    const val = parseInt(delayThreshold, 10);
    return isNaN(val) || val < 1 ? 3 : val;
  }, [delayThreshold]);

  // Handle Send action
  const handleStartSending = async () => {
    if (validEmails.length === 0 || isSending) return;

    abortRef.current = false;
    setIsSending(true);

    const result = await sendEmailBatch({
      emails: validEmails,
      delaySeconds: parsedDelay,
      webhookUrl: config.webhookUrl.trim() || undefined,
      roleTitle: config.roleTitle,
      noticePeriod: config.noticePeriod,
      shouldAbort: () => abortRef.current,
      onProgress: (progress) => {
        setDispatchProgress(progress);
      },
    });

    const successEmails = result.filter((r) => r.status === 'success').map((r) => r.email);
    if (successEmails.length > 0) {
      addSentBatch(successEmails, { roleTitle: config.roleTitle }).catch((err) =>
        console.warn('Failed to track dispatched emails in follow-up storage', err)
      );
    }

    setSentHistory((prev) => [...result, ...prev]);
    setIsSending(false);
  };

  const handleAbort = () => {
    abortRef.current = true;
    setIsSending(false);
  };

  const handleInsertSample = () => {
    setRawEmails('hr@deepcoder.io, careers@techinnovate.com, hiring@cloudapex.io');
  };

  const handleClear = () => {
    setRawEmails('');
    setDispatchProgress(null);
  };

  const currentTheme = isDark ? darkTheme : lightTheme;

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: currentTheme.pageBackground }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardContainer}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled">

          {/* Apple Header */}
          <View style={styles.header}>
            <View style={styles.headerTopRow}>
              <View style={[styles.applePill, { backgroundColor: currentTheme.glassHighlight }]}>
                <Text style={[styles.applePillText, { color: currentTheme.textSecondary }]}>
                  JOB DISPATCH PRO
                </Text>
              </View>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <Pressable
                  onPress={() => router.push('/followups')}
                  style={({ pressed }) => [
                    styles.configButton,
                    {
                      backgroundColor: pressed ? currentTheme.glassActive : currentTheme.glassHighlight,
                      borderColor: currentTheme.glassBorder,
                    },
                  ]}>
                  <Ionicons name="sync-outline" size={14} color={currentTheme.appleBlue} />
                  <Text style={[styles.configButtonText, { color: currentTheme.appleBlue }]}>
                    Follow-ups
                  </Text>
                </Pressable>

                <Pressable
                  onPress={() => router.push('/settings')}
                  style={({ pressed }) => [
                    styles.configButton,
                    {
                      backgroundColor: pressed ? currentTheme.glassActive : currentTheme.glassHighlight,
                      borderColor: currentTheme.glassBorder,
                    },
                  ]}>
                  <Ionicons name="settings-outline" size={14} color={currentTheme.textPrimary} />
                  <Text style={[styles.configButtonText, { color: currentTheme.textPrimary }]}>
                    Settings
                  </Text>
                </Pressable>
              </View>
            </View>

            <Text style={[styles.title, { color: currentTheme.textPrimary }]}>
              Send Job Emails
            </Text>
            <Text style={[styles.subtitle, { color: currentTheme.textSecondary }]}>
              Bulk email delivery with resume attachment and sender rate protection.
            </Text>
          </View>

          {/* Candidate Card (Decent Inset Apple Banner) */}
          <View style={[styles.glassCard, { backgroundColor: currentTheme.glassBackground, borderColor: currentTheme.glassBorder }]}>
            <View style={styles.candidateRow}>
              <View style={[styles.avatarCircle, { backgroundColor: currentTheme.glassHighlight }]}>
                <Ionicons name="person-outline" size={20} color={currentTheme.appleBlue} />
              </View>
              <View style={styles.candidateDetails}>
                <Text style={[styles.candidateName, { color: currentTheme.textPrimary }]}>
                  {config.candidateName || CANDIDATE.fullName}
                </Text>
                <Text style={[styles.candidateRole, { color: currentTheme.textSecondary }]}>
                  {config.roleTitle || CANDIDATE.title} • {config.noticePeriod || CANDIDATE.noticePeriod}
                </Text>
              </View>
              <View style={[styles.resumeBadge, { backgroundColor: 'rgba(52, 199, 89, 0.15)' }]}>
                <Text style={styles.resumeBadgeText}>PDF Ready</Text>
              </View>
            </View>
          </View>

          {/* 1. EMAILS INPUT AREA */}
          <View style={[styles.glassCard, { backgroundColor: currentTheme.glassBackground, borderColor: currentTheme.glassBorder }]}>
            <View style={styles.sectionHeaderRow}>
              <Text style={[styles.inputLabel, { color: currentTheme.textSecondary }]}>
                RECIPIENT EMAILS (COMMA-SEPARATED)
              </Text>
              {validEmails.length > 0 && (
                <View style={[styles.countBadge, { backgroundColor: 'rgba(0, 122, 255, 0.15)' }]}>
                  <Text style={styles.countBadgeText}>
                    {validEmails.length} {validEmails.length === 1 ? 'Email' : 'Emails'}
                  </Text>
                </View>
              )}
            </View>

            <TextInput
              style={[
                styles.multiTextInput,
                {
                  color: currentTheme.textPrimary,
                  borderColor: currentTheme.glassBorder,
                  backgroundColor: currentTheme.inputBackground,
                },
              ]}
              multiline
              numberOfLines={4}
              placeholder="e.g. hr@company.com, jobs@startup.io, talent@enterprise.com"
              placeholderTextColor={currentTheme.placeholder}
              value={rawEmails}
              onChangeText={setRawEmails}
              autoCapitalize="none"
              autoCorrect={false}
              editable={!isSending}
            />

            {/* Quick Helper Actions */}
            <View style={styles.actionsRow}>
              <Pressable
                onPress={handleInsertSample}
                disabled={isSending}
                style={({ pressed }) => [
                  styles.quickPill,
                  { backgroundColor: pressed ? currentTheme.glassActive : currentTheme.glassHighlight },
                ]}>
                <Text style={[styles.quickPillText, { color: currentTheme.appleBlue }]}>
                  + Add Sample HRs
                </Text>
              </Pressable>

              {rawEmails.length > 0 && (
                <Pressable
                  onPress={handleClear}
                  disabled={isSending}
                  style={({ pressed }) => [
                    styles.quickPill,
                    { backgroundColor: pressed ? currentTheme.glassActive : currentTheme.glassHighlight },
                  ]}>
                  <Text style={[styles.quickPillText, { color: currentTheme.textSecondary }]}>
                    Clear
                  </Text>
                </Pressable>
              )}
            </View>

            {/* Preview of Parsed Chips */}
            {validEmails.length > 0 && (
              <View style={styles.chipsContainer}>
                {validEmails.map((email, idx) => (
                  <View key={idx} style={[styles.emailChip, { backgroundColor: currentTheme.glassHighlight }]}>
                    <Text style={[styles.emailChipText, { color: currentTheme.textPrimary }]}>
                      {email}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </View>

          {/* 2. THRESHOLD DELAY INPUT */}
          <View style={[styles.glassCard, { backgroundColor: currentTheme.glassBackground, borderColor: currentTheme.glassBorder }]}>
            <View style={styles.sectionHeaderRow}>
              <Text style={[styles.inputLabel, { color: currentTheme.textSecondary }]}>
                DELAY THRESHOLD (SECONDS)
              </Text>
              <Text style={[styles.delayBadge, { color: currentTheme.appleBlue }]}>
                {parsedDelay}s pause per email
              </Text>
            </View>

            <View style={styles.stepperRow}>
              <Pressable
                disabled={isSending || parsedDelay <= 1}
                onPress={() => setDelayThreshold(String(Math.max(1, parsedDelay - 1)))}
                style={({ pressed }) => [
                  styles.stepperButton,
                  { backgroundColor: pressed ? currentTheme.glassActive : currentTheme.glassHighlight },
                ]}>
                <Text style={[styles.stepperButtonText, { color: currentTheme.textPrimary }]}>−</Text>
              </Pressable>

              <TextInput
                style={[
                  styles.stepperInput,
                  {
                    color: currentTheme.textPrimary,
                    borderColor: currentTheme.glassBorder,
                    backgroundColor: currentTheme.inputBackground,
                  },
                ]}
                keyboardType="numeric"
                maxLength={3}
                value={delayThreshold}
                onChangeText={setDelayThreshold}
                editable={!isSending}
              />

              <Pressable
                disabled={isSending || parsedDelay >= 60}
                onPress={() => setDelayThreshold(String(Math.min(60, parsedDelay + 1)))}
                style={({ pressed }) => [
                  styles.stepperButton,
                  { backgroundColor: pressed ? currentTheme.glassActive : currentTheme.glassHighlight },
                ]}>
                <Text style={[styles.stepperButtonText, { color: currentTheme.textPrimary }]}>+</Text>
              </Pressable>

              {/* Preset Quick Toggles */}
              <View style={styles.presetGroup}>
                {[2, 3, 5].map((preset) => (
                  <Pressable
                    key={preset}
                    disabled={isSending}
                    onPress={() => setDelayThreshold(String(preset))}
                    style={[
                      styles.presetPill,
                      parsedDelay === preset
                        ? { backgroundColor: currentTheme.appleBlue }
                        : { backgroundColor: currentTheme.glassHighlight },
                    ]}>
                    <Text
                      style={[
                        styles.presetPillText,
                        { color: parsedDelay === preset ? '#ffffff' : currentTheme.textSecondary },
                      ]}>
                      {preset}s
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <Text style={[styles.helperText, { color: currentTheme.textTertiary }]}>
              Standard safety delay prevents email service rate-limiting and keeps your domain clean.
            </Text>
          </View>

          {/* 3. SEND BUTTON (ONLY BLUE AS SPECIFIED) */}
          <Pressable
            disabled={validEmails.length === 0 || isSending}
            onPress={handleStartSending}
            style={({ pressed }) => [
              styles.appleBlueButton,
              {
                backgroundColor:
                  validEmails.length === 0
                    ? currentTheme.disabledBlue
                    : pressed
                    ? currentTheme.appleBluePressed
                    : currentTheme.appleBlue,
              },
            ]}>
            {isSending ? (
              <View style={styles.sendingRow}>
                <ActivityIndicator color="#ffffff" size="small" />
                <Text style={styles.appleBlueButtonText}>
                  Sending {dispatchProgress?.currentIndex || 1} of {validEmails.length}...
                  {dispatchProgress && dispatchProgress.countdownSeconds > 0
                    ? ` (${dispatchProgress.countdownSeconds}s delay)`
                    : ''}
                </Text>
              </View>
            ) : (
              <Text style={styles.appleBlueButtonText}>
                {validEmails.length > 0
                  ? `Send ${validEmails.length} ${validEmails.length === 1 ? 'Email' : 'Emails'}`
                  : 'Enter Recipient Emails'}
              </Text>
            )}
          </Pressable>

          {/* Abort button when sending */}
          {isSending && (
            <Pressable onPress={handleAbort} style={styles.abortButton}>
              <Text style={styles.abortButtonText}>Stop Dispatch</Text>
            </Pressable>
          )}

          {/* 4. SUCCESS / STATUS AREA */}
          {(dispatchProgress || sentHistory.length > 0) && (
            <View
              style={[
                styles.glassCard,
                styles.successCard,
                {
                  backgroundColor: currentTheme.glassBackground,
                  borderColor:
                    dispatchProgress?.status === 'completed'
                      ? 'rgba(52, 199, 89, 0.4)'
                      : currentTheme.glassBorder,
                },
              ]}>
              <View style={styles.successHeader}>
                <View style={styles.successHeaderLeft}>
                  {dispatchProgress?.status === 'completed' ? (
                    <Ionicons name="checkmark-circle" size={26} color="#34C759" style={{ marginRight: 8 }} />
                  ) : (
                    <Ionicons name="time-outline" size={26} color={currentTheme.appleBlue} style={{ marginRight: 8 }} />
                  )}
                  <View>
                    <Text style={[styles.successTitle, { color: currentTheme.textPrimary }]}>
                      {dispatchProgress?.status === 'completed'
                        ? 'Batch Dispatched Successfully'
                        : isSending
                        ? 'Dispatch in Progress'
                        : 'Dispatch Summary'}
                    </Text>
                    <Text style={[styles.successSubtitle, { color: currentTheme.textSecondary }]}>
                      {dispatchProgress
                        ? `${dispatchProgress.currentIndex} / ${dispatchProgress.total} processed`
                        : `${sentHistory.length} sent total`}
                    </Text>
                  </View>
                </View>

                {dispatchProgress?.status === 'completed' && (
                  <View style={[styles.badgeGreen, { backgroundColor: 'rgba(52, 199, 89, 0.15)' }]}>
                    <Text style={styles.badgeGreenText}>Done</Text>
                  </View>
                )}
              </View>

              {/* Progress Bar */}
              {dispatchProgress && (
                <View style={[styles.progressBarTrack, { backgroundColor: currentTheme.glassHighlight }]}>
                  <View
                    style={[
                      styles.progressBarFill,
                      {
                        backgroundColor:
                          dispatchProgress.status === 'completed' ? '#34C759' : currentTheme.appleBlue,
                        width: `${Math.round(
                          (dispatchProgress.currentIndex / Math.max(1, dispatchProgress.total)) * 100
                        )}%`,
                      },
                    ]}
                  />
                </View>
              )}

              {/* List of Sent Items */}
              <View style={styles.itemsList}>
                {(dispatchProgress?.items || sentHistory).map((item) => (
                  <View key={item.id} style={[styles.itemRow, { borderColor: currentTheme.glassBorder }]}>
                    <View style={styles.itemLeft}>
                      {item.status === 'success' ? (
                        <Ionicons name="checkmark-circle" size={16} color="#34C759" style={{ marginRight: 4 }} />
                      ) : item.status === 'sending' ? (
                        <Ionicons name="time" size={16} color={currentTheme.appleBlue} style={{ marginRight: 4 }} />
                      ) : (
                        <Ionicons name="ellipse-outline" size={16} color={currentTheme.textTertiary} style={{ marginRight: 4 }} />
                      )}
                      <Text style={[styles.itemEmail, { color: currentTheme.textPrimary }]}>
                        {item.email}
                      </Text>
                    </View>
                    <View style={styles.itemRight}>
                      {item.timestamp && (
                        <Text style={[styles.itemTime, { color: currentTheme.textTertiary }]}>
                          {item.timestamp}
                        </Text>
                      )}
                      <View
                        style={[
                          styles.statusTag,
                          item.status === 'success'
                            ? styles.statusTagSuccess
                            : item.status === 'sending'
                            ? styles.statusTagSending
                            : styles.statusTagDefault,
                        ]}>
                        <Text
                          style={[
                            styles.statusTagText,
                            item.status === 'success'
                              ? styles.statusTagSuccessText
                              : item.status === 'sending'
                              ? styles.statusTagSendingText
                              : { color: currentTheme.textSecondary },
                          ]}>
                          {item.status === 'success' ? 'Delivered' : item.status}
                        </Text>
                      </View>
                    </View>
                  </View>
                ))}
              </View>

              {/* Quick Jump to Follow-ups tracker */}
              <Pressable
                onPress={() => router.push('/followups')}
                style={({ pressed }) => [
                  styles.ctaFollowUpBanner,
                  {
                    backgroundColor: pressed ? currentTheme.glassActive : currentTheme.glassHighlight,
                    borderColor: currentTheme.glassBorder,
                  },
                ]}>
                <Ionicons name="sync-outline" size={22} color={currentTheme.appleBlue} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.ctaFollowUpTitle, { color: currentTheme.appleBlue }]}>
                    Track in Follow-Ups & Recruiter Cadence
                  </Text>
                  <Text style={[styles.ctaFollowUpSub, { color: currentTheme.textSecondary }]}>
                    Automatic reminders after 3 days to send polite bump emails
                  </Text>
                </View>
                <Text style={[styles.ctaFollowUpArrow, { color: currentTheme.appleBlue }]}>→</Text>
              </Pressable>
            </View>
          )}

          {/* Bottom spacing to ensure content clears the tab bar */}
          <View style={{ height: 90 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ----------------------------------------------------------------------------
// Apple Glass Theme Color Tokens
// ----------------------------------------------------------------------------
const darkTheme = {
  pageBackground: '#000000',
  glassBackground: 'rgba(28, 28, 30, 0.65)',
  glassHighlight: 'rgba(255, 255, 255, 0.08)',
  glassActive: 'rgba(255, 255, 255, 0.16)',
  glassBorder: 'rgba(255, 255, 255, 0.12)',
  inputBackground: 'rgba(0, 0, 0, 0.35)',
  textPrimary: '#FFFFFF',
  textSecondary: '#8E8E93',
  textTertiary: '#636366',
  placeholder: '#48484A',
  appleBlue: '#007AFF',
  appleBluePressed: '#005ec4',
  disabledBlue: 'rgba(0, 122, 255, 0.3)',
};

const lightTheme = {
  pageBackground: '#F2F2F7',
  glassBackground: 'rgba(255, 255, 255, 0.85)',
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
  disabledBlue: 'rgba(0, 122, 255, 0.3)',
};

// ----------------------------------------------------------------------------
// Styles (Apple Inset Grouped Glass Aesthetics)
// ----------------------------------------------------------------------------
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  keyboardContainer: {
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
    marginBottom: 20,
  },
  headerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
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
  configButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
  },
  configButtonIcon: {
    fontSize: 14,
  },
  configButtonText: {
    fontSize: 13,
    fontWeight: '600',
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    letterSpacing: -0.5,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 20,
  },
  glassCard: {
    borderWidth: 1,
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  candidateRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarEmoji: {
    fontSize: 20,
  },
  candidateDetails: {
    flex: 1,
  },
  candidateName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  candidateRole: {
    fontSize: 13,
  },
  resumeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  resumeBadgeText: {
    color: '#34C759',
    fontSize: 12,
    fontWeight: '600',
  },
  configTray: {
    gap: 8,
  },
  singleTextInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  countBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  countBadgeText: {
    color: '#007AFF',
    fontSize: 12,
    fontWeight: '600',
  },
  multiTextInput: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    fontSize: 15,
    minHeight: 90,
    textAlignVertical: 'top',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  quickPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  quickPillText: {
    fontSize: 13,
    fontWeight: '600',
  },
  chipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 12,
  },
  emailChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  emailChipText: {
    fontSize: 13,
    fontWeight: '500',
  },
  delayBadge: {
    fontSize: 12,
    fontWeight: '600',
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginVertical: 4,
  },
  stepperButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperButtonText: {
    fontSize: 22,
    fontWeight: '600',
  },
  stepperInput: {
    width: 60,
    height: 44,
    borderWidth: 1,
    borderRadius: 12,
    textAlign: 'center',
    fontSize: 17,
    fontWeight: '600',
  },
  presetGroup: {
    flexDirection: 'row',
    gap: 6,
    marginLeft: 'auto',
  },
  presetPill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  presetPillText: {
    fontSize: 13,
    fontWeight: '600',
  },
  helperText: {
    fontSize: 12,
    lineHeight: 16,
    marginTop: 8,
  },
  appleBlueButton: {
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 12,
    ...Platform.select({
      ios: {
        shadowColor: '#007AFF',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.35,
        shadowRadius: 10,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  appleBlueButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  sendingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  abortButton: {
    alignSelf: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  abortButtonText: {
    color: '#FF3B30',
    fontSize: 14,
    fontWeight: '600',
  },
  successCard: {
    marginTop: 8,
  },
  successHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  successHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  successCheckIcon: {
    fontSize: 24,
  },
  successTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  successSubtitle: {
    fontSize: 13,
  },
  badgeGreen: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  badgeGreenText: {
    color: '#34C759',
    fontSize: 12,
    fontWeight: '700',
  },
  progressBarTrack: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 14,
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  itemsList: {
    gap: 8,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  itemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  itemStatusDot: {
    fontSize: 10,
  },
  itemEmail: {
    fontSize: 14,
    fontWeight: '500',
  },
  itemRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  itemTime: {
    fontSize: 12,
  },
  statusTag: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  statusTagDefault: {
    backgroundColor: 'rgba(142, 142, 147, 0.15)',
  },
  statusTagSending: {
    backgroundColor: 'rgba(0, 122, 255, 0.15)',
  },
  statusTagSuccess: {
    backgroundColor: 'rgba(52, 199, 89, 0.15)',
  },
  statusTagText: {
    fontSize: 11,
    fontWeight: '600',
  },
  statusTagSendingText: {
    color: '#007AFF',
  },
  statusTagSuccessText: {
    color: '#34C759',
  },
  ctaFollowUpBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 16,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  ctaFollowUpEmoji: {
    fontSize: 22,
  },
  ctaFollowUpTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
  },
  ctaFollowUpSub: {
    fontSize: 12,
  },
  ctaFollowUpArrow: {
    fontSize: 18,
    fontWeight: '700',
    paddingHorizontal: 4,
  },
});
