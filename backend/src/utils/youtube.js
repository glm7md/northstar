'use strict';

const YOUTUBE_ID_REGEX = /^[A-Za-z0-9_-]{10,12}$/;

function extractYouTubeId(input) {
  const value = String(input || '').trim();
  if (!value) return null;

  if (YOUTUBE_ID_REGEX.test(value)) return value;

  let url;
  try {
    url = new URL(value);
  } catch {
    return null;
  }

  const host = url.hostname.replace(/^www\.|^m\./, '').toLowerCase();

  if (host === 'youtu.be') {
    const id = url.pathname.split('/').filter(Boolean)[0];
    return id && YOUTUBE_ID_REGEX.test(id) ? id : null;
  }

  if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    if (url.pathname === '/watch') {
      const id = url.searchParams.get('v');
      return id && YOUTUBE_ID_REGEX.test(id) ? id : null;
    }
    const segments = url.pathname.split('/').filter(Boolean);
    if (segments.length >= 2 && ['embed', 'shorts', 'live'].includes(segments[0])) {
      const id = segments[1];
      return id && YOUTUBE_ID_REGEX.test(id) ? id : null;
    }
  }

  return null;
}

module.exports = { extractYouTubeId };