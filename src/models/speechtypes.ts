import type { SpeechRecognitionResult } from "microsoft-cognitiveservices-speech-sdk"

interface SpeechSynthesisEventProps {
  boundaryType: string
  name: string
  elapsedTime: number
  duration: number
}

interface SpeechRecognitionResultListItem {
  confidence: number
  transcript: string
}

interface SpeechRecognitionResultList extends Array<SpeechRecognitionResultListItem> {
  isFinal?: boolean
}

interface NBest {
  Confidence: number
  Lexical: string
  ITN: string
  MaskedITN: string
  Display: string
}

interface SpeechRecognitionResultParsed extends Omit<SpeechRecognitionResult, 'json'|'speakerId'|'language'|'languageDetectionConfidence'> {
  json: {
    Channel?: number
    Displaytext?: string
    Duration?: number
    Id: string
    NBest?: Array<NBest>
    Offset?: number
    RecognitionStatus?: number
  }
}

export type { SpeechSynthesisEventProps, SpeechRecognitionResultListItem, SpeechRecognitionResultList, SpeechRecognitionResultParsed }
