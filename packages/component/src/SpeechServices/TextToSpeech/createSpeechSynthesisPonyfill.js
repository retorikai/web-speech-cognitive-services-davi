// Importer les modules nécessaires
import { EventTarget, getEventAttributeValue, setEventAttributeValue } from 'event-target-shim/es5';
import onErrorResumeNext from 'on-error-resume-next';
import SpeechSDK from '../SpeechSDK';
import { SpeakerAudioDestination, AudioConfig } from 'microsoft-cognitiveservices-speech-sdk';
import AudioContextQueue from './AudioContextQueue';
import fetchCustomVoices from './fetchCustomVoices';
import fetchVoices from './fetchVoices';
import patchOptions from '../patchOptions';
import SpeechSynthesisEvent from './SpeechSynthesisEvent';
import SpeechSynthesisUtterance from './SpeechSynthesisUtterance';

// Classe CustomSpeakerAudioDestination héritant de SpeakerAudioDestination pour gérer le volume et la mise en sourdine
class CustomSpeakerAudioDestination extends SpeakerAudioDestination {
  constructor() {
    super();
    this._isMuted = false;
    this._previousVolume = 1;
  }

  // Fonction pour mettre en sourdine
  mute() {
    console.warn('Muted');
    this.privAudio.muted = true;
    this._isMuted = true;
  }

  // Fonction pour désactiver la mise en sourdine
  unmute() {
    console.warn('Unmuted');
    this.privAudio.muted = false;
  }

  // Accesseur pour obtenir le volume
  get volume() {
    return this.privAudio.volume;
  }

  // Mutateur pour définir le volume
  set volume(value) {
    this.privAudio.volume = value;
  }
}

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

  // Classe qui hérite de la classe EventTarget pour manipuler des événements
  class SpeechSynthesis extends EventTarget {
    constructor() {
      super();

      this.speakerAudioDestination = new CustomSpeakerAudioDestination();

      this.audioConfig = audioContext
        ? SpeechSDK.AudioConfig.fromAudioContext(audioContext)
        : AudioConfig.fromSpeakerOutput(this.speakerAudioDestination);

      // Initialisation de la queue
      this.queue = new AudioContextQueue({ audioContext, ponyfill });

      // Initialisation du synthétiseur
      this.initSpeechSynthesizer();
    }

    // Fonction asynchrone qui initialise le synthétiseur vocal
    async initSpeechSynthesizer() {
      const { subscriptionKey, region } = await fetchCredentials();

      if (!subscriptionKey) {
        throw new Error('subscriptionKey is null or undefined');
      }

      // Configuration du synthétiseur et de l'audio
      this.speechConfig = SpeechSDK.SpeechConfig.fromSubscription(subscriptionKey, region);

      this.synth = new SpeechSDK.SpeechSynthesizer(this.speechConfig, this.audioConfig);

      // Mise à jour des voix disponibles
      this.updateVoices();
    }

    // Fonction pour recréer le synthétiseur
    recreateSynthesizer() {
      this.speakerAudioDestination = new CustomSpeakerAudioDestination();

      this.audioConfig = audioContext
        ? SpeechSDK.AudioConfig.fromAudioContext(audioContext)
        : AudioConfig.fromSpeakerOutput(this.speakerAudioDestination);

      this.synth = new SpeechSDK.SpeechSynthesizer(this.speechConfig, this.audioConfig);
    }

    // Fonction qui arrête la lecture en cours
    cancel() {
      this.queue.stop();
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

    pauseSpeaker() {
      this.speakerAudioDestination.pause();
    }

    resumeSpeaker() {
      this.speakerAudioDestination.resume();
    }

    // Accesseur pour obtenir le temps écoulé
    get currentTime() {
      return this.speakerAudioDestination.currentTime;
    }

    // Fonction qui met en pause la lecture en cours
    pause() {
      this.queue.pause();
    }

    // Fonction qui reprend la lecture en cours
    resume() {
      this.queue.resume();
    }

    // Fonction asynchrone qui lit le texte passé en paramètre
    speak(utterance) {
      if (this.synth.properties.getProperty('privDisposed')) {
        this.synth = new SpeechSDK.SpeechSynthesizer(this.speechConfig, this.audioConfig);
      } else {
        console.warn('opened');
        this.synth = new SpeechSDK.SpeechSynthesizer(this.speechConfig, this.audioConfig);
      }

      // Initialisation du SpeakerAudioDestination
      this.speakerAudioDestination.onAudioStart = () => {
        utterance.onstart && utterance.onstart();
        console.warn('audioStart');

        setTimeout(() => {
          console.warn('Current Time:', this.speakerAudioDestination.privAudio.currentTime);
          this.speakerAudioDestination.privAudio.volume();
          // eslint-disable-next-line no-magic-numbers
        }, 2500);
      };

      this.speakerAudioDestination.onAudioEnd = () => {
        utterance.onend && utterance.onend();
        console.warn('audioEnd');
      };

      // Vérification si l'objet passé en paramètre est une instance de SpeechSynthesisUtterance
      if (!(utterance instanceof SpeechSynthesisUtterance)) {
        throw new Error('invalid utterance');
      }

      // Fonction pour gérer les événements
      function handleEvent(eventName, synth, e, utterance) {
        // console.log(`Event "${eventName}" triggered`, e);

        // Gestion des différents types d'événements
        switch (eventName) {
          case 'start':
            break;
          case 'end':
            break;
          case 'error':
            utterance.onerror && utterance.onerror();
            console.error('Synthesis error:', e);
            break;
          case 'wordBoundary':
            utterance.onWordBoundary && utterance.onWordBoundary(e);
            break;
          case 'visemeReceived':
            utterance.onVisemeReceived && utterance.onVisemeReceived(e);
            break;
          case 'bookmarkReached':
            utterance.onBookmarkReached && utterance.onBookmarkReached(e);
            break;
          default:
            console.warn(`Unhandled event type: ${eventName}`);
        }
      }

      this.synth.synthesisStarted = () => {
        handleEvent('start', this.synth, null, utterance);
      };

      this.synth.synthesisCompleted = () => {
        handleEvent('end', this.synth, null, utterance);
      };

      this.synth.wordBoundary = (synth, e) => {
        handleEvent('wordBoundary', this.synth, e, utterance);
      };

      this.synth.visemeReceived = (synth, e) => {
        handleEvent('visemeReceived', this.synth, e, utterance);
      };

      this.synth.bookmarkReached = (synth, e) => {
        handleEvent('bookmarkReached', this.synth, e, utterance);
      };

      const isSSML = /<speak[\s\S]*?>/iu.test(utterance.text);
      let ssml = '';

      if (isSSML) {
        ssml = utterance.text;
      } else {
        ssml = `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xmlns:mstts='http://www.w3.org/2001/mstts' xmlns:emo='http://www.w3.org/2009/10/emotionml' xml:lang='en-US'><voice name='Microsoft Server Speech Text to Speech Voice (fr-FR, AlainNeural)'>${utterance.text}<bookmark mark='end' /></voice></speak>`;
      }

      this.synth.error = (synth, e) => {
        handleEvent('error', this.synth, e, utterance);
      };

      // Création d'une promesse qui résout lorsque la synthèse est terminée
      return new Promise((resolve, reject) => {
        this.synth.speakSsmlAsync(
          ssml,
          result => {
            // Vérification du résultat de la synthèse vocale
            if (result) {
              this.synth.close(() => this.recreateSynthesizer());
            } else {
              console.error('No synthesis result.');
              reject(new Error('No synthesis result.'));
            }
          },
          error => {
            console.error('Synthesis error:', error);
            reject(error);
          }
        );
      });
    }

    // Fonction statique pour créer un élément audio avec des gestionnaires d'événements
    static createAudioElementWithEventHandlers(url, utterance, handleError) {
      if (!url) {
        console.error('URL is undefined or null');
        return;
      }

      // Création d'un nouvel élément audio
      const audioElement = new Audio(url);

      // Renvoi de la promesse avec l'élément audio créé
      return new Promise((resolve, reject) => {
        // Ajout des gestionnaires d'événements pour les événements 'ended', 'error' et 'canplaythrough'
        audioElement.addEventListener('ended', () => {
          utterance.dispatchEvent(new Event('end'));
          resolve();
        });

        audioElement.addEventListener('error', event => {
          handleError({ error: event.error, message: 'Error playing audio' });
          reject(event.error);
        });

        audioElement.addEventListener('canplaythrough', () => {
          resolve(audioElement);
        });

        // Chargement de l'élément audio
        audioElement.load();
      });
    }

    // Fonction qui renvoie un booléen indiquant si la lecture est en cours ou non
    get speaking() {
      return this.queue.speaking;
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
