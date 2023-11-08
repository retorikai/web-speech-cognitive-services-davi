/* eslint no-empty: ["error", { "allowEmptyCatch": true }] */
import SpeechSynthesisVoice from './SpeechSynthesisVoice';
import type { SpeechSynthesisEventProps } from '../../models/speechtypes'

class SpeechSynthesisUtterance extends EventTarget {
  _lang: string | undefined = undefined;
  _pitch: number | undefined = 1;
  _rate: number | undefined = 1;
  _voice: SpeechSynthesisVoice | undefined = undefined;
  _volume: number | undefined = 1;
  text: string;

  constructor(text: string) {
    super();

    this.text = text;
  }

  get lang(): string | undefined {
    return this._lang;
  }

  set lang(value: string | undefined) {
    this._lang = value;
  }

  get pitch(): number | undefined {
    return this._pitch;
  }

  set pitch(value: number) {
    this._pitch = value;
  }

  get rate(): number | undefined {
    return this._rate;
  }

  set rate(value: number) {
    this._rate = value;
  }

  get voice(): SpeechSynthesisVoice | undefined {
    return this._voice;
  }

  set voice(value: SpeechSynthesisVoice | undefined) {
    this._voice = value;
  }

  get volume(): number | undefined {
    return this._volume;
  }

  set volume(value: number) {
    this._volume = value;
  }

  onstart(): void {}

  onend(): void {}

  onerror(error: any): void { console.log(error) }

  onsynthesisstart(): void {}

  onsynthesiscompleted(): void {}

  onboundary(data: SpeechSynthesisEventProps): void { console.log(data) }

  onviseme(data: SpeechSynthesisEventProps): void { console.log(data) }

  onmark(data: SpeechSynthesisEventProps): void { console.log(data) }
}

export default SpeechSynthesisUtterance;
