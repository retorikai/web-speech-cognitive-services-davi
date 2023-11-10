import { call, fork, put, takeLatest } from 'redux-saga/effects';

import addSpeechRecognitionEvent from '../actions/addSpeechRecognitionEvent';
import { SET_SPEECH_RECOGNITION_INSTANCE } from '../actions/setSpeechRecognitionInstance';

import createPromiseQueue from '../utils/createPromiseQueue';
import forever from './effects/forever';

let timer
const timeout = 2000

export default function* speechRecognitionSetInstanceSaga() {
  const events = createPromiseQueue();

  yield fork(function*() {
    for (;;) {
      const event = yield call(events.shift);

      if (event) {
        yield put(addSpeechRecognitionEvent(event));
      }
    }
  });

  yield takeLatest(SET_SPEECH_RECOGNITION_INSTANCE, function*({ payload: { speechRecognition } }) {
    try {
      speechRecognition.onresult = event => {
        event && events.push({ type: 'result', results: event })
        timer && clearTimeout(timer)
        timer = setTimeout(() => {
          !speechRecognition.continuous && speechRecognition.abort()
        }, timeout)
      }
      speechRecognition.onaudiostart = () => {
        events.push({ type: 'audiostart' })
      }
      speechRecognition.onsoundstart = () => {
        events.push({ type: 'soundstart' })
      }
      speechRecognition.onspeechstart = () => {
        events.push({ type: 'speechstart' })
      }
      speechRecognition.onspeechend = () => {
        events.push({ type: 'speechend' })
      }
      speechRecognition.onsoundend = () => {
        events.push({ type: 'soundend' })
      }
      speechRecognition.onaudioend = () => {
        events.push({ type: 'audioend' })
      }
      speechRecognition.onerror = event => {
        events.push({ type: 'error', message: event })
      }
      speechRecognition.onstart = () => {
        events.push({ type: 'start' })
      }
      speechRecognition.onend = () => {
        events.push({ type: 'end' })
      }
      
      yield forever();
    } finally {
      while (events.keys) {
        events.shift()
      }
    }
  });
}
