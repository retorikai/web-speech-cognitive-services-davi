export default class {
  constructor(audioContext) {
    this.audioContext = audioContext;
    this.bufferSource = null;
  }

  pause() {
    this.audioContext && this.audioContext.suspend();
  }

  resume() {
    this.audioContext && this.audioContext.resume();
  }

  /* eslint-disable no-await-in-loop */
  async start(queue) {
    let audioBuffer;

    while ((audioBuffer = queue.shift())) {
      if (!(audioBuffer instanceof ArrayBuffer)) {
        console.error('Invalid audio data:', audioBuffer);
        continue;
      }

      const decodedAudioBuffer = await this._createAudioBuffer(audioBuffer);
      this.bufferSource = this.audioContext.createBufferSource();
      this.bufferSource.buffer = decodedAudioBuffer;
      this.bufferSource.connect(this.audioContext.destination);

      const playPromise = new Promise(resolve => {
        this.bufferSource.onended = () => {
          this.bufferSource = null;
          resolve();
        };
      });

      this.bufferSource.start();
      await playPromise;
    }
  }

  stop() {
    if (this.bufferSource) {
      this.bufferSource.stop();
      this.bufferSource = null;
    }

    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume();
    }
  }

  // Helper function to create an AudioBuffer from raw audio data
  _createAudioBuffer(audioData) {
    return new Promise((resolve, reject) => {
      this.audioContext.decodeAudioData(audioData, resolve, reject);
    });
  }
}
