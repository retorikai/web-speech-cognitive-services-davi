import * as SDK from 'microsoft-cognitiveservices-speech-sdk'
import patchOptions from '../patchOptions';
import SpeechSynthesisUtterance from './SpeechSynthesisUtterance';
import SpeechSynthesisVoice from './SpeechSynthesisVoice';
import type { SpeechSynthesisPonyfillType } from '../../models/ponyfillTypes';
import type { PatchOptions } from '../../models/credentialTypes';

class SpeechSynthesis {
  speaking = false;
  speakerAudioDestination: SDK.SpeakerAudioDestination = new SDK.SpeakerAudioDestination();
  audioConfig: SDK.AudioConfig | undefined = undefined;
  speechConfig: SDK.SpeechConfig | null = null;
  queue: Array<SpeechSynthesisUtterance> = [];
  canceled = false;
  synth: SDK.SpeechSynthesizer | null = null;
  synthesizing: boolean = false;

  constructor(options: PatchOptions) {
    // Extract parameters from options using the patchOptions function
    const {
      audioContext,
      fetchCredentials,
      ponyfill = {
        // @ts-ignore
        AudioContext: window.AudioContext || window.webkitAudioContext
      },
      speechSynthesisDeploymentId
    } = patchOptions(options);

    // Check if the browser supports the Web Audio API, if not, return an empty object
    if (!audioContext && !ponyfill.AudioContext) {
      console.warn(
        'web-speech-cognitive-services: This browser does not support Web Audio and it will not work with Cognitive Services Speech Services.'
      );
    } else {
      this.audioConfig = SDK.AudioConfig.fromSpeakerOutput(this.speakerAudioDestination);
      // Init synthesizer
      this.initSpeechSynthesizer(fetchCredentials, speechSynthesisDeploymentId);
    }
  }

  mute(): void {
    this.speakerAudioDestination && this.speakerAudioDestination.mute();
  }

  unmute(): void {
    this.speakerAudioDestination && this.speakerAudioDestination.unmute();
  }

  getVolume(): number {
    // eslint-disable-next-line no-magic-numbers
    return this.speakerAudioDestination ? this.speakerAudioDestination.volume : -1;
  }

  setVolume(value: number): void {
    this.speakerAudioDestination && (this.speakerAudioDestination.volume = value);
  }

  // Asynchronous function that initializes the speech synthesizer class
  async initSpeechSynthesizer(fetchCredentials: Function, speechSynthesisDeploymentId?: string): Promise<void> {
    const { speechSynthesisHostname, subscriptionKey, authorizationToken, region } = await fetchCredentials();

    if (!authorizationToken && !subscriptionKey) {
      throw new Error('no subscription data : authorizationToken or subscriptionKey needed');
    }

    // Configure the synthesizer and audio
    if (speechSynthesisDeploymentId) {
      const hostname = speechSynthesisHostname || `${region}.customvoice.api.speech.microsoft.com`;
      const url = `https://${encodeURI(hostname)}/api/texttospeech/v2.0/endpoints/${encodeURIComponent(
        speechSynthesisDeploymentId
      )}`;

      this.speechConfig = SDK.SpeechConfig.fromEndpoint(new URL(url), subscriptionKey);
    } else {
      if (speechSynthesisHostname) {
        this.speechConfig = SDK.SpeechConfig.fromHost(speechSynthesisHostname, subscriptionKey);
      } else {
        this.speechConfig = authorizationToken
          ? SDK.SpeechConfig.fromAuthorizationToken(authorizationToken, region)
          : SDK.SpeechConfig.fromSubscription(subscriptionKey, region);
      }
    }
    this.synth = new SDK.SpeechSynthesizer(this.speechConfig, this.audioConfig);

    // Update available voices
    this.updateVoices();
  }

  // Function to recreate the synthesizer
  createSynthesizer(voice, stream): void {
    if (stream) {
      this.audioConfig = SDK.AudioConfig.fromStreamOutput(stream)
    } else {
      this.speakerAudioDestination = new SDK.SpeakerAudioDestination();

      this.audioConfig = SDK.AudioConfig.fromSpeakerOutput(this.speakerAudioDestination);
    }
    
    if (this.speechConfig) {
      if (voice) {
        const tempSpeechConfig = this.speechConfig;
        tempSpeechConfig.speechSynthesisVoiceName = voice;
        this.synth = new SDK.SpeechSynthesizer(tempSpeechConfig, this.audioConfig);
      } else {
        this.synth = new SDK.SpeechSynthesizer(this.speechConfig, this.audioConfig);
      }
    }
  }

  // Cancel current synthesis
  cancel(): void {
    if (this.synthesizing) {
      try {
        // @ts-ignore
        this.synth && !this.synth.privDisposed && this.synth.close();
        this.queue = [];
      } catch (e) {
        console.warn(e);
      }
    } else if (this.speaking) {
      try {
        this.speakerAudioDestination.pause();
        this.speakerAudioDestination.onAudioEnd(this.speakerAudioDestination);
        this.speakerAudioDestination.close();
      } catch (e) {
        console.warn(e);
      }
    }
    this.queue = [];
    this.canceled = true;
  }

  // Pause current synthesis
  pause(): void {
    if (this.speakerAudioDestination) {
      this.speakerAudioDestination.pause();
    }
  }

  // Resume current synthesis
  resume(): void {
    if (this.speakerAudioDestination && !this.canceled) {
      this.speakerAudioDestination.resume();
    }
  }

  // Function that returns an empty array of available voices
  getVoices = (): Array<SpeechSynthesisVoice> => {
    return [];
  }

  onvoiceschanged = (): void => {
    console.log('Voices changed')
  }

  /**
   * Add events listeners to the events received by the synthesizer if callbakcs are given in the utterance
   * @param {SpeechSynthesisUtterance} utterance
   */
  linkEventsCallbacks(utterance) {
    if (this.synth) {
      // Events callbacks
      this.synth.synthesisStarted = () => {
        utterance.onsynthesisstart && utterance.onsynthesisstart()
        this.synthesizing = true;
      };

      this.synth.synthesisCompleted = () => {
        utterance.onsynthesiscompleted && utterance.onsynthesiscompleted()
        this.synthesizing = false;
      };

      this.synth.wordBoundary = (synth, e) => {
        !synth && console.warn('No synthesizer')
        const data = {
          boundaryType: e.boundaryType,
          name: e.text,
          elapsedTime: e.audioOffset,
          duration: e.duration
        };

        utterance.onboundary && utterance.onboundary(data);
      };

      this.synth.visemeReceived = (synth, e) => {
        !synth && console.warn('No synthesizer')
        const data = {
          boundaryType: 'Viseme',
          name: `${e.visemeId}`,
          elapsedTime: e.audioOffset,
          duration: 0
        }

        utterance.onboundary && utterance.onboundary(data);
        utterance.onviseme && utterance.onviseme(data);
      };

      this.synth.bookmarkReached = (synth, e) => {
        !synth && console.warn('No synthesizer')
        const data = {
          boundaryType: 'Mark',
          name: e.text,
          elapsedTime: e.audioOffset,
          duration: 0
        };

        utterance.onmark && utterance.onmark(data);
      };
    }
  }

  /**
   * Launch synthesis and play sound with the speech synthesizer
   * @param {SpeechSynthesisUtterance} utterance 
   */
  speak(utterance, stream) {
    // Test utterance
    if (!(utterance instanceof SpeechSynthesisUtterance)) {
      throw new Error('invalid utterance');
    }

    // Add the utterance to the queue
    this.queue.push(utterance);

    // Function to process the queued utterances
    const processQueue = (): any => {
      if (this.queue.length && !this.speaking) {
        const currentUtterance = this.queue.shift(); // Get the next utterance from the queue
        if (currentUtterance) {
          const isSSML = /<speak[\s\S]*?>/iu.test(currentUtterance.text);

          if (currentUtterance.voice && (currentUtterance.voice.voiceURI || currentUtterance.voice._name)) {
            this.createSynthesizer(currentUtterance.voice.voiceURI || currentUtterance.voice._name, stream);
          } else {
            this.createSynthesizer(undefined, stream);
          }

          // Set volume / mute status if present in the utterance parameters
          currentUtterance.volume && (this.speakerAudioDestination.volume = currentUtterance.volume);

          // SpeakerAudioDestination events callbacks
          this.speakerAudioDestination.onAudioStart = () => {
            this.speaking = true;
            currentUtterance.onstart && currentUtterance.onstart();
          };

          this.speakerAudioDestination.onAudioEnd = () => {
            this.speaking = false;
            currentUtterance.onend && currentUtterance.onend();
            processQueue(); // Process the next queued utterance after the current one has finished
          };

          this.linkEventsCallbacks(currentUtterance)

          return isSSML
            ? new Promise((reject) => {
              this.synth && this.synth.speakSsmlAsync(
                  currentUtterance.text,
                  result => {
                    if (result) {
                      this.synth && this.synth.close();
                    } else {
                      reject(new Error('No synthesis result.'));
                    }
                  },
                  error => {
                    reject(new Error(`Synthesis failed : ${error}`));
                  }
                );
              })
            : new Promise((reject) => {
              this.synth && this.synth.speakTextAsync(
                  currentUtterance.text,
                  result => {
                    if (result) {
                      this.synth && this.synth.close();
                    } else {
                      reject(new Error('No synthesis result.'));
                    }
                  },
                  error => {
                    reject(new Error(`Synthesis failed : ${error}`));
                  }
                );
              });
            }
      }
    };
    processQueue(); // Start processing the queue
    this.canceled = false; // Reset canceled state after processing the queue
  }

  /**
   * Launch synthesis without sound being played and call callback function with an ArrayBuffer after synthesis finished, containing the sound data
   * @param {SpeechSynthesisUtterance} utterance 
   * @param {Function} callback 
   */
  synthesizeAndGetArrayData(utterance, callback) {
    // Test utterance
    if (!(utterance instanceof SpeechSynthesisUtterance)) {
      throw new Error('invalid utterance');
    }

    const isSSML = /<speak[\s\S]*?>/iu.test(utterance.text);
    if (this.speechConfig) {
      if (utterance.voice && (utterance.voice.voiceURI || utterance.voice._name)) {
        const tempSpeechConfig = this.speechConfig;
        tempSpeechConfig.speechSynthesisVoiceName = utterance.voice.voiceURI || utterance.voice._name;
        // @ts-ignore
        this.synth = new SDK.SpeechSynthesizer(tempSpeechConfig, null);
      } else {
        // @ts-ignore
        this.synth = new SDK.SpeechSynthesizer(this.speechConfig, null);
      }
    }
    
    this.linkEventsCallbacks(utterance)

    try {
      isSSML ?
        this.synth && this.synth.speakSsmlAsync(
          utterance.text,
          result => {
            if (result && result.audioData) {
              callback(result.audioData);
              this.synth && this.synth.close();
            }
            else {
              callback(null);
            }
          },
          error => {
            console.error(error)
            callback(null);
          })
        :
        this.synth && this.synth.speakTextAsync(
          utterance.text,
          result => {
            if (result && result.audioData) {
              callback(result.audioData);
              this.synth && this.synth.close();
            }
            else {
              callback(null);
            }
          },
          error => {
            console.error(error)
            callback(null);
          });
      }
      catch (error) {
          console.error(error);
      }
  }

  // Asynchronous function that updates available voices
  async updateVoices() {
    const voicesResult = this.synth ?
      await this.synth.getVoicesAsync()
      :
      null
    const voices = voicesResult?.voices;

    if (Array.isArray(voices)) {
      const formattedVoices: Array<SpeechSynthesisVoice> = voices.map(voice => 
        new SpeechSynthesisVoice({
          // eslint-disable-next-line no-magic-numbers
          gender: voice.gender === 1 ? 'Female' : voice.gender === 2 ? 'Male' : 'Undefined',
          lang: voice.locale,
          voiceURI: voice.name
        })
      )

      this.getVoices = () => formattedVoices;
    } else {
      console.warn("Failed to retrieve voices. 'voices' is not an array.");
    }

    // Call 'onvoiceschanged' callback to notify the voices update
    this.onvoiceschanged()
  }
}

const createSpeechSynthesisPonyfill = (options: PatchOptions): SpeechSynthesisPonyfillType => {
  return {
    speechSynthesis: new SpeechSynthesis(options),
    SpeechSynthesisUtterance
  };
};

export default createSpeechSynthesisPonyfill;
export { createSpeechSynthesisPonyfill, SpeechSynthesis };
