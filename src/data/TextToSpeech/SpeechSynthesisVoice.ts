import type { VoiceProps } from "../../models/voiceTypes";

export default class {
  _default = false
  _gender: string;
  _lang: string;
  _localService = false;
  _name: string;
  _voiceURI: string;

  constructor({ gender, lang, voiceURI }: VoiceProps) {
    this._gender = gender;
    this._lang = lang;
    this._name = voiceURI;
    this._voiceURI = voiceURI;
  }

  get default() {
    return this._default;
  }

  get gender() {
    return this._gender;
  }

  get lang() {
    return this._lang;
  }

  get localService() {
    return this._localService;
  }

  get name() {
    return this._name;
  }

  get voiceURI() {
    return this._voiceURI;
  }
}
