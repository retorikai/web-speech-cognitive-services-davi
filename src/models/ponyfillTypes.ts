import { SpeechSynthesis } from "../data/TextToSpeech/createSpeechSynthesisPonyfill"
import SpeechSynthesisUtterance from "../data/TextToSpeech/SpeechSynthesisUtterance"

interface SpeechSynthesisPonyfillType {
  speechSynthesis: SpeechSynthesis
  SpeechSynthesisUtterance: typeof SpeechSynthesisUtterance
}

interface SpeechRecognitionProps {
  passive?: boolean
  wakeWords?: Array<string>
  continuous?: boolean
  lang?: string
  grammarsList?: Array<string> | string
  interimResults?: boolean
}

export type { SpeechSynthesisPonyfillType, SpeechRecognitionProps }
