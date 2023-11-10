const ADD_SPEECH_RECOGNITION_EVENT = 'ADD_SPEECH_RECOGNITION_EVENT';

export default function addSpeechRecognitionEvent(event) {
  let serializedEvent;

  switch (event.type) {
    case 'error':
      serializedEvent = {
        type: 'error',
        results: event.message
      };
      break;

    case 'result':
      serializedEvent = {
        type: 'result',
        results: event.results
      };
      break;

    default:
      serializedEvent = {
        type: event.type
      };
      break;
  }

  return {
    type: ADD_SPEECH_RECOGNITION_EVENT,
    payload: { event: serializedEvent }
  };
}

export { ADD_SPEECH_RECOGNITION_EVENT };
