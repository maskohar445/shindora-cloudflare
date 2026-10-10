// Smart TV Device Detection and Remote Control Key Codes Helper

export const TV_KEYCODES = {
  // Navigation / D-Pad
  UP: 38,
  DOWN: 40,
  LEFT: 37,
  RIGHT: 39,
  ENTER: 13,
  OK: 13,

  // Remote Back / Return keys across Tizen, webOS, Android TV, FireTV
  BACK: 8,
  ESCAPE: 27,
  TIZEN_BACK: 10009,
  WEBOS_BACK: 461,
  ANDROID_BACK: 4,

  // Media Playback Remote Keys
  MEDIA_PLAY: 415,
  MEDIA_PAUSE: 19,
  MEDIA_STOP: 413,
  MEDIA_FAST_FORWARD: 417,
  MEDIA_REWIND: 412,
  MEDIA_PLAY_PAUSE: 10252,

  // TV Color Keys
  RED: 403,
  GREEN: 404,
  YELLOW: 405,
  BLUE: 406
};

/**
 * Detects if the current client is a Smart TV platform
 * Supports: Android TV, Google TV, Samsung Tizen, LG webOS, Apple TV, Fire TV, Roku, HbbTV, Viera, Bravia, etc.
 */
export function isSmartTVDevice() {
  if (typeof window === 'undefined') return false;

  const ua = (navigator.userAgent || navigator.vendor || window.opera || '').toLowerCase();

  const tvKeywords = [
    'smarttv',
    'smart-tv',
    'googletv',
    'android tv',
    'tizen',
    'web0s',
    'webos',
    'appletv',
    'hbbtv',
    'viera',
    'bravia',
    'netcast',
    'roku',
    'firetv',
    'aftb',
    'aftt',
    'aftm',
    'afts',
    'pov_tv',
    'hisense',
    'opera tv',
    'philipstv',
    'sony_tv',
    'crkey', // Chromecast
    'tv safari',
    'large screen'
  ];

  for (const keyword of tvKeywords) {
    if (ua.includes(keyword)) {
      return true;
    }
  }

  return false;
}

/**
 * Checks if TV Mode is active (either via device detection or manual user toggle)
 */
export function getIsTVModeActive() {
  if (typeof window === 'undefined') return false;

  try {
    const saved = localStorage.getItem('shindora-tv-mode');
    if (saved !== null) {
      return saved === 'true';
    }
    // Auto-detect if device is a Smart TV
    return isSmartTVDevice();
  } catch (e) {
    return false;
  }
}

/**
 * Sets TV Mode preference
 */
export function setTVModeActive(isActive) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem('shindora-tv-mode', isActive ? 'true' : 'false');
  } catch (e) {}
}
