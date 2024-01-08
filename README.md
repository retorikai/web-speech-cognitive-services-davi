# web-speech-cognitive-services-davi

This package is based on a fork of [web-speech-cognitive-services](https://www.npmjs.com/package/web-speech-cognitive-services).
The primary goal is the use the SpeechSynthetizer from [microsoft-cognitiveservices-speech-sdk](https://www.npmjs.com/package/microsoft-cognitiveservices-speech-sdk) in the TTS part of the package, in order to receive the boundaries and visemes on a speech synthesis to overcome the existing issues of the original package.
Now using Typescript !

## Install

```bash
npm install @davi-ai/web-speech-cognitive-services-davi
```

## SPEECH SYNTHESIS
### Changes compared to original package

In order to use speech synthesis, you still need to use the original process :
- create a speechSynthesisPonyfill (type SpeechSynthesisPonyfillType) with your credentials, containing a speechSynthesis object
- wait for the voices to be loaded
- create a SpeechSynthesisUtterance
- changes : attach callbacks to the utterance (no more events)
- play the utterance

Use the imports from the new package with :
```js
import { createSpeechSynthesisPonyfill } from '@davi-ai/web-speech-cognitive-services-davi'
import type { SpeechSynthesisPonyfillType, SpeechSynthesisUtterance } from '@davi-ai/web-speech-cognitive-services-davi'
```

#### Events

You can now listen to the following events by attaching callbacks to the utterance :
- onsynthesisstart : fired when the synthesis starts
- onsynthesiscompleted : fired when the synthesis is completed
- onboundary : receive an event with the following data 
    ```js
      {
        name: string,                                                   // the word / punctuation
        elapsedTime: number,                                            // time elapsed since the beginning of the speech
        duration: number,                                               // duration of the speech for this word / punctuation
        boundaryType: 'WordBoundary' | 'PunctuationBoundary' | 'Viseme' // type of the boundary. 'Viseme' was added by us for private needs
      }
    ```
    This event is fired for each boundary and each viseme in the synthesis
- onmark : receive an event with the following data
    ```js
      {
        name: string,         // the name of the bookmark
        elapsedTime: number   // time elapsed since the beginning of the speech
      }
    ```
- onviseme : receive an event with the following data
    ```js
      {
        name: string,           // the id of the viseme
        elapsedTime: number,    // time elapsed since the beginning of the speech
        duration: 0,
        boundaryType: 'Viseme'
      }
    ```
    This event is fired for each viseme in the synthesis.
    [(Viseme id documentation here)](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/how-to-speech-synthesis-viseme?tabs=visemeid&pivots=programming-language-javascript)
- examples :
  - `utterance.onsynthesisstart = (): void => { 'Synthesis started !' }`
  - `utterance.onsynthesiscompleted = (): void => { 'Synthesis ended !' }`
  - `utterance.onboundary = (event): void => { console.log('Boundary data : ', event.boundaryType, event.name, event.elapsedTime, event.duration )}`

#### Improvements    

Using the SpeechSynthetizer class leads to several improvements in the functionalities :
- the `start` event is now linked to the `oncanplaythrough` event of the AudioElement used by the AudioContext. This allows a better synchronisation at the beginning of the speech.
- you can call `mute()` and `unmute()` on the ponyfill.speechSynthesis object anytime

#### Other Features  

##### Retrieve synthesized data

You can retrieve all data synthesized in an ArrayBuffer once the synthesis is finished, by using `ponyfill.speechSynthesis.synthesizeAndGetArrayData(utterance: SpeechSynthesisUtterance, callback: (data: ArrayBuffer) => void)`
The `data` will contain the whole synthesis and can then be used (for example you can create a Blob from these data and play it).

Example
```js
  const callback = (data: ArrayBuffer): void => {
    const blob = new Blob([data], { type: 'audio/mp3' })
    const url = URL.createObjectURL(blob)

    const audioElement = document.getElementById('myaudio')
    audioElement.src = url
    audioElement.play()
  }

  ponyfill.speechSynthesis.synthesizeAndGetArrayData(utterance, callback)
```

#### Use a stream to get data

You can pass a stream as secondary argument to the `speak` method, to prevent the synthesizer from playing the synthesized data and retrieve them in the stream on your side.
The stream must be a `AudioOutputStream.createPullStream()` object, `AudioOutputStream` coming from the `microsoft-cognitiveservices-speech-sdk` package.

Example
```js
  import { AudioOutputStream } from 'microsoft-cognitiveservices-speech-sdk'

  let stream = AudioOutputStream.createPullStream()
  ponyfill.speechSynthesis.speak(utterance, stream)
```

## SPEECH RECOGNITION
### Changes compared to original package

In order to use speech recognition, the process has been modified in order to mimic the one used in speech synthesis :
- create a speechRecognitionPonyfill with your credentials and a set of options that will be detailed below, containing a speechRecognition object
- attach callbacks to the speechRecognition object
- start recognition

Use the imports from the new package with :
```js
import { createSpeechRecognitionPonyfill } from '@davi-ai/web-speech-cognitive-services-davi'
import type { SpeechRecognitionPonyfillType, SpeechRecognitionProps } from '@davi-ai/web-speech-cognitive-services-davi'
```

#### Recognition options

```ts
interface SpeechRecognitionProps {
  autoStart?: boolean           // Start recognizing after creation
  passive?: boolean             // Passive / active recognition, see below
  wakeWords?: Array<string>     // List of words that trigger the onwakeup callback in passive mode only
  continuous?: boolean
  lang?: string
  grammarsList?: Array<string> | string
  interimResults?: boolean
  timerBeforeSpeechEnd?: number // Set delay (in ms) for recognition ending after something has been recognized (silence time at the end of the recognition)
  debug?: boolean               // Log calls to events when true
}

const options: SpeechRecognitionProps = {
  autoStart: false,
  passive: true,
  wakeWords: ['hello', 'world'],
  continuous: true,
  interimResults: true,
  grammarsList: [],
  lang: 'en-US',
  timerBeforeSpeechEnd: 3000,
  debug: false
}

const ponyfillCredentials = {
  region: 'westus',
  authorizationToken / subscriptionKey: '<connexion data>'
}

const ponyfill = createSpeechRecognitionPonyfill(
  { credentials: ponyfillCredentials },
  options
)
```

#### Modes

You can use active (passive = false) or passive mode (passive = true) for recognition. Active mode is the one that existed before, while passive mode has been added.
The passive mode is intended to run as a background task (with continuous = true), to detect specific words (wakeWords) and then call the onwakeup callback.
This comes from the fact that we can't use custom keywords in speech recognition in javascript as of today [From Microsoft docs here](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/custom-keyword-basics?pivots=programming-language-javascript)

#### Callbacks

Here is the basic implementation. You can overload each and any by attaching callbacks to your speechRecognitionPonyfill.speechRecognition, if you need.

```ts
// These 2 callbakcs are called only in active mode
onstart = (): void => {};
onend = (): void => {};

// These 2 callbakcs are called only in passive mode
onpassivestart = (): void => {};
onpassiveend = (): void => {};

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

// List of results from the current recognition (word by word in active mode, only when a recognition is finished in passive mode)
onresult = (value: Array<SpeechRecognitionResultListItem> | SpeechRecognitionResultList): void => {
  this._debug && console.log('Result : ', value);
};

// Last result when passive mode is used
onpassiveresult = (value: Array<SpeechRecognitionResultListItem> | SpeechRecognitionResultList): void => {
  this._debug && console.log('Passive Result : ', value);
};

// Called when a 'wake word' is found in the current recognition in passive mode
onwakeup = (): void => {
  this._debug && console.log('Wake up !');
};
```

#### New methods

Three new methods were implemented, to make it easier to use some functionalities :
- async changeLanguage(lang?: string): Promise<void> -> call this one to change the recognition language in one go. This method stops the current recognition, changes the language, and starts a new recognition if the continuous parameter in on.
- async toggleContinuousPassiveToActive(): Promise<void> -> when toggling from continuous passive to active mode by changing the 'passive' and 'continuous' variables, if there is a current recognition, this one will not stop and will continue, adding existing results to the future ones. In our use case, we don't want that to happen. We prefer stopping the current recognition, to start a brand new one without existing result.
- async toggleContinuousActiveToPassive(): Promise<void> -> when toggling from active to continuous passive mode by changing the 'passive' and 'continuous' variables, the current active recognition is oftern already ended, so to prevent troubles we force stopping the current recognition if it is still running, to start a new continuous one.