import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface AppConfig {
  webhookUrl: string;
  delaySeconds: number;
  noticePeriod: string;
  roleTitle: string;
  candidateName: string;
}

export const DEFAULT_CONFIG: AppConfig = {
  webhookUrl:
    'https://script.google.com/macros/s/AKfycby09VIpY0QFWH1bSuV1sRLl_sCMpYDU85ObUDoa72n0wsM09VMLVXvlBVVH4Kx6Jo4Btg/exec',
  delaySeconds: 3,
  noticePeriod: '15 Days Notice Period',
  roleTitle: 'Full Stack Developer',
  candidateName: 'Himanshu A. Chauhan',
};

const STORAGE_KEY = '@job_finding_app_config_v1';

interface ConfigContextType {
  config: AppConfig;
  isLoaded: boolean;
  updateConfig: (newValues: Partial<AppConfig>) => Promise<void>;
  resetConfig: () => Promise<void>;
}

const ConfigContext = createContext<ConfigContextType>({
  config: DEFAULT_CONFIG,
  isLoaded: false,
  updateConfig: async () => {},
  resetConfig: async () => {},
});

export function ConfigProvider({ children }: { children: React.ReactNode }) {
  const [config, setConfig] = useState<AppConfig>(DEFAULT_CONFIG);
  const [isLoaded, setIsLoaded] = useState<boolean>(false);

  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          setConfig((prev) => ({ ...prev, ...parsed }));
        }
      } catch (err) {
        console.warn('Failed to load settings from storage', err);
      } finally {
        setIsLoaded(true);
      }
    })();
  }, []);

  const updateConfig = async (newValues: Partial<AppConfig>) => {
    setConfig((prev) => {
      const updated = { ...prev, ...newValues };
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated)).catch((err) =>
        console.warn('Failed to save settings', err)
      );
      return updated;
    });
  };

  const resetConfig = async () => {
    setConfig(DEFAULT_CONFIG);
    await AsyncStorage.removeItem(STORAGE_KEY);
  };

  return (
    <ConfigContext.Provider value={{ config, isLoaded, updateConfig, resetConfig }}>
      {children}
    </ConfigContext.Provider>
  );
}

export function useConfig() {
  return useContext(ConfigContext);
}
