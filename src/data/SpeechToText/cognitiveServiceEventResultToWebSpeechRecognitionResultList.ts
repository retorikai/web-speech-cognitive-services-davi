import arrayToMap from '../../utils/arrayToMap';
import SpeechSDK from '../SpeechSDK';
import type {
  SpeechRecognitionResultListItem,
  SpeechRecognitionResultList,
  SpeechRecognitionResultParsed
} from '../../models/speechtypes';

const {
  ResultReason: { RecognizingSpeech, RecognizedSpeech }
} = SpeechSDK;

export default function (
  result: SpeechRecognitionResultParsed,
  { maxAlternatives = Infinity, textNormalization = 'display' } = {}
): SpeechRecognitionResultList {
  if (result.reason === RecognizingSpeech || (result.reason === RecognizedSpeech && !result.json.NBest)) {
    const resultList: SpeechRecognitionResultList = [
      {
        confidence: 0.5,
        transcript: result.text
      }
    ];

    if (result.reason === RecognizedSpeech) {
      resultList.isFinal = true;
    }

    return resultList;
  } else if (result.reason === RecognizedSpeech) {
    const resultList: SpeechRecognitionResultList = arrayToMap(
      (result.json.NBest || []).slice(0, maxAlternatives).map(
        ({
          Confidence: confidence,
          Display: display,
          ITN: itn,
          Lexical: lexical,
          MaskedITN: maskedITN
        }): SpeechRecognitionResultListItem => ({
          confidence,
          transcript:
            textNormalization === 'itn'
              ? itn
              : textNormalization === 'lexical'
              ? lexical
              : textNormalization === 'maskeditn'
              ? maskedITN
              : display
        })
      ),
      { isFinal: true }
    );

    return resultList;
  }

  return [];
}
