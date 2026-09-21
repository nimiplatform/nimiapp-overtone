import { executePcmWorkerRequest, pcmWorkerReplyTransfers, type PcmWorkerRequest } from '@nimiplatform/kit/core/audio';

// This App bundles the Worker; all PCM operations stay in the shared Kit owner.
self.onmessage = (event: MessageEvent<PcmWorkerRequest>) => {
  const reply = executePcmWorkerRequest(event.data);
  self.postMessage(reply, { transfer: pcmWorkerReplyTransfers(reply) });
};
