/*
 * PERDE — Fragman bağlantısı dönüştürücüsü
 * Görev: YouTube, Vimeo, Dailymotion, Streamable ve Twitch bağlantılarını
 * gömülü oynatıcı adreslerine dönüştürür.
 * Kullanım: window.cineTrailerEmbedUrl(url, provider) global fonksiyonunu sağlar.
 */

window.cineTrailerEmbedUrl = function(rawUrl, preferredProvider) {
  const value = String(rawUrl || '').trim();
  if (!value) return '';
  let url;
  try { url = new URL(value); } catch (_) { return value; }
  const host = url.hostname.toLowerCase().replace(/^www\./, '');
  let provider = preferredProvider || 'auto';
  if (provider === 'auto') {
    if (host === 'youtu.be' || host.includes('youtube.com') || host === 'youtube-nocookie.com') provider = 'youtube';
    else if (host === 'vimeo.com' || host === 'player.vimeo.com') provider = 'vimeo';
    else if (host.includes('dailymotion.com') || host === 'dai.ly') provider = 'dailymotion';
    else if (host === 'streamable.com') provider = 'streamable';
    else if (host.includes('twitch.tv')) provider = 'twitch';
    else provider = 'embed';
  }
  const pathParts = url.pathname.split('/').filter(Boolean);
  if (provider === 'youtube') {
    const id = host === 'youtu.be' ? pathParts[0] : (url.searchParams.get('v') || (pathParts[0] === 'embed' || pathParts[0] === 'shorts' ? pathParts[1] : ''));
    return id ? 'https://www.youtube-nocookie.com/embed/' + encodeURIComponent(id) + '?autoplay=1&rel=0' : value;
  }
  if (provider === 'vimeo') {
    const id = pathParts.find(part => /^\d+$/.test(part));
    return id ? 'https://player.vimeo.com/video/' + id + '?autoplay=1' : value;
  }
  if (provider === 'dailymotion') {
    const id = host === 'dai.ly' ? pathParts[0] : (pathParts[0] === 'embed' && pathParts[1] === 'video' ? pathParts[2] : (pathParts[0] === 'video' ? pathParts[1] : ''));
    return id ? 'https://www.dailymotion.com/embed/video/' + encodeURIComponent(id) + '?autoplay=1' : value;
  }
  if (provider === 'streamable') {
    const id = pathParts[0] === 'e' ? pathParts[1] : pathParts[0];
    return id ? 'https://streamable.com/e/' + encodeURIComponent(id) : value;
  }
  if (provider === 'twitch') {
    const clipIndex = pathParts.indexOf('clip');
    if (host === 'clips.twitch.tv' || clipIndex >= 0) {
      const slug = host === 'clips.twitch.tv' ? pathParts[0] : pathParts[clipIndex + 1];
      return slug ? 'https://clips.twitch.tv/embed?clip=' + encodeURIComponent(slug) + '&parent=megamrtklc.github.io&autoplay=true' : value;
    }
    const videoIndex = pathParts.indexOf('videos');
    return videoIndex >= 0 && pathParts[videoIndex + 1] ? 'https://player.twitch.tv/?video=v' + encodeURIComponent(pathParts[videoIndex + 1]) + '&parent=megamrtklc.github.io&autoplay=true' : value;
  }
  return value;
};
