import { call, put, race, take, takeEvery } from 'redux-saga/effects';

import { SET_PONYFILL } from '../actions/setPonyfill';
import setSpeechSynthesisNativeVoices from '../actions/setSpeechSynthesisNativeVoices';

import createPromiseQueue from '../utils/createPromiseQueue';

function getVoicesPromise(speechSynthesis) {
  return new Promise(resolve => {
    const voices = speechSynthesis.getVoices();
    if (Array.isArray(voices) && voices.length > 0) {
      resolve(voices);
    } else {
      speechSynthesis.onvoiceschanged = () => {
        const updatedVoices = speechSynthesis.getVoices();
        if (Array.isArray(updatedVoices) && updatedVoices.length > 0) {
          resolve(updatedVoices);
        }
      };
    }
  });
}

export default function* speechSynthesisSetNativeVoicesSaga() {
  yield takeEvery(SET_PONYFILL, function* ({ payload: { ponyfill: { speechSynthesis } = {} } }) {
    if (!speechSynthesis) {
      return;
    }

    console.warn('Getting speech synthesis voices...');
    const events = createPromiseQueue();
    try {
      speechSynthesis.onvoiceschanged = events.push;
      events.push();

      for (;;) {
        console.warn('Waiting for voices or stop signal...');
        const { voices } = yield race({
          voices: call(getVoicesPromise, speechSynthesis),
          stop: take(SET_PONYFILL)
        });

        if (voices) {
          console.warn('Found speech synthesis voices:', voices);
          yield put(setSpeechSynthesisNativeVoices(voices));
          break;
        }
      }
    } catch (error) {
      console.error('Error getting speech synthesis voices:', error);
    }
  });
}
