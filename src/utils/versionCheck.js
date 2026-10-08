import Constants from 'expo-constants';

/**
 * Compare two semver strings (e.g. "1.0.4" vs "1.0.5")
 * Returns true if currentVersion is strictly older than targetVersion.
 */
export const isVersionOlder = (currentVersion, targetVersion) => {
  if (!targetVersion || !currentVersion) return false;

  const v1 = String(currentVersion).trim().split('.').map((num) => parseInt(num, 10) || 0);
  const v2 = String(targetVersion).trim().split('.').map((num) => parseInt(num, 10) || 0);

  const maxLen = Math.max(v1.length, v2.length);
  for (let i = 0; i < maxLen; i++) {
    const num1 = v1[i] || 0;
    const num2 = v2[i] || 0;
    if (num1 < num2) return true;  // Installed version is older!
    if (num1 > num2) return false;
  }
  return false;
};

export const getInstalledAppVersion = () => {
  return Constants.expoConfig?.version || '1.0.6';
};
