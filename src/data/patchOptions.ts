import { Credentials, PatchOptions } from '../models/credentialTypes';
import resolveFunctionOrReturnValue from './resolveFunctionOrReturnValue';

let shouldWarnOnSubscriptionKey = true;

export default function patchOptions({
  credentials,
  looseEvents,
  ...otherOptions
}: PatchOptions ) {
  if (!credentials) {
    throw new Error('web-speech-cognitive-services: Credentials must be specified.');
  }

  return {
    ...otherOptions,
    fetchCredentials: async () => {
      const {
        authorizationToken,
        customVoiceHostname,
        region,
        speechRecognitionHostname,
        speechSynthesisHostname,
        subscriptionKey
      } = await resolveFunctionOrReturnValue(credentials);

      if ((!authorizationToken && !subscriptionKey) || (authorizationToken && subscriptionKey)) {
        throw new Error(
          'web-speech-cognitive-services: Either "authorizationToken" or "subscriptionKey" must be provided.'
        );
      } else if (!region && !(speechRecognitionHostname && speechSynthesisHostname)) {
        throw new Error(
          'web-speech-cognitive-services: Either "region" or "speechRecognitionHostname" and "speechSynthesisHostname" must be set.'
        );
      } else if (region && (customVoiceHostname || speechRecognitionHostname || speechSynthesisHostname)) {
        throw new Error(
          'web-speech-cognitive-services: Only either "region" or "customVoiceHostname", "speechRecognitionHostname" and "speechSynthesisHostname" can be set.'
        );
      } else if (authorizationToken) {
        if (typeof authorizationToken !== 'string') {
          throw new Error('web-speech-cognitive-services: "authorizationToken" must be a string.');
        }
      } else if (typeof subscriptionKey !== 'string') {
        throw new Error('web-speech-cognitive-services: "subscriptionKey" must be a string.');
      }

      if (shouldWarnOnSubscriptionKey && subscriptionKey) {
        console.warn(
          'web-speech-cognitive-services: In production environment, subscription key should not be used, authorization token should be used instead.'
        );

        shouldWarnOnSubscriptionKey = false;
      }

      const resolvedCredentials: Credentials = {
        region,
        authorizationToken,
        subscriptionKey,
        customVoiceHostname,
        speechRecognitionHostname,
        speechSynthesisHostname
      };

      return resolvedCredentials;
    },
    looseEvents
  };
}
