import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  Pressable,
  useColorScheme,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';

import { copyTemplates, hasUnfilledPlaceholder } from '@/services/copyTemplates';

export default function TemplatesScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme !== 'light';

  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [copiedBanner, setCopiedBanner] = useState<string | null>(null);

  const currentTemplate = copyTemplates[currentIndex];
  const total = copyTemplates.length;

  const handlePrev = () => {
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : total - 1));
  };

  const handleNext = () => {
    setCurrentIndex((prev) => (prev < total - 1 ? prev + 1 : 0));
  };

  const handleCopyContent = async () => {
    const textToCopy = currentTemplate.body || currentTemplate.content;
    try {
      if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(textToCopy);
      } else {
        await Clipboard.setStringAsync(textToCopy);
      }
      if (hasUnfilledPlaceholder(textToCopy)) {
        setCopiedBanner('Copied — please fill in text in [brackets]');
      } else {
        setCopiedBanner('Template copied to clipboard');
      }
      setTimeout(() => setCopiedBanner(null), 2500);
    } catch {
      setCopiedBanner('Copied to clipboard');
      setTimeout(() => setCopiedBanner(null), 2500);
    }
  };

  const handleCopySubject = async () => {
    try {
      if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(currentTemplate.subject);
      } else {
        await Clipboard.setStringAsync(currentTemplate.subject);
      }
      setCopiedBanner('Subject copied to clipboard');
      setTimeout(() => setCopiedBanner(null), 2500);
    } catch {
      setCopiedBanner('Subject copied');
      setTimeout(() => setCopiedBanner(null), 2500);
    }
  };

  const currentTheme = isDark ? darkTheme : lightTheme;

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: currentTheme.pageBackground }]}
      edges={['top', 'left', 'right']}>
      {/* Top Header */}
      <View style={[styles.header, { borderBottomColor: currentTheme.glassBorder }]}>
        {/* Left: Screen Icon and Title */}
        <View style={styles.headerLeft}>
          <View
            style={[
              styles.iconButton,
              {
                backgroundColor: currentTheme.glassHighlight,
                borderColor: currentTheme.glassBorder,
              },
            ]}>
            <Ionicons name="document-text" size={20} color={currentTheme.appleBlue} />
          </View>
          <View style={styles.titleColumn}>
            <Text style={[styles.headerTitle, { color: currentTheme.textPrimary }]}>
              Templates
            </Text>
            <Text style={[styles.headerCounter, { color: currentTheme.textSecondary }]}>
              {currentIndex + 1} of {total}
            </Text>
          </View>
        </View>

        {/* Right side: Prev/Next navigation buttons and Copy action */}
        <View style={styles.headerRight}>
          <Pressable
            onPress={handleCopyContent}
            style={({ pressed }) => [
              styles.copyButton,
              {
                backgroundColor: pressed ? currentTheme.appleBluePressed : currentTheme.appleBlue,
              },
            ]}>
            <Ionicons name="copy-outline" size={15} color="#FFFFFF" style={{ marginRight: 5 }} />
            <Text style={styles.copyButtonText}>Copy</Text>
          </Pressable>

          <View style={styles.navArrowsGroup}>
            <Pressable
              onPress={handlePrev}
              style={({ pressed }) => [
                styles.iconButton,
                {
                  backgroundColor: pressed ? currentTheme.glassActive : currentTheme.glassHighlight,
                  borderColor: currentTheme.glassBorder,
                },
              ]}>
              <Ionicons name="chevron-back" size={20} color={currentTheme.textPrimary} />
            </Pressable>

            <Pressable
              onPress={handleNext}
              style={({ pressed }) => [
                styles.iconButton,
                {
                  backgroundColor: pressed ? currentTheme.glassActive : currentTheme.glassHighlight,
                  borderColor: currentTheme.glassBorder,
                },
              ]}>
              <Ionicons name="chevron-forward" size={20} color={currentTheme.textPrimary} />
            </Pressable>
          </View>
        </View>
      </View>

      {/* Copy Banner Toast */}
      {copiedBanner && (
        <View style={styles.toastBanner}>
          <Ionicons name="checkmark-circle" size={16} color="#34C759" style={{ marginRight: 6 }} />
          <Text style={styles.toastBannerText}>{copiedBanner}</Text>
        </View>
      )}

      {/* Template Metadata & Subject Bar */}
      <View style={[styles.metaBar, { backgroundColor: currentTheme.glassBackground, borderBottomColor: currentTheme.glassBorder }]}>
        <View style={styles.metaTopRow}>
          <Text style={[styles.templateName, { color: currentTheme.textPrimary }]}>
            {currentTemplate.name}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            {hasUnfilledPlaceholder(currentTemplate.body || currentTemplate.content) && (
              <View
                style={[
                  styles.placeholderWarningPill,
                  {
                    backgroundColor: isDark ? 'rgba(255, 159, 10, 0.18)' : 'rgba(255, 149, 0, 0.12)',
                    borderColor: isDark ? 'rgba(255, 159, 10, 0.4)' : 'rgba(255, 149, 0, 0.35)',
                  },
                ]}>
                <Ionicons name="alert-circle-outline" size={12} color="#FF9500" style={{ marginRight: 4 }} />
                <Text style={styles.placeholderWarningText}>Fill [brackets]</Text>
              </View>
            )}
            <View style={[styles.tagPill, { backgroundColor: currentTheme.glassHighlight, borderColor: currentTheme.glassBorder }]}>
              <Text style={[styles.tagPillText, { color: currentTheme.appleBlue }]}>
                {currentTemplate.tag}
              </Text>
            </View>
          </View>
        </View>

        {/* Subject line box with dedicated tap-to-copy */}
        <Pressable
          onPress={handleCopySubject}
          style={({ pressed }) => [
            styles.subjectBox,
            {
              backgroundColor: pressed ? currentTheme.glassActive : currentTheme.inputBackground,
              borderColor: currentTheme.glassBorder,
            },
          ]}>
          <View style={styles.subjectContent}>
            <Text style={[styles.subjectLabel, { color: currentTheme.textSecondary }]}>
              SUBJECT:
            </Text>
            <Text
              numberOfLines={1}
              ellipsizeMode="tail"
              style={[styles.subjectValue, { color: currentTheme.textPrimary }]}>
              {currentTemplate.subject}
            </Text>
          </View>
          <Ionicons name="copy-outline" size={14} color={currentTheme.appleBlue} style={{ marginLeft: 8 }} />
        </Pressable>
      </View>

      {/* Full-Screen Text Area */}
      <View style={styles.editorContainer}>
        <TextInput
          style={[
            styles.textArea,
            {
              color: currentTheme.textPrimary,
              backgroundColor: currentTheme.textAreaBackground,
            },
          ]}
          multiline
          scrollEnabled
          editable
          value={currentTemplate.body || currentTemplate.content}
          textAlignVertical="top"
          autoCapitalize="none"
          autoCorrect={false}
          selectionColor={currentTheme.appleBlue}
        />
      </View>
    </SafeAreaView>
  );
}

// ----------------------------------------------------------------------------
// Color Tokens
// ----------------------------------------------------------------------------
const darkTheme = {
  pageBackground: '#000000',
  glassBackground: 'rgba(28, 28, 30, 0.75)',
  glassHighlight: 'rgba(255, 255, 255, 0.08)',
  glassActive: 'rgba(255, 255, 255, 0.16)',
  glassBorder: 'rgba(255, 255, 255, 0.12)',
  inputBackground: 'rgba(28, 28, 30, 0.9)',
  textAreaBackground: '#0D0D0E',
  textPrimary: '#FFFFFF',
  textSecondary: '#8E8E93',
  textTertiary: '#636366',
  appleBlue: '#007AFF',
  appleBluePressed: '#005ec4',
};

const lightTheme = {
  pageBackground: '#F2F2F7',
  glassBackground: 'rgba(255, 255, 255, 0.95)',
  glassHighlight: 'rgba(0, 0, 0, 0.04)',
  glassActive: 'rgba(0, 0, 0, 0.08)',
  glassBorder: 'rgba(0, 0, 0, 0.1)',
  inputBackground: '#FFFFFF',
  textAreaBackground: '#FFFFFF',
  textPrimary: '#000000',
  textSecondary: '#6C6C70',
  textTertiary: '#8E8E93',
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  titleColumn: {
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  headerCounter: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 1,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  navArrowsGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  iconButton: {
    width: 38,
    height: 38,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 12,
  },
  copyButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  toastBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(52, 199, 89, 0.18)',
    borderColor: 'rgba(52, 199, 89, 0.4)',
    borderWidth: 1,
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 10,
  },
  toastBannerText: {
    color: '#34C759',
    fontSize: 13,
    fontWeight: '600',
  },
  metaBar: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  metaTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  templateName: {
    fontSize: 16,
    fontWeight: '700',
    flex: 1,
  },
  placeholderWarningPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
  },
  placeholderWarningText: {
    color: '#FF9500',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  tagPill: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
  },
  tagPillText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  subjectBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  subjectContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  subjectLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  subjectValue: {
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  editorContainer: {
    flex: 1,
    padding: 12,
  },
  textArea: {
    flex: 1,
    fontSize: 14,
    lineHeight: 22,
    padding: 16,
    borderRadius: 16,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
});
