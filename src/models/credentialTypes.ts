import { AudioConfig } from "microsoft-cognitiveservices-speech-sdk"

interface Credentials {
  region?: string
  subscriptionKey?: string
  authorizationToken?: string,
  customVoiceHostname?: string,
  speechRecognitionHostname?: string,
  speechSynthesisHostname?: string,
}

interface PonyfillOptions {
  credentials: Credentials
  looseEvents?: boolean
  audioContext?: AudioContext 
  ponyfill?: {
    AudioContext?: AudioContext
  }
  speechSynthesisDeploymentId?: string
}

interface PatchOptions extends PonyfillOptions {
  fetchCredentials?: Function
  audioConfig?: AudioConfig
  enableTelemetry?: boolean
  referenceGrammars?: any
  speechRecognitionEndpointId?: string
  textNormalization?: string
  [key: string]: any
}

export type { Credentials, PonyfillOptions, PatchOptions }
