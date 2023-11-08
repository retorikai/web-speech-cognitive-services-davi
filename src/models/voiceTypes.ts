interface VoiceProps {
  gender: string;
  lang: string;
  voiceURI: string;
}

interface SSMLProps {
  lang: string
  pitch?: number
  rate?: number
  text: string
  voice: string
  volume: number
}

export type { VoiceProps, SSMLProps }
