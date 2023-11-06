/* eslint no-magic-numbers: ["error", { "ignore": [0, 1, 100] }] */
import { SSMLProps } from "../../models/voiceTypes";

// Cognitive Services does not support unsigned percentage
// It must be converted into +/- first.
function relativePercentage(value: number): string {
  const num = Math.round((value - 1) * 100)
  let relative: string = `${num}%`;

  return num > 0 ? `+${relative}` : relative
}

export default function buildSSML({ lang, pitch = 1, rate = 1, text, voice, volume }: SSMLProps): string {
  return `<speak version="1.0" xml:lang="${lang}">
    <voice xml:lang="${lang}" name="${voice}">
      <prosody pitch="${relativePercentage(pitch)}" rate="${relativePercentage(rate)}" volume="${relativePercentage(
      volume
    )}">
        ${text}
      </prosody>
    </voice>
  </speak>`;
}
