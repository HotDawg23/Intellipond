export const SENSOR_OFFLINE_AFTER_MINUTES = 5;

const SENSOR_OFFLINE_AFTER_MS = SENSOR_OFFLINE_AFTER_MINUTES * 60 * 1000;

export function isSensorOffline(lastSync: string | null, now = Date.now()) {
  if (!lastSync) return true;

  const age = now - Date.parse(lastSync);
  return !Number.isFinite(age) || age > SENSOR_OFFLINE_AFTER_MS;
}
