let mediaRecorder = null;
let recordedChunks = [];
let audioStream = null;
let audioContext = null;

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.target !== 'offscreen') return false;

  if (msg.type === 'START_RECORDING') {
    startRecording(msg.streamId, msg.mute)
      .then((res) => sendResponse({ ok: true, res }))
      .catch((err) => sendResponse({ ok: false, error: String(err.message || err) }));
    return true;
  }

  if (msg.type === 'STOP_RECORDING') {
    stopRecording()
      .then((data) => sendResponse({ ok: true, data }))
      .catch((err) => sendResponse({ ok: false, error: String(err.message || err) }));
    return true;
  }

  return false;
});

async function startRecording(streamId, mute = false) {
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    throw new Error('already_recording');
  }

  audioStream = await navigator.mediaDevices.getUserMedia({
    audio: {
      mandatory: {
        chromeMediaSource: 'tab',
        chromeMediaSourceId: streamId
      }
    },
    video: false
  });

  if (!mute) {
    try {
      audioContext = new AudioContext();
      const source = audioContext.createMediaStreamSource(audioStream);
      source.connect(audioContext.destination);
    } catch (e) {
      console.warn('AudioContext passthrough failed:', e);
    }
  }

  recordedChunks = [];
  const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
    ? 'audio/webm;codecs=opus'
    : 'audio/webm';

  mediaRecorder = new MediaRecorder(audioStream, { mimeType });
  mediaRecorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) recordedChunks.push(e.data);
  };

  mediaRecorder.start(500);
  return { mimeType, startedAt: Date.now() };
}

async function stopRecording() {
  if (!mediaRecorder || mediaRecorder.state === 'inactive') {
    throw new Error('no_active_recording');
  }

  return new Promise((resolve, reject) => {
    mediaRecorder.onstop = async () => {
      try {
        const blob = new Blob(recordedChunks, { type: mediaRecorder.mimeType });
        const reader = new FileReader();
        reader.onloadend = () => {
          const res = String(reader.result || '');
          const base64 = res.includes(',') ? res.split(',')[1] : res;
          if (audioStream) {
            audioStream.getTracks().forEach((t) => t.stop());
            audioStream = null;
          }
          if (audioContext) {
            audioContext.close().catch(() => {});
            audioContext = null;
          }
          mediaRecorder = null;
          recordedChunks = [];
          resolve({ base64, mimeType: blob.type, size: blob.size });
        };
        reader.onerror = () => reject(new Error('failed_to_read_blob'));
        reader.readAsDataURL(blob);
      } catch (e) {
        reject(e);
      }
    };
    mediaRecorder.stop();
  });
}
