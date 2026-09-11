// @nimi-authority: rule.overtone.exploration.r003
export function encodeTrimmedWav(buffer: AudioBuffer, start: number, end: number): ArrayBuffer {
  if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end > buffer.duration || end <= start) {
    throw new Error('OVERTONE_TRIM_INVALID');
  }
  const from = Math.floor(start * buffer.sampleRate);
  const until = Math.min(buffer.length, Math.floor(end * buffer.sampleRate));
  const frames = until - from;
  if (frames < 1) throw new Error('OVERTONE_TRIM_INVALID');
  const channels = buffer.numberOfChannels;
  const dataBytes = frames * channels * 2;
  const bytes = new ArrayBuffer(44 + dataBytes);
  const view = new DataView(bytes);
  const ascii = (offset: number, text: string) => { for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i)); };
  ascii(0, 'RIFF'); view.setUint32(4, 36 + dataBytes, true); ascii(8, 'WAVE');
  ascii(12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true);
  view.setUint16(22, channels, true); view.setUint32(24, buffer.sampleRate, true);
  view.setUint32(28, buffer.sampleRate * channels * 2, true); view.setUint16(32, channels * 2, true);
  view.setUint16(34, 16, true); ascii(36, 'data'); view.setUint32(40, dataBytes, true);
  const source = Array.from({ length: channels }, (_, channel) => buffer.getChannelData(channel));
  let offset = 44;
  for (let frame = from; frame < until; frame++) {
    for (const channel of source) {
      const sample = Math.max(-1, Math.min(1, channel[frame] ?? 0));
      view.setInt16(offset, Math.round(sample < 0 ? sample * 32768 : sample * 32767), true);
      offset += 2;
    }
  }
  return bytes;
}

export function downloadAudio(bytes: ArrayBuffer, mime: string, title: string, extension: string): void {
  const url = URL.createObjectURL(new Blob([bytes], { type: mime }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `${title.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_').slice(0, 80) || 'overtone'}.${extension}`;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 30000);
}
