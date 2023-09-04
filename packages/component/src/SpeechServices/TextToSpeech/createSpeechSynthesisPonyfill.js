// Import necessary modules
import { EventTarget, getEventAttributeValue, setEventAttributeValue } from 'event-target-shim/es5';
import SpeechSDK from '../SpeechSDK';
import { SpeakerAudioDestination, AudioConfig } from 'microsoft-cognitiveservices-speech-sdk';
import patchOptions from '../patchOptions';
import SpeechSynthesisEvent from './SpeechSynthesisEvent';
import SpeechSynthesisUtterance from './SpeechSynthesisUtterance';
import SpeechSynthesisVoice from './SpeechSynthesisVoice';

export default options => {
  // Extract parameters from options using the patchOptions function
  const {
    audioContext,
    fetchCredentials,
    ponyfill = {
      AudioContext: window.AudioContext || window.webkitAudioContext
    },
    speechSynthesisDeploymentId
  } = patchOptions(options);

  // Check if the browser supports the Web Audio API, if not, return an empty object
  if (!audioContext && !ponyfill.AudioContext) {
    console.warn(
      'web-speech-cognitive-services: This browser does not support Web Audio and it will not work with Cognitive Services Speech Services.'
    );

    return {};
  }

  class SpeechSynthesis extends EventTarget {
    constructor() {
      super();

      this.speaking = false;
      this.speakerAudioDestination = new SpeakerAudioDestination();
      this.audioConfig = audioContext
        ? SpeechSDK.AudioConfig.fromAudioContext(audioContext)
        : AudioConfig.fromSpeakerOutput(this.speakerAudioDestination);

      // Init synthesizer
      this.initSpeechSynthesizer();

      // Initialize the queue for managing the utterances
      this.queue = [];

      this.canceled = false;
    }

    mute() {
      this.speakerAudioDestination && this.speakerAudioDestination.mute();
    }

    unmute() {
      this.speakerAudioDestination && this.speakerAudioDestination.unmute();
    }

    getVolume() {
      // eslint-disable-next-line no-magic-numbers
      return this.speakerAudioDestination ? this.speakerAudioDestination.volume : -1;
    }

    setVolume(value) {
      this.speakerAudioDestination && (this.speakerAudioDestination.volume = value);
    }

    // Asynchronous function that initializes the speech synthesizer class
    async initSpeechSynthesizer() {
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

        this.speechConfig = SpeechSDK.SpeechConfig.fromEndpoint(url, subscriptionKey);
      } else {
        if (speechSynthesisHostname) {
          this.speechConfig = SpeechSDK.SpeechConfig.fromHost(speechSynthesisHostname, subscriptionKey);
        } else {
          this.speechConfig = authorizationToken
            ? SpeechSDK.SpeechConfig.fromAuthorizationToken(authorizationToken, region)
            : SpeechSDK.SpeechConfig.fromSubscription(subscriptionKey, region);
        }
      }
      this.synth = new SpeechSDK.SpeechSynthesizer(this.speechConfig, this.audioConfig);

      // Update available voices
      this.updateVoices();
    }

    // Function to recreate the synthesizer
    createSynthesizer(voice, stream) {
      if (stream) {
        this.audioConfig = AudioConfig.fromStreamOutput(stream)
      } else {
        this.speakerAudioDestination = new SpeakerAudioDestination();

        this.audioConfig = audioContext
          ? SpeechSDK.AudioConfig.fromAudioContext(audioContext)
          : AudioConfig.fromSpeakerOutput(this.speakerAudioDestination);
      }
      

      if (voice) {
        const tempSpeechConfig = this.speechConfig;
        tempSpeechConfig.speechSynthesisVoiceName = voice;
        this.synth = new SpeechSDK.SpeechSynthesizer(tempSpeechConfig, this.audioConfig);
      } else {
        this.synth = new SpeechSDK.SpeechSynthesizer(this.speechConfig, this.audioConfig);
      }
    }

    // Cancel current synthesis
    cancel() {
      if (this.synth.synthesisstarted && !this.synth.synthesiscompleted) {
        this.synth.close();
        this.queue = [];
      } else if (this.speaking) {
        try {
          this.speakerAudioDestination.pause();
          this.speakerAudioDestination.onAudioEnd();
          this.speakerAudioDestination.close();
        } catch (e) {
          console.warn(e);
        }
      }
      this.queue = [];
      this.canceled = true;
    }

    // Pause current synthesis
    pause() {
      if (this.speakerAudioDestination) {
        this.speakerAudioDestination.pause();
      }
    }

    // Resume current synthesis
    resume() {
      if (this.speakerAudioDestination && !this.canceled) {
        this.speakerAudioDestination.resume();
      }
    }

    // Function that returns an empty array of available voices
    getVoices() {
      return this.EMPTY_ARRAY;
    }

    // Function that returns the 'onvoiceschanged' attribute of the object
    get onvoiceschanged() {
      return getEventAttributeValue(this, 'voiceschanged');
    }

    // Function that updates the 'onvoiceschanged' attribute of the object
    set onvoiceschanged(value) {
      setEventAttributeValue(this, 'voiceschanged', value);
    }

    /**
     * Add events listeners to the events received by the synthesizer if callbakcs are given in the utterance
     * @param {SpeechSynthesisUtterance} utterance
     */
    linkEventsCallbacks(utterance) {
      // Events callbacks
      this.synth.synthesisStarted = () => {
        utterance.onsynthesisstart && utterance.onsynthesisstart();
      };

      this.synth.synthesisCompleted = () => {
        utterance.onsynthesiscompleted && utterance.onsynthesiscompleted();
      };

      this.synth.error = (synth, e) => {
        const event = new SpeechSynthesisEvent('error');
        event.errorDetails = e;
        utterance.dispatchEvent(event);
      };

      this.synth.wordBoundary = (synth, e) => {
        const event = new SpeechSynthesisEvent('boundary');
        event.boundaryType = e.privBoundaryType;
        event.name = e.privText;
        event.elapsedTime = e.privAudioOffset;
        event.duration = e.privDuration;

        utterance.dispatchEvent(event);
      };

      this.synth.visemeReceived = (synth, e) => {
        // Create a new SpeechSynthesisEvent of type 'boundary' that is returned as a boundary.
        const event = new SpeechSynthesisEvent('boundary');
        event.boundaryType = 'Viseme';
        event.name = e.privVisemeId;
        event.elapsedTime = e.privAudioOffset;
        event.duration = 0;

        utterance.dispatchEvent(event);

        // Create a new SpeechSynthesisEvent of type 'viseme' that is sent to a custom 'onviseme' method
        const event2 = new SpeechSynthesisEvent('viseme');
        event2.boundaryType = 'Viseme';
        event2.name = e.privVisemeId;
        event2.elapsedTime = e.privAudioOffset;
        event2.duration = 0;

        utterance.dispatchEvent(event2);
      };

      this.synth.bookmarkReached = (synth, e) => {
        const event = new SpeechSynthesisEvent('mark');
        event.name = e.privText;
        event.elapsedTime = e.privAudioOffset;
        utterance.dispatchEvent(event);
      };
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
      const processQueue = () => {
        if (this.queue.length && !this.speaking) {
          const currentUtterance = this.queue.shift(); // Get the next utterance from the queue
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
            const event = new SpeechSynthesisEvent('start');
            currentUtterance.dispatchEvent(event);
          };

          this.speakerAudioDestination.onAudioEnd = () => {
            this.speaking = false;
            const event = new SpeechSynthesisEvent('end');
            currentUtterance.dispatchEvent(event);
            processQueue(); // Process the next queued utterance after the current one has finished
          };

          this.linkEventsCallbacks(currentUtterance)

          return isSSML
            ? new Promise((resolve, reject) => {
                this.synth.speakSsmlAsync(
                  currentUtterance.text,
                  result => {
                    if (result) {
                      this.synth.close();
                      resolve();
                    } else {
                      reject(new Error('No synthesis result.'));
                    }
                  },
                  error => {
                    reject(new Error('Synthesis failed : ', error));
                  }
                );
              })
            : new Promise((resolve, reject) => {
                this.synth.speakTextAsync(
                  currentUtterance.text,
                  result => {
                    if (result) {
                      this.synth.close();
                      resolve();
                    } else {
                      reject(new Error('No synthesis result.'));
                    }
                  },
                  error => {
                    reject(new Error('Synthesis failed : ', error));
                  }
                );
              });
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

      this.synth = new SpeechSDK.SpeechSynthesizer(this.speechConfig, null);
      this.linkEventsCallbacks(utterance)

      try {
        this.synth.speakSsmlAsync(
          utterance.text,
          result => {
            if (result && result.audioData) {
              callback(result.audioData);
              this.synth.close();
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
      const voicesResult = await this.synth.getVoicesAsync();
      const voices = voicesResult.privVoices;

      if (Array.isArray(voices)) {
        const formattedVoices = voices.map(voice => 
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

      // Trigger the 'voiceschanged' event to notify the voices update
      this.dispatchEvent(new Event('voiceschanged'));
    }
  }

  // Return the object containing the instance of the speech synthesis, the SpeechSynthesisEvent and SpeechSynthesisUtterance classes
  return {
    speechSynthesis: new SpeechSynthesis(),
    SpeechSynthesisEvent,
    SpeechSynthesisUtterance
  };
};
