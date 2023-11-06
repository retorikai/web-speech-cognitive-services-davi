export default class {
  audioContext: AudioContext;
  bufferSource: AudioBufferSourceNode | null = null

  constructor(audioContext: AudioContext) {
    this.audioContext = audioContext;
  }

  pause(): void {
    this.audioContext && this.audioContext.suspend();
  }

  resume(): void {
    this.audioContext && this.audioContext.resume();
  }

  /* eslint-disable no-await-in-loop */
  async start(queue): Promise<void> {
    let audioBuffer: ArrayBuffer;

    while ((audioBuffer = queue.shift())) {
      if (!(audioBuffer instanceof ArrayBuffer)) {
        console.error('Invalid audio data:', audioBuffer);
        continue;
      }

      const decodedAudioBuffer = await this._createAudioBuffer(audioBuffer);
      this.bufferSource = this.audioContext.createBufferSource();
      this.bufferSource.buffer = decodedAudioBuffer;
      this.bufferSource.connect(this.audioContext.destination);

      const playPromise = new Promise<void>(resolve => {
        this.bufferSource && (this.bufferSource.onended = () => {
          this.bufferSource = null;
          resolve();
        });
      });

      this.bufferSource.start();
      await playPromise;
    }
  }

  stop(): void {
    if (this.bufferSource) {
      this.bufferSource.stop();
      this.bufferSource = null;
    }

    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume();
    }
  }

  // Helper function to create an AudioBuffer from raw audio data
  _createAudioBuffer(audioData): Promise<any> {
    return new Promise((resolve, reject) => {
      this.audioContext.decodeAudioData(audioData, resolve, reject);
    });
  }
}
