import { SpeechRecognition } from "../data/SpeechToText/createSpeechRecognitionPonyfill"
import { SpeechSynthesis } from "../data/TextToSpeech/createSpeechSynthesisPonyfill"
import SpeechSynthesisUtterance from "../data/TextToSpeech/SpeechSynthesisUtterance"

interface SpeechSynthesisPonyfillType {
  speechSynthesis: SpeechSynthesis
  SpeechSynthesisUtterance: typeof SpeechSynthesisUtterance
}

interface SpeechRecognitionPonyfillType {
  speechRecognition: SpeechRecognition
}

interface SpeechRecognitionProps {
  autoStart?: boolean
  passive?: boolean
  wakeWords?: Array<string>
  continuous?: boolean
  lang?: string
  grammarsList?: Array<string> | string
  interimResults?: boolean
  debug?: boolean
}

export type { SpeechSynthesisPonyfillType, SpeechRecognitionPonyfillType, SpeechRecognitionProps }
