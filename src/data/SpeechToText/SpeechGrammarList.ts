/* eslint class-methods-use-this: "off" */

export default class {
  _phrases: Array<string> = [];

  addFromString(): void {
    throw new Error('JSGF is not supported');
  }

  get phrases(): Array<string> {
    return this._phrases;
  }

  set phrases(value: Array<string> | string) {
    if (Array.isArray(value)) {
      this._phrases = value;
    } else if (typeof value === 'string') {
      this._phrases = [value];
    } else {
      throw new Error(`The provided value is not an array or of type 'string'`);
    }
  }
}
