/* eslint class-methods-use-this: "off" */
/* eslint complexity: ["error", 70] */
/* eslint no-await-in-loop: "off" */
/* eslint no-empty-function: "off" */
/* eslint no-magic-numbers: ["error", { "ignore": [0, 100, 150] }] */

import cognitiveServiceEventResultToWebSpeechRecognitionResultList from './cognitiveServiceEventResultToWebSpeechRecognitionResultList';
import createPromiseQueue from '../../utils/createPromiseQueue';
import patchOptions from '../patchOptions';
import SpeechGrammarList from './SpeechGrammarList';
import * as SDK from 'microsoft-cognitiveservices-speech-sdk';
import type {
  SpeechRecognitionResultListItem,
  SpeechRecognitionResultList,
  SpeechRecognitionResultParsed
} from '../../models/speechtypes';
import type { SpeechRecognitionProps } from '../../models/ponyfillTypes';
import type { PatchOptions } from '../../models/credentialTypes';
import { DynamicGrammarBuilder } from 'microsoft-cognitiveservices-speech-sdk/distrib/lib/src/common.speech/DynamicGrammarBuilder';

interface AudioConfigImpl extends SDK.AudioConfig {
  attach: Function;
  detach: Function;
  events: any;
}

// https://docs.microsoft.com/en-us/javascript/api/microsoft-cognitiveservices-speech-sdk/speechconfig?view=azure-node-latest#outputformat
// {
//   "RecognitionStatus": "Success",
//   "Offset": 900000,
//   "Duration": 49000000,
//   "NBest": [
//     {
//       "Confidence": 0.738919,
//       "Lexical": "second",
//       "ITN": "second",
//       "MaskedITN": "second",
//       "Display": "Second."
//     }
//   ]
// }

// {
//   "RecognitionStatus": "InitialSilenceTimeout",
//   "Offset": 50000000,
//   "Duration": 0
// }

// const { AudioConfig, OutputFormat, ResultReason, SpeechConfig, SpeechRecognizer } = SDK;

function serializeRecognitionResult({
  duration,
  errorDetails,
  json,
  offset,
  properties,
  reason,
  resultId,
  text
}): SpeechRecognitionResultParsed {
  return {
    duration,
    errorDetails,
    json: JSON.parse(json),
    offset,
    properties,
    reason,
    resultId,
    text
  };
}

function averageAmplitude(arrayBuffer: ArrayBuffer) {
  const array = new Int16Array(arrayBuffer);

  return array.reduce((averageAmplitude, amplitude) => averageAmplitude + Math.abs(amplitude), 0) / array.length;
}

function cognitiveServicesAsyncToPromise(fn: Function): any {
  return (...args) => new Promise((resolve, reject) => fn(...args, resolve, reject));
}

function prepareAudioConfig(audioConfig: AudioConfigImpl) {
  const originalAttach = audioConfig.attach;
  const boundOriginalAttach = audioConfig.attach.bind(audioConfig);
  let firstChunk = false;
  let muted = false;

  // We modify "attach" function and detect when audible chunk is read.
  // We will only modify "attach" function once.
  audioConfig.attach = async () => {
    const reader = await boundOriginalAttach();

    return {
      ...reader,
      read: async () => {
        const chunk = await reader.read();

        // The magic number 150 is measured by:
        // 1. Set microphone volume to 0
        // 2. Observe the amplitude (100-110) for the first few chunks
        //    (There is a short static caught when turning on the microphone)
        // 3. Set the number a bit higher than the observation

        if (!firstChunk && averageAmplitude(chunk.buffer) > 150) {
          audioConfig.events.onEvent({ name: 'FirstAudibleChunk' });
          firstChunk = true;
        }

        if (muted) {
          return { buffer: new ArrayBuffer(0), isEnd: true, timeReceived: Date.now() };
        }

        return chunk;
      }
    };
  };

  return {
    audioConfig,
    pause: () => {
      muted = true;
    },
    unprepare: () => {
      audioConfig.attach = originalAttach;
    }
  };
}

class SpeechRecognition {
  audioConfig: SDK.AudioConfig | null = null;
  speechConfig: SDK.SpeechConfig | null = null;
  recognizer: SDK.SpeechRecognizer | null = null;

  enableTelemetry = true;
  looseEvents = false;
  referenceGrammars: any;
  textNormalization: string = 'display';

  started = false;

  private _autoStart = false;
  private _passive = false;
  private _wakeWords: Array<string>;
  private _continuous = false;
  private _interimResults = false;
  private _lang: string;
  private _grammars: SpeechGrammarList = new SpeechGrammarList();
  private _maxAlternatives = 1;
  private _debug = false;

  constructor(options: PatchOptions, data?: SpeechRecognitionProps) {
    this._autoStart = !!data?.autoStart;
    this._passive = !!data?.passive;
    this._wakeWords = data?.wakeWords || [];
    this._continuous = data?.continuous || false;
    data?.interimResults && (this._interimResults = true);
    this._lang = data?.lang
      ? data.lang
      : typeof window !== 'undefined'
      ? window.document.documentElement.getAttribute('lang') || window.navigator.language
      : 'en-US';
    data?.grammarsList && (this._grammars.phrases = data.grammarsList);
    this._debug = !!data?.debug || false;

    const {
      audioConfig = SDK.AudioConfig.fromDefaultMicrophoneInput(),
      // We set telemetry to true to honor the default telemetry settings of Speech SDK
      // https://github.com/Microsoft/cognitive-services-speech-sdk-js#data--telemetry
      enableTelemetry = true,
      fetchCredentials,
      looseEvents,
      referenceGrammars,
      speechRecognitionEndpointId,
      textNormalization = 'display'
    } = patchOptions(options);

    this.enableTelemetry = enableTelemetry;
    this.looseEvents = !!looseEvents;
    this.referenceGrammars = referenceGrammars;
    this.textNormalization = textNormalization;

    if (!audioConfig && (!window.navigator.mediaDevices || !window.navigator.mediaDevices.getUserMedia)) {
      console.warn(
        'web-speech-cognitive-services: This browser does not support WebRTC and it will not work with Cognitive Services Speech Services.'
      );
    } else {
      this.audioConfig = audioConfig;

      this.initRecognizer(fetchCredentials, speechRecognitionEndpointId);
    }
  }

  get passive() {
    return this._passive;
  }

  set passive(value) {
    this._passive = value;
  }
  
  get wakeWords() {
    return this._wakeWords;
  }

  set wakeWords(value) {
    this._wakeWords = value;
  }

  get continuous() {
    return this._continuous;
  }

  set continuous(value) {
    this._continuous = value;
  }

  get grammars() {
    return this._grammars;
  }

  set grammars(value) {
    if (value instanceof SpeechGrammarList) {
      this._grammars = value;
    } else {
      throw new Error(`The provided value is not of type 'SpeechGrammarList'`);
    }
  }

  get interimResults() {
    return this._interimResults;
  }

  set interimResults(value) {
    this._interimResults = value;
  }

  get maxAlternatives() {
    return this._maxAlternatives;
  }

  set maxAlternatives(value) {
    this._maxAlternatives = value;
  }

  get lang() {
    return this._lang;
  }

  set lang(value) {
    this._lang = value;
  }

  onstart = (): void => {};
  onend = (): void => {};

  onaudiostart = (): void => {};
  onaudioend = (): void => {};

  onsoundstart = (): void => {};
  onsoundend = (): void => {};

  onspeechstart = (): void => {};
  onspeechend = (): void => {};

  onerror = (value: any): void => {
    console.log('Error : ', value);
  };
  onabort = (): void => {
    this._debug && console.log('Recognition aborted');
  }

  onresult = (value: Array<SpeechRecognitionResultListItem> | SpeechRecognitionResultList): void => {
    this._debug && console.log('Result : ', value);
  };

  onpassiveresult = (value: Array<SpeechRecognitionResultListItem> | SpeechRecognitionResultList): void => {
    this._debug && console.log('Passive Result : ', value);
  };

  onwakeup = (): void => {
    this._debug && console.log('Wake up !');
  };

  start = (): void => {
    this._startOnce().catch(err => {
      new Error(`error : ${err.message}\ncallstack : ${err.stack}`);
    });
  };

  abort: Function | undefined = undefined;
  stop: Function | undefined = undefined;

  /**
   * Retrieval of credentials, initialization of speechConfig and start recognizing
   * @param fetchCredentials Function
   * @param speechRecognitionEndpointId string | undefined
   */
  initRecognizer = async (fetchCredentials: Function, speechRecognitionEndpointId?: string): Promise<void> => {
    const {
      authorizationToken,
      region = 'westus',
      speechRecognitionHostname,
      subscriptionKey
    } = await fetchCredentials();

    if (speechRecognitionHostname) {
      if (authorizationToken) {
        this.speechConfig = SDK.SpeechConfig.fromHost(new URL(`wss://${speechRecognitionHostname}`));
        this.speechConfig.authorizationToken = authorizationToken;
      } else {
        this.speechConfig = SDK.SpeechConfig.fromHost(new URL(`wss://${speechRecognitionHostname}`), subscriptionKey);
      }
    } else if (region && (authorizationToken || subscriptionKey)) {
      this.speechConfig = authorizationToken
        ? SDK.SpeechConfig.fromAuthorizationToken(authorizationToken, region)
        : subscriptionKey
        ? SDK.SpeechConfig.fromSubscription(subscriptionKey, region)
        : null;
    }

    if (this.speechConfig) {
      if (speechRecognitionEndpointId && this.speechConfig) {
        this.speechConfig.endpointId = speechRecognitionEndpointId;
      }

      this.speechConfig.outputFormat = SDK.OutputFormat.Detailed;
      this.speechConfig.speechRecognitionLanguage = this._lang || 'en-US';

      this._autoStart && this.start();
    }
  };

  /**
   * Create a new Synthesizer from audioConfig / speechConfig / lang
   * @param lang string
   */
  createRecognizer = async (): Promise<void> => {
    if (this.audioConfig && this.speechConfig) {
      this.speechConfig.speechRecognitionLanguage = this._lang;
      this.recognizer = new SDK.SpeechRecognizer(this.speechConfig, this.audioConfig);

      // Add grammars
      const { dynamicGrammar } = this.recognizer.internalData as any;
      this.referenceGrammars &&
        this.referenceGrammars.length &&
        (dynamicGrammar as DynamicGrammarBuilder).addReferenceGrammar(this.referenceGrammars);
      
      // Add phrases
      const { phrases } = this._grammars;
      if (phrases && phrases.length) {
        const phraseList = SDK.PhraseListGrammar.fromRecognizer(this.recognizer);
        phrases.forEach((phrase) => {
          phraseList.addPhrase(phrase);
        })
      };
    } else {
      this.recognizer = null;
    }
  };

  /**
   * Stop current recognizer, change language and start a new recognition
   * @param lang string
   */
  changeLanguage = async (lang?: string): Promise<void> => {
    if (this.recognizer && this.audioConfig && this.speechConfig && lang && lang !== this._lang) {
      // Stop current recognition and start a new one
      await cognitiveServicesAsyncToPromise(this.recognizer.stopContinuousRecognitionAsync.bind(this.recognizer))();
      this._lang = lang;
      this._continuous && this.start();
    } else {
      this.recognizer = null;
    }
  };

  /**
   * In continuous mode, toggle from passive to active mode by stopping current recognition and starting a new one to prevent
   * receiving results from a current passive speech recognition.
   * If you don't care about having existing results in active recognition, just set recognition's 'passive' variable to 'false' instead
   * of using this method.
   */
  toggleContinuousPassiveToActive = async (): Promise<void> => {
    if (this._continuous && this.recognizer && this.audioConfig && this.speechConfig) {
      // Stop current recognition and start a new one
      await cognitiveServicesAsyncToPromise(this.recognizer.stopContinuousRecognitionAsync.bind(this.recognizer))();
      this._passive = false;
      this.start();
    }
  };

  processSendEvent = (type: string, data?: any): void => {
    this._debug && console.log('Speech Recognizer Event : type = ', type, '\n, data = ', data);
    switch (type) {
      case 'start':
        this.onstart && this.onstart();
        this.started = true;
        break;
      case 'end':
        this.onend && this.onend();
        this.started = false;
        break;
      case 'audiostart':
        this.onaudiostart && this.onaudiostart();
        break;
      case 'audioend':
        this.onaudioend && this.onaudioend();
        break;
      case 'soundstart':
        this.onsoundstart && this.onsoundstart();
        break;
      case 'soundend':
        this.onsoundend && this.onsoundend();
        break;
      case 'speechstart':
        this.onspeechstart && this.onspeechstart();
        break;
      case 'speechend':
        this.onspeechend && this.onspeechend();
        break;
      case 'error':
        this.onerror && this.onerror(data);
        this.started = false;
        break;
      case 'abort':
        this.onabort && this.onabort();
        this.started = false;
        break;
      case 'result':
        this.onresult && this.onresult(data.results);
        break;
      case 'passiveresult':
        this.onpassiveresult && this.onpassiveresult(data.results);
        break;
      case 'wakeup':
        this.onwakeup && this.onwakeup();
        break;
    }
  };

  async _startOnce(): Promise<void> {
    if (this.audioConfig && !this.started) {
      const { pause, unprepare } = prepareAudioConfig(this.audioConfig as AudioConfigImpl);

      const queue = createPromiseQueue();
      let soundStarted = false;
      let speechStarted = false;
      let stopping = '';

      const { detach: detachAudioConfigEvent } = (this.audioConfig as AudioConfigImpl).events.attach(event => {
        const { name } = event;

        if (name === 'AudioSourceReadyEvent') {
          queue.push({ audioSourceReady: {} });
        } else if (name === 'AudioSourceOffEvent') {
          queue.push({ audioSourceOff: {} });
        } else if (name === 'FirstAudibleChunk') {
          queue.push({ firstAudibleChunk: {} });
        }
      });

      await this.createRecognizer();

      if (this.recognizer) {
        try {
          this.recognizer.canceled = (_, { errorDetails, offset, reason, sessionId }) => {
            queue.push({
              canceled: {
                errorDetails,
                offset,
                reason,
                sessionId
              }
            });
          };

          this.recognizer.recognized = (_, { offset, result, sessionId }) => {
            queue.push({
              recognized: {
                offset,
                result: serializeRecognitionResult(result),
                sessionId
              }
            });
          };

          this.recognizer.recognizing = (_, { offset, result, sessionId }) => {
            queue.push({
              recognizing: {
                offset,
                result: serializeRecognitionResult(result),
                sessionId
              }
            });
          };

          this.recognizer.sessionStarted = (_, { sessionId }) => {
            queue.push({ sessionStarted: { sessionId } });
          };

          this.recognizer.sessionStopped = (_, { sessionId }) => {
            // "sessionStopped" is never fired, probably because we are using startContinuousRecognitionAsync instead of recognizeOnceAsync.
            queue.push({ sessionStopped: { sessionId } });
          };

          this.recognizer.speechStartDetected = (_, { offset, sessionId }) => {
            queue.push({ speechStartDetected: { offset, sessionId } });
          };

          this.recognizer.speechEndDetected = (_, { sessionId }) => {
            // "speechEndDetected" is never fired, probably because we are using startContinuousRecognitionAsync instead of recognizeOnceAsync.
            // Update: "speechEndDetected" is fired for DLSpeech.listenOnceAsync()
            queue.push({ speechEndDetected: { sessionId } });
          };
          
          await cognitiveServicesAsyncToPromise(
            this.recognizer.startContinuousRecognitionAsync.bind(this.recognizer)
          )();

          this.abort = () => queue.push({ abort: {} });
          this.stop = () => queue.push({ stop: {} });

          let audioStarted = false;
          let finalEvent: {
            type: string;
            data?: string | { results: Array<SpeechRecognitionResultListItem> | SpeechRecognitionResultList };
          } | null = null;
          let finalizedResults: Array<SpeechRecognitionResultListItem> | SpeechRecognitionResultList = [];

          for (let loop = 0; !stopping || audioStarted; loop++) {
            const event = await queue.shift();
            const {
              abort,
              audioSourceOff,
              audioSourceReady,
              canceled,
              firstAudibleChunk,
              recognized,
              recognizing,
              stop
            } = event;

            const errorMessage = canceled && canceled.errorDetails;

            if (/Permission\sdenied/u.test(errorMessage || '')) {
              // If microphone is not allowed, we should not emit "start" event.
              finalEvent = {
                data: 'not-allowed',
                type: 'error'
              };

              break;
            }

            if (!loop) {
              this.processSendEvent('start');
            }

            if (errorMessage) {
              if (/1006/u.test(errorMessage)) {
                if (!audioStarted) {
                  this.processSendEvent('audiostart');
                  this.processSendEvent('audioend');
                }

                finalEvent = {
                  data: 'network',
                  type: 'error'
                };
              } else {
                finalEvent = {
                  data: 'unknown',
                  type: 'error'
                };
              }

              break;
            } else if (abort || stop) {
              if (abort) {
                finalEvent = {
                  type: 'abort'
                };

                // If we are aborting, we will ignore lingering recognizing/recognized events. But if we are stopping, we need them.
                stopping = 'abort';
              } else {
                // When we pause, we will send { isEnd: true }, Speech Services will send us "recognized" event.
                pause();
                stopping = 'stop';
              }

              // Abort should not be dispatched without support of "stopContinuousRecognitionAsync".
              // But for defensive purpose, we make sure "stopContinuousRecognitionAsync" is available before we can call.
              if (abort && this.recognizer.stopContinuousRecognitionAsync) {
                await cognitiveServicesAsyncToPromise(
                  this.recognizer.stopContinuousRecognitionAsync.bind(this.recognizer)
                )();
              }
            } else if (audioSourceReady) {
              this.processSendEvent('audiostart');
              audioStarted = true;
            } else if (firstAudibleChunk) {
              this.processSendEvent('soundstart');
              soundStarted = true;
            } else if (audioSourceOff) {
              // Looks like we don't need this line and all the tests are still working.
              // Guessing probably stopping is already truthy.
              // stopping = true;

              speechStarted && this.processSendEvent('speechend');
              soundStarted && this.processSendEvent('soundend');
              audioStarted && this.processSendEvent('audioend');

              audioStarted = soundStarted = speechStarted = false;

              break;
            } else if (stopping !== 'abort') {
              if (recognized && recognized.result && recognized.result.reason === SDK.ResultReason.NoMatch) {
                finalEvent = {
                  data: 'no-speech',
                  type: 'error'
                };
              } else if (recognized || recognizing) {
                if (!audioStarted) {
                  // Unconfirmed prevention of quirks
                  this.processSendEvent('audiostart');
                  audioStarted = true;
                }

                if (!soundStarted) {
                  this.processSendEvent('soundstart');
                  soundStarted = true;
                }

                if (!speechStarted) {
                  this.processSendEvent('speechstart');
                  speechStarted = true;
                }

                if (recognized) {
                  const result = cognitiveServiceEventResultToWebSpeechRecognitionResultList(recognized.result, {
                    maxAlternatives: this.maxAlternatives,
                    textNormalization: this.textNormalization
                  });

                  const recognizable = !!result[0].transcript;

                  if (recognizable) {
                    finalizedResults = [...finalizedResults, ...result];

                    this.continuous &&
                      this.interimResults &&
                      this.processSendEvent('result', {
                        results: finalizedResults
                      });

                    this._passive &&
                      this.interimResults &&
                      this.processSendEvent('passiveresult', {
                        results: result
                      });
                  }

                  // If it is continuous, we just sent the finalized results. So we don't need to send it again after "audioend" event.
                  if (this.continuous && recognizable) {
                    finalEvent = null;
                  } else {
                    this.interimResults &&
                      (finalEvent = {
                        data: {
                          results: finalizedResults
                        },
                        type: 'result'
                      });
                  }

                  if (!this.continuous && this.recognizer.stopContinuousRecognitionAsync) {
                    await cognitiveServicesAsyncToPromise(
                      this.recognizer.stopContinuousRecognitionAsync.bind(this.recognizer)
                    )();
                  }

                  // If event order can be loosened, we can send the recognized event as soon as we receive it.
                  // 1. If it is not recognizable (no-speech), we should send an "error" event just before "end" event. We will not loosen "error" events.
                  if (this.looseEvents && finalEvent && recognizable) {
                    this.processSendEvent(finalEvent.type, finalEvent.data);
                    finalEvent = null;
                  }
                } else if (recognizing) {
                  if (this._passive) {
                    const result = cognitiveServiceEventResultToWebSpeechRecognitionResultList(recognizing.result, {
                      maxAlternatives: this.maxAlternatives,
                      textNormalization: this.textNormalization
                    });

                    // Test wake words if some are present
                    if (this._wakeWords && this._wakeWords.length > 0) {
                      if (result && Array.isArray(result) && result.length > 0 && result[0].transcript) {
                        const { transcript } = { ...result[0] };
                        this._wakeWords.forEach(wakeWord => {
                          if (transcript.toLowerCase().includes(wakeWord.toLowerCase())) {
                            this.processSendEvent('wakeup');
                          }
                        });
                      }
                    }

                    this.interimResults &&
                      this.processSendEvent('passiveresult', {
                        results: result
                      });
                  } else {
                    this.interimResults &&
                      this.processSendEvent('result', {
                        results: [
                          ...finalizedResults,
                          ...cognitiveServiceEventResultToWebSpeechRecognitionResultList(recognizing.result, {
                            maxAlternatives: this.maxAlternatives,
                            textNormalization: this.textNormalization
                          })
                        ]
                      });
                  }
                }
              }
            }
          }

          speechStarted && this.processSendEvent('speechend');
          soundStarted && this.processSendEvent('soundend');
          audioStarted && this.processSendEvent('audioend');

          if (finalEvent) {
            if (
              finalEvent.type === 'result' &&
              (typeof finalEvent.data === 'string' || !finalEvent.data?.results || !finalEvent.data.results.length)
            ) {
              finalEvent = {
                data: 'no-speech',
                type: 'error'
              };
            }

            this.processSendEvent(finalEvent.type, finalEvent.data);
          }

          // Even though there is no "start" event emitted, we will still emit "end" event
          // This is mainly for "microphone blocked" story.
          this.processSendEvent('end');
          detachAudioConfigEvent && detachAudioConfigEvent();
        } catch (err) {
          // Logging out the erorr because Speech SDK would fail silently.
          console.error(err);

          throw err;
        } finally {
          unprepare();
          this.recognizer.close();
        }
      }
    }
  }
}

const createSpeechRecognitionPonyfill = (options: PatchOptions, data?: SpeechRecognitionProps) => {
  return {
    speechRecognition: new SpeechRecognition(options, data)
  };
};

export default createSpeechRecognitionPonyfill;
export { createSpeechRecognitionPonyfill, SpeechRecognition };
