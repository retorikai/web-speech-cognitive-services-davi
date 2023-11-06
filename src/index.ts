import createSpeechRecognitionPonyfill, { createSpeechRecognitionPonyfillFromRecognizer } from './data/SpeechToText/createSpeechRecognitionPonyfill';
import { SpeechSynthesis, createSpeechSynthesisPonyfill } from './data/TextToSpeech/createSpeechSynthesisPonyfill';
import fetchAuthorizationToken from './data/fetchAuthorizationToken';
import SpeechSynthesisUtterance from './data/TextToSpeech/SpeechSynthesisUtterance';
import type { PonyfillOptions } from './models/credentialTypes';
import type { SpeechSynthesisPonyfillType } from './models/ponyfillTypes';
import type { SpeechSynthesisEventProps } from './models/speechtypes';

export default function createSpeechServicesPonyfill(options: PonyfillOptions) {
  return {
    ...createSpeechRecognitionPonyfill(options),
    ...createSpeechSynthesisPonyfill(options)
  };
}

export {
  createSpeechRecognitionPonyfill,
  createSpeechRecognitionPonyfillFromRecognizer,
  createSpeechSynthesisPonyfill,
  fetchAuthorizationToken,
  SpeechSynthesisUtterance,
  SpeechSynthesis
};

export type { PonyfillOptions, SpeechSynthesisPonyfillType, SpeechSynthesisEventProps }
