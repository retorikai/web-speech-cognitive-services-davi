export default class CustomSpeechSynthesisEvent extends SpeechSynthesisEvent {
  constructor(data) {
    super(data);
    if (data.duration) {
      this.duration = data.duration;
    }
  }
}