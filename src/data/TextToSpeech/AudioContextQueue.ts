/* eslint no-await-in-loop: "off" */
import memoize from 'memoize-one';
import AudioContextConsumer from './AudioContextConsumer';

export default class {
  consumer: AudioContextConsumer | null = null;
  paused = false;
  queue: Array<ArrayBuffer> = []

  getAudioContext: Function

  constructor({ audioContext, ponyfill }) {
    this.getAudioContext = memoize(() => audioContext || new ponyfill.AudioContext());
  }

  pause(): void {
    this.paused = true;
    this.consumer && this.consumer.pause();
  }

  push(audioBuffer: ArrayBuffer): void {
    this.queue.push(audioBuffer);
    this.startConsumer();
  }

  resume(): void {
    this.paused = false;

    if (this.consumer) {
      this.consumer.resume();
    } else {
      this.startConsumer();
    }
  }

  get speaking(): boolean {
    return !!this.consumer;
  }

  async startConsumer(): Promise<void> {
    while (!this.paused && this.queue.length && !this.consumer) {
      this.consumer = new AudioContextConsumer(this.getAudioContext());

      await this.consumer.start(this.queue);

      this.consumer = null;
    }
  }

  stop(): void {
    this.queue.splice(0);
    this.consumer && this.consumer.stop();
  }
}
