# web-speech-cognitive-services-davi

This package is based on a fork of [web-speech-cognitive-services](https://www.npmjs.com/package/web-speech-cognitive-services).
The primary goal is the use the SpeechSynthetizer from [microsoft-cognitiveservices-speech-sdk](https://www.npmjs.com/package/microsoft-cognitiveservices-speech-sdk) in the TTS part of the package, in order to receive the boundaries and visemes on a speech synthesis to overcome the existing issues of the original package.

## Install

```bash
npm install @davi-ai/web-speech-cognitive-services-davi
```

## Changes compared to original package

In order to use speech synthesis, you still need to use the original process :
- create a speechSynthesisPonyfill with your credentials, containing a speechSynthesis object :
- wait for the voices to be loaded
- create a SpeechSynthesisUtterance
- attach events to the utterance
- play the utterance

Use the imports from the new package with :
```js
import { createSpeechSynthesisPonyfill } from '@davi-ai/web-speech-cognitive-services-davi/lib/SpeechServices'
import type { SpeechSynthesisUtterance } from '@davi-ai/web-speech-cognitive-services-davi/lib/SpeechServices'
```

### Events

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

### Improvements    
Using the SpeechSynthetizer class leads to several improvements in the functionalities :
- the `start` event is now linked to the `oncanplaythrough` event of the AudioElement used by the AudioContext. This allows a better synchronisation at the beginning of the speech.
- you can call `mute()` and `unmute()` on the ponyfill.speechSynthesis object anytime
