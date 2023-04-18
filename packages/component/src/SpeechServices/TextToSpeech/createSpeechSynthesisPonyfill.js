// Importer les modules nécessaires
import { EventTarget, getEventAttributeValue, setEventAttributeValue } from 'event-target-shim/es5';
import onErrorResumeNext from 'on-error-resume-next';
import SpeechSDK from '../SpeechSDK';
import { SpeakerAudioDestination, AudioConfig } from 'microsoft-cognitiveservices-speech-sdk';
import fetchCustomVoices from './fetchCustomVoices';
import fetchVoices from './fetchVoices';
import patchOptions from '../patchOptions';
import SpeechSynthesisEvent from './SpeechSynthesisEvent';
import SpeechSynthesisUtterance from './SpeechSynthesisUtterance';

export default options => {
  // Extraction des paramètres depuis options en utilisant la fonction patchOptions
  const {
    audioContext,
    fetchCredentials,
    ponyfill = {
      AudioContext: window.AudioContext || window.webkitAudioContext
    },
    speechSynthesisDeploymentId
  } = patchOptions(options);

  // Vérification si le navigateur supporte l'API Web Audio, si non, on retourne un objet vide
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

    // Fonction asynchrone qui initialise le synthétiseur vocalclasse ""
    async initSpeechSynthesizer() {
      const { subscriptionKey, authorizationToken ,region } = await fetchCredentials();

      if (!authorizationToken && !subscriptionKey) {
        throw new Error('no subscription data : authorizationToken or subscriptionKey needed');
      }

      // Configuration du synthétiseur et de l'audio
      this.speechConfig = authorizationToken ?
        SpeechSDK.SpeechConfig.fromAuthorizationToken(authorizationToken, region)
        :
        SpeechSDK.SpeechConfig.fromSubscription(subscriptionKey, region)
      this.synth = new SpeechSDK.SpeechSynthesizer(this.speechConfig, this.audioConfig);

      // Mise à jour des voix disponibles
      this.updateVoices();
    }

    // Fonction pour recréer le synthétiseur
    recreateSynthesizer() {
      this.speakerAudioDestination = new SpeakerAudioDestination();

      this.audioConfig = audioContext
        ? SpeechSDK.AudioConfig.fromAudioContext(audioContext)
        : AudioConfig.fromSpeakerOutput(this.speakerAudioDestination);

      this.synth = new SpeechSDK.SpeechSynthesizer(this.speechConfig, this.audioConfig);
    }

    // Cancel current synthesis
    cancel() {
      if (this.synth.synthesisStarted && !this.synth.synthesisCompleted) {
        this.synth.close();
      } else if (this.speaking) {
        try {
          this.speakerAudioDestination.pause();
          this.speakerAudioDestination.onAudioEnd();
          this.speakerAudioDestination.close();
        } catch(e) {
          console.log(e);
        }
      }
    }

    // Fonction qui retourne un tableau vide des voix disponibles
    getVoices() {
      return this.EMPTY_ARRAY;
    }

    // Fonction qui retourne l'attribut 'onvoiceschanged' de l'objet
    get onvoiceschanged() {
      return getEventAttributeValue(this, 'voiceschanged');
    }

    // Fonction qui met à jour l'attribut 'onvoiceschanged' de l'objet
    set onvoiceschanged(value) {
      setEventAttributeValue(this, 'voiceschanged', value);
    }

    speak(utterance) {
      // Test utterance
      if (!(utterance instanceof SpeechSynthesisUtterance)) {
        throw new Error('invalid utterance');
      }

      this.speakerAudioDestination.isClosed && this.recreateSynthesizer()    

      // Set volume / mute status if present in the utterance parameters
      utterance.volume && (this.speakerAudioDestination.volume = utterance.volume);

      // SpeakerAudioDestination events callbacks
      this.speakerAudioDestination.onAudioStart = () => {
        this.speaking = true;
        utterance.onstart && utterance.onstart();
        console.log('audioStart');
      }

      this.speakerAudioDestination.onAudioEnd = () => {
        this.speaking = false;
        utterance.onend && utterance.onend();
        console.log('audioEnd');
      };

      // Events callbacks
      this.synth.synthesisStarted = () => {
        utterance.onSynthesisStart && utterance.onSynthesisStart();
      };

      this.synth.synthesisCompleted = () => {
        utterance.onSynthesisCompleted && utterance.onSynthesisCompleted();
      };

      this.synth.error = (synth, e) => {
        utterance.onSynthesisError && utterance.onSynthesisError(e);
      };

      this.synth.wordBoundary = (synth, e) => {
        utterance.onboundary && utterance.onboundary(e);
      };

      this.synth.visemeReceived = (synth, e) => {
        console.log('Viseme : ', e);
        utterance.onviseme && utterance.onviseme(e);
      };

      this.synth.bookmarkReached = (synth, e) => {
        utterance.onmark && utterance.onmark(e);
      };

      const isSSML = /<speak[\s\S]*?>/iu.test(utterance.text);

      return isSSML ? new Promise(reject => {
        this.synth.speakSsmlAsync(
          utterance.text,
          result => {
            if (result) {
              this.synth.close();
            } else {
              reject(new Error('No synthesis result.'));
            }
          },
          error => {
            reject(new Error('Synthesis failed : ', error));
          }
        );
      })
      :
      new Promise(reject => {
        this.synth.speakTextAsync(
          utterance.text,
          result => {
            if (result) {
              this.synth.close();
            } else {
              reject(new Error('No synthesis result.'));
            }
          },
          error => {
            reject(new Error('Synthesis failed : ', error));
          }
        );
      })
    }

    // Fonction asynchrone qui met à jour les voix disponibles
    async updateVoices() {
      const { customVoiceHostname, region, speechSynthesisHostname, subscriptionKey } = await fetchCredentials();

      if (speechSynthesisDeploymentId) {
        await onErrorResumeNext(async () => {
          // Récupération des voix personnalisées pour un déploiement spécifique (si renseigné)
          const voices = await fetchCustomVoices({
            customVoiceHostname,
            deploymentId: speechSynthesisDeploymentId,
            region,
            speechSynthesisHostname,
            subscriptionKey
          });

          this.getVoices = () => voices;
        });
      } else {
        // Récupération des voix standard
        await onErrorResumeNext(async () => {
          const voices = await fetchVoices({
            region,
            speechSynthesisHostname,
            subscriptionKey
          });

          this.getVoices = () => voices;
        });
      }

      // Lancement de l'événement 'voiceschanged' pour notifier la mise à jour des voix
      this.dispatchEvent(new SpeechSynthesisEvent('voiceschanged'));
    }
  }

  // Renvoi de l'objet contenant l'instance de la synthèse vocale, les classes SpeechSynthesisEvent et SpeechSynthesisUtterance
  return {
    speechSynthesis: new SpeechSynthesis(),
    SpeechSynthesisEvent,
    SpeechSynthesisUtterance
  };
};
