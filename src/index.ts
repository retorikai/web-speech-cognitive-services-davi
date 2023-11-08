import { createSpeechRecognitionPonyfill } from './data/SpeechToText/createSpeechRecognitionPonyfill';
import { SpeechSynthesis, createSpeechSynthesisPonyfill } from './data/TextToSpeech/createSpeechSynthesisPonyfill';
import fetchAuthorizationToken from './data/fetchAuthorizationToken';
import SpeechSynthesisUtterance from './data/TextToSpeech/SpeechSynthesisUtterance';
import type { PonyfillOptions } from './models/credentialTypes';
import type {
  SpeechRecognitionProps,
  SpeechSynthesisPonyfillType,
  SpeechRecognitionPonyfillType
} from './models/ponyfillTypes';
import type {
  SpeechSynthesisEventProps,
  SpeechRecognitionResultList,
  SpeechRecognitionResultListItem
} from './models/speechtypes';

export default function createSpeechServicesPonyfill(
  options: PonyfillOptions,
  recognitionData?: SpeechRecognitionProps
) {
  return {
    ...createSpeechRecognitionPonyfill(options, recognitionData),
    ...createSpeechSynthesisPonyfill(options)
  };
}

export {
  createSpeechRecognitionPonyfill,
  createSpeechSynthesisPonyfill,
  fetchAuthorizationToken,
  SpeechSynthesisUtterance,
  SpeechSynthesis
};

export type {
  PonyfillOptions,
  SpeechSynthesisPonyfillType,
  SpeechSynthesisEventProps,
  SpeechRecognitionProps,
  SpeechRecognitionPonyfillType,
  SpeechRecognitionResultList,
  SpeechRecognitionResultListItem
};
