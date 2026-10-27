import React, { useState } from 'react';
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
import { CANDIDATE } from '@/services/emailService';
import { COPY_TEMPLATES } from '@/services/copyTemplates';

export default function SettingsScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme !== 'light';
  const { config, updateConfig, resetConfig } = useConfig();

  // Local edit overrides in Settings form
  const [delayInput, setDelayInput] = useState<string | null>(null);
  const [noticePeriod, setNoticePeriod] = useState<string | null>(null);
  const [roleTitle, setRoleTitle] = useState<string | null>(null);
  const [webhookUrl, setWebhookUrl] = useState<string | null>(null);

  const activeDelay = delayInput ?? String(config.delaySeconds);
  const activeNotice = noticePeriod ?? config.noticePeriod;
  const activeRole = roleTitle ?? config.roleTitle;
  const activeWebhook = webhookUrl ?? config.webhookUrl;

  // Webhook Test State
  const [testingWebhook, setTestingWebhook] = useState<boolean>(false);
  const [webhookStatus, setWebhookStatus] = useState<{
    tested: boolean;
    success: boolean;
    message: string;
  }>({ tested: false, success: false, message: '' });

  const [savedBanner, setSavedBanner] = useState<boolean>(false);

  const handleSave = async () => {
    const parsedDelay = parseInt(activeDelay, 10);
    const validDelay = isNaN(parsedDelay) || parsedDelay < 1 ? 3 : parsedDelay;

    await updateConfig({
      delaySeconds: validDelay,
      noticePeriod: activeNotice.trim() || '15 Days Notice Period',
      roleTitle: activeRole.trim() || 'Full Stack Developer',
      webhookUrl: activeWebhook.trim(),
    });

    setSavedBanner(true);
    setTimeout(() => setSavedBanner(false), 2500);
  };

  const handleTestWebhook = async () => {
    if (!activeWebhook.trim() || !activeWebhook.trim().startsWith('http')) {
      setWebhookStatus({
        tested: true,
        success: false,
        message: 'Please enter a valid https:// URL starting with https://script.google.com',
      });
      return;
    }

    setTestingWebhook(true);
    setWebhookStatus({ tested: false, success: false, message: '' });

    try {
      const res = await fetch(activeWebhook.trim());
      const data = await res.json();

      if (data && (data.status === 'active' || data.success !== false)) {
        setWebhookStatus({
          tested: true,
          success: true,
          message: data.resumeFound
            ? 'Connected! Resume PDF verified on Google Drive.'
            : 'Connected to Webhook (Make sure "Himanshu Chauhan.pdf" is on Google Drive).',
        });
      } else {
        setWebhookStatus({
          tested: true,
          success: false,
          message: data.error || 'Server responded with an unexpected format.',
        });
      }
    } catch (err: any) {
      setWebhookStatus({
        tested: true,
        success: false,
        message: `Connection failed: ${err?.message || 'Check URL or permissions'}`,
      });
    } finally {
      setTestingWebhook(false);
    }
  };

  const handleReset = async () => {
    await resetConfig();
    setDelayInput('3');
    setNoticePeriod('15 Days Notice Period');
    setRoleTitle('Full Stack Developer');
    setWebhookUrl('');
    setWebhookStatus({ tested: false, success: false, message: '' });
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

          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTopRow}>
              <View style={[styles.applePill, { backgroundColor: currentTheme.glassHighlight }]}>
                <Text style={[styles.applePillText, { color: currentTheme.textSecondary }]}>
                  PREFERENCES & CONFIG
                </Text>
              </View>
              <Pressable
                onPress={() => router.push('/')}
                style={({ pressed }) => [
                  styles.doneButton,
                  {
                    backgroundColor: pressed ? currentTheme.glassActive : currentTheme.glassHighlight,
                    borderColor: currentTheme.glassBorder,
                  },
                ]}>
                <Ionicons name="checkmark" size={14} color={currentTheme.appleBlue} style={{ marginRight: 4 }} />
                <Text style={[styles.doneButtonText, { color: currentTheme.appleBlue }]}>
                  Done
                </Text>
              </Pressable>
            </View>
            <Text style={[styles.title, { color: currentTheme.textPrimary }]}>
              Settings
            </Text>
            <Text style={[styles.subtitle, { color: currentTheme.textSecondary }]}>
              Configure default delays, notice period, and your Google Apps Script webhook.
            </Text>
          </View>

          {/* Saved feedback banner */}
          {savedBanner && (
            <View style={styles.savedBanner}>
              <Ionicons name="checkmark-circle" size={16} color="#34C759" style={{ marginRight: 6 }} />
              <Text style={styles.savedBannerText}>Preferences Saved Successfully</Text>
            </View>
          )}

          {/* 1. DISPATCH RATE LIMIT / DELAY */}
          <View style={[styles.glassCard, { backgroundColor: currentTheme.glassBackground, borderColor: currentTheme.glassBorder }]}>
            <Text style={[styles.sectionTitle, { color: currentTheme.textPrimary }]}>
              Dispatch Delay Threshold
            </Text>
            <Text style={[styles.sectionSubtitle, { color: currentTheme.textSecondary }]}>
              Pause duration between each outgoing application email.
            </Text>

            <View style={styles.stepperRow}>
              <Pressable
                onPress={() => {
                  const curr = parseInt(activeDelay, 10) || 3;
                  setDelayInput(String(Math.max(1, curr - 1)));
                }}
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
                value={activeDelay}
                onChangeText={setDelayInput}
              />

              <Pressable
                onPress={() => {
                  const curr = parseInt(activeDelay, 10) || 3;
                  setDelayInput(String(Math.min(60, curr + 1)));
                }}
                style={({ pressed }) => [
                  styles.stepperButton,
                  { backgroundColor: pressed ? currentTheme.glassActive : currentTheme.glassHighlight },
                ]}>
                <Text style={[styles.stepperButtonText, { color: currentTheme.textPrimary }]}>+</Text>
              </Pressable>

              <Text style={[styles.secondsLabel, { color: currentTheme.textPrimary }]}>seconds</Text>
            </View>

            {/* Quick Presets */}
            <View style={styles.presetGroup}>
              {[
                { label: '2s Fast', val: 2 },
                { label: '3s Safe (Recommended)', val: 3 },
                { label: '5s Stealth', val: 5 },
              ].map((p) => (
                <Pressable
                  key={p.val}
                  onPress={() => setDelayInput(String(p.val))}
                  style={[
                    styles.presetPill,
                    parseInt(activeDelay, 10) === p.val
                      ? { backgroundColor: currentTheme.appleBlue }
                      : { backgroundColor: currentTheme.glassHighlight },
                  ]}>
                  <Text
                    style={[
                      styles.presetPillText,
                      { color: parseInt(activeDelay, 10) === p.val ? '#ffffff' : currentTheme.textSecondary },
                    ]}>
                    {p.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Text style={[styles.helperText, { color: currentTheme.textTertiary }]}>
              Enforces a gap between emails to protect your Gmail account against algorithmic spam filters.
            </Text>
          </View>

          {/* 2. NOTICE PERIOD & AVAILABILITY */}
          <View style={[styles.glassCard, { backgroundColor: currentTheme.glassBackground, borderColor: currentTheme.glassBorder }]}>
            <Text style={[styles.sectionTitle, { color: currentTheme.textPrimary }]}>
              Notice Period & Availability
            </Text>
            <Text style={[styles.sectionSubtitle, { color: currentTheme.textSecondary }]}>
              Highlights your availability in the email subject line and opening hook.
            </Text>

            <TextInput
              style={[
                styles.textInput,
                {
                  color: currentTheme.textPrimary,
                  borderColor: currentTheme.glassBorder,
                  backgroundColor: currentTheme.inputBackground,
                },
              ]}
              placeholder="e.g. 15 Days Notice Period"
              placeholderTextColor={currentTheme.placeholder}
              value={activeNotice}
              onChangeText={setNoticePeriod}
            />

            {/* Quick Presets */}
            <View style={styles.chipsRow}>
              {[
                '15 Days Notice Period',
                'Immediate Joiner (0 Days)',
                '30 Days Notice Period',
                'Serving Notice (Available Soon)',
              ].map((preset) => (
                <Pressable
                  key={preset}
                  onPress={() => setNoticePeriod(preset)}
                  style={[
                    styles.presetPill,
                    activeNotice === preset
                      ? { backgroundColor: currentTheme.appleBlue }
                      : { backgroundColor: currentTheme.glassHighlight },
                  ]}>
                  <Text
                    style={[
                      styles.presetPillText,
                      { color: activeNotice === preset ? '#ffffff' : currentTheme.textSecondary },
                    ]}>
                    {preset}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* 3. TARGET ROLE TITLE */}
          <View style={[styles.glassCard, { backgroundColor: currentTheme.glassBackground, borderColor: currentTheme.glassBorder }]}>
            <Text style={[styles.sectionTitle, { color: currentTheme.textPrimary }]}>
              Default Target Role Title
            </Text>
            <Text style={[styles.sectionSubtitle, { color: currentTheme.textSecondary }]}>
              Appears in &quot;Application for [Role Title] — Himanshu A. Chauhan&quot;
            </Text>

            <TextInput
              style={[
                styles.textInput,
                {
                  color: currentTheme.textPrimary,
                  borderColor: currentTheme.glassBorder,
                  backgroundColor: currentTheme.inputBackground,
                },
              ]}
              placeholder="e.g. Full Stack Developer"
              placeholderTextColor={currentTheme.placeholder}
              value={activeRole}
              onChangeText={setRoleTitle}
            />

            {/* Quick Role Presets */}
            <View style={styles.chipsRow}>
              {[
                'Full Stack Developer',
                'MERN / MEAN Stack Developer',
                'React Native Developer',
                'Node.js Backend Developer',
              ].map((role) => (
                <Pressable
                  key={role}
                  onPress={() => setRoleTitle(role)}
                  style={[
                    styles.presetPill,
                    activeRole === role
                      ? { backgroundColor: currentTheme.appleBlue }
                      : { backgroundColor: currentTheme.glassHighlight },
                  ]}>
                  <Text
                    style={[
                      styles.presetPillText,
                      { color: activeRole === role ? '#ffffff' : currentTheme.textSecondary },
                    ]}>
                    {role}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* 4. GOOGLE APPS SCRIPT WEBHOOK CONFIG */}
          <View style={[styles.glassCard, { backgroundColor: currentTheme.glassBackground, borderColor: currentTheme.glassBorder }]}>
            <View style={styles.titleWithBadge}>
              <Text style={[styles.sectionTitle, { color: currentTheme.textPrimary }]}>
                Google Apps Script Webhook
              </Text>
              <View
                style={[
                  styles.statusBadge,
                  activeWebhook.trim()
                    ? { backgroundColor: 'rgba(52, 199, 89, 0.15)' }
                    : { backgroundColor: currentTheme.glassHighlight },
                ]}>
                <Text
                  style={[
                    styles.statusBadgeText,
                    activeWebhook.trim() ? { color: '#34C759' } : { color: currentTheme.textTertiary },
                  ]}>
                  {activeWebhook.trim() ? 'Configured' : 'Simulator Mode'}
                </Text>
              </View>
            </View>

            <Text style={[styles.sectionSubtitle, { color: currentTheme.textSecondary }]}>
              Paste the Web App URL deployed from script.google.com for live Gmail sending.
            </Text>

            <TextInput
              style={[
                styles.textInput,
                {
                  color: currentTheme.textPrimary,
                  borderColor: currentTheme.glassBorder,
                  backgroundColor: currentTheme.inputBackground,
                },
              ]}
              placeholder="https://script.google.com/macros/s/.../exec"
              placeholderTextColor={currentTheme.placeholder}
              value={activeWebhook}
              onChangeText={(text) => {
                setWebhookUrl(text);
                setWebhookStatus({ tested: false, success: false, message: '' });
              }}
              autoCapitalize="none"
              autoCorrect={false}
            />

            {/* Test Connection Button */}
            <View style={styles.webhookActionRow}>
              <Pressable
                disabled={testingWebhook || !activeWebhook.trim()}
                onPress={handleTestWebhook}
                style={({ pressed }) => [
                  styles.testButton,
                  {
                    backgroundColor:
                      !activeWebhook.trim()
                        ? currentTheme.glassHighlight
                        : pressed
                          ? currentTheme.glassActive
                          : currentTheme.glassHighlight,
                    borderColor: currentTheme.glassBorder,
                  },
                ]}>
                {testingWebhook ? (
                  <ActivityIndicator size="small" color={currentTheme.appleBlue} />
                ) : (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Ionicons
                      name="flash-outline"
                      size={14}
                      color={activeWebhook.trim() ? currentTheme.appleBlue : currentTheme.textTertiary}
                    />
                    <Text
                      style={[
                        styles.testButtonText,
                        { color: activeWebhook.trim() ? currentTheme.appleBlue : currentTheme.textTertiary },
                      ]}>
                      Test Connection
                    </Text>
                  </View>
                )}
              </Pressable>
            </View>

            {/* Webhook Test Result */}
            {webhookStatus.tested && (
              <View
                style={[
                  styles.testResultBox,
                  {
                    flexDirection: 'row',
                    alignItems: 'center',
                    backgroundColor: webhookStatus.success
                      ? 'rgba(52, 199, 89, 0.12)'
                      : 'rgba(255, 59, 48, 0.12)',
                    borderColor: webhookStatus.success
                      ? 'rgba(52, 199, 89, 0.3)'
                      : 'rgba(255, 59, 48, 0.3)',
                  },
                ]}>
                <Ionicons
                  name={webhookStatus.success ? 'checkmark-circle' : 'close-circle'}
                  size={15}
                  color={webhookStatus.success ? '#34C759' : '#FF3B30'}
                  style={{ marginRight: 6 }}
                />
                <Text
                  style={[
                    styles.testResultText,
                    { color: webhookStatus.success ? '#34C759' : '#FF3B30', flex: 1 },
                  ]}>
                  {webhookStatus.message}
                </Text>
              </View>
            )}

            <Text style={[styles.helperText, { color: currentTheme.textTertiary }]}>
              Copy the code from &quot;google_apps_script_backend.js&quot; into script.google.com, deploy as Web App, and paste the exec URL here.
            </Text>
          </View>

          {/* 5. RESUME & CANDIDATE PROFILE */}
          <View style={[styles.glassCard, { backgroundColor: currentTheme.glassBackground, borderColor: currentTheme.glassBorder }]}>
            <Text style={[styles.sectionTitle, { color: currentTheme.textPrimary }]}>
              Candidate Profile
            </Text>
            <View style={styles.candidateDetailsGrid}>
              <View style={styles.detailRow}>
                <Text style={[styles.detailKey, { color: currentTheme.textSecondary }]}>Full Name</Text>
                <Text style={[styles.detailVal, { color: currentTheme.textPrimary }]}>{CANDIDATE.fullName}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={[styles.detailKey, { color: currentTheme.textSecondary }]}>Email</Text>
                <Text style={[styles.detailVal, { color: currentTheme.textPrimary }]}>{CANDIDATE.email}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={[styles.detailKey, { color: currentTheme.textSecondary }]}>Resume PDF</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Ionicons name="checkmark-circle" size={14} color="#34C759" />
                  <Text style={[styles.detailVal, { color: '#34C759' }]}>{CANDIDATE.resumeFileName}</Text>
                </View>
              </View>
              <View style={styles.detailRow}>
                <Text style={[styles.detailKey, { color: currentTheme.textSecondary }]}>Portfolio</Text>
                <Text style={[styles.detailVal, { color: currentTheme.appleBlue }]}>{CANDIDATE.portfolio}</Text>
              </View>
            </View>
          </View>

          {/* 6. TEMPLATES REPOSITORY SECTION */}
          <View style={[styles.glassCard, { backgroundColor: currentTheme.glassBackground, borderColor: currentTheme.glassBorder }]}>
            <View style={styles.titleWithBadge}>
              <Text style={[styles.sectionTitle, { color: currentTheme.textPrimary }]}>
                Templates
              </Text>
              <View
                style={[
                  styles.statusBadge,
                  { backgroundColor: isDark ? 'rgba(0, 122, 255, 0.18)' : 'rgba(0, 122, 255, 0.12)' },
                ]}>
                <Text style={[styles.statusBadgeText, { color: currentTheme.appleBlue }]}>
                  {COPY_TEMPLATES.length} Templates
                </Text>
              </View>
            </View>

            <Text style={[styles.sectionSubtitle, { color: currentTheme.textSecondary }]}>
              Pre-built application, follow-up, and screening questionnaire templates ready to view and copy.
            </Text>

            <Pressable
              onPress={() => router.push('/templates')}
              style={({ pressed }) => [
                styles.openTemplatesButton,
                {
                  backgroundColor: pressed ? currentTheme.glassActive : currentTheme.glassHighlight,
                  borderColor: currentTheme.glassBorder,
                },
              ]}>
              <View style={styles.openTemplatesButtonContent}>
                <Ionicons name="document-text-outline" size={20} color={currentTheme.appleBlue} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.openTemplatesButtonTitle, { color: currentTheme.textPrimary }]}>
                    View Templates
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={currentTheme.textSecondary} />
              </View>
            </Pressable>
          </View>

          {/* 7. SAVE & RESET BUTTONS */}
          <Pressable
            onPress={handleSave}
            style={({ pressed }) => [
              styles.saveButton,
              { backgroundColor: pressed ? currentTheme.appleBluePressed : currentTheme.appleBlue },
            ]}>
            <Text style={styles.saveButtonText}>Save Preferences</Text>
          </Pressable>

          <Pressable onPress={handleReset} style={styles.resetButton}>
            <Text style={[styles.resetButtonText, { color: currentTheme.textTertiary }]}>
              Reset to Defaults
            </Text>
          </Pressable>

          {/* Bottom spacing for tab bar clearance */}
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
};

// ----------------------------------------------------------------------------
// Styles
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
  doneButton: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
  },
  doneButtonText: {
    fontSize: 13,
    fontWeight: '700',
  },
  applePillText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
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
  savedBanner: {
    backgroundColor: 'rgba(52, 199, 89, 0.2)',
    borderColor: 'rgba(52, 199, 89, 0.4)',
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginBottom: 16,
    alignItems: 'center',
  },
  savedBannerText: {
    color: '#34C759',
    fontSize: 14,
    fontWeight: '600',
  },
  glassCard: {
    borderWidth: 1,
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '600',
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 14,
  },
  titleWithBadge: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
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
    width: 64,
    height: 44,
    borderWidth: 1,
    borderRadius: 12,
    textAlign: 'center',
    fontSize: 17,
    fontWeight: '600',
  },
  secondsLabel: {
    fontSize: 15,
    fontWeight: '500',
    marginLeft: 4,
  },
  presetGroup: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
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
  textInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
  },
  webhookActionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
  },
  testButton: {
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  testButtonText: {
    fontSize: 13,
    fontWeight: '600',
  },
  testResultBox: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    marginTop: 10,
  },
  testResultText: {
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 18,
  },
  helperText: {
    fontSize: 12,
    lineHeight: 16,
    marginTop: 10,
  },
  candidateDetailsGrid: {
    gap: 10,
    marginTop: 4,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  detailKey: {
    fontSize: 14,
  },
  detailVal: {
    fontSize: 14,
    fontWeight: '600',
  },
  saveButton: {
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    marginBottom: 12,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  resetButton: {
    alignSelf: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  resetButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
  openTemplatesButton: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    marginTop: 4,
  },
  openTemplatesButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  openTemplatesButtonTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  openTemplatesButtonDesc: {
    fontSize: 12,
    marginTop: 2,
  },
});
