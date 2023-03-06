// Importation des modules nécessaires
import React, { useState, useEffect, useMemo, useCallback } from "react";
import fetchVoices from "web-speech-cognitive-services/lib/SpeechServices/TextToSpeech/fetchVoices";
import SpeechSynthesisVoice from "web-speech-cognitive-services/lib/SpeechServices/TextToSpeech/SpeechSynthesisVoice";
import { createSpeechSynthesisPonyfill } from "web-speech-cognitive-services/lib/SpeechServices";
import dotenv from "dotenv";
dotenv.config();

// Composant principal
const WebsocketLoadVoices = ({ onVoicesChanged }) => {
  // Etat pour vérifier si les voix sont chargées
  const [voicesLoaded, setVoicesLoaded] = useState(false);

  // Informations de connexion à l'API
  const ponyfillCredentials = useMemo(
    () => ({
      region: "westeurope",
      subscriptionKey: "f5f61ee8c7334f6ab967d007d970638b",
    }),
    []
  );

  // Création de la bibliothèque de synthèse vocale
  const ponyfill = useMemo(() => {
    return createSpeechSynthesisPonyfill({ credentials: ponyfillCredentials });
  }, [ponyfillCredentials]);

  // Fonction pour récupérer le jeton d'authentification
  const fetchToken = useCallback(async () => {
    const response = await fetch(
      "https://westeurope.api.cognitive.microsoft.com/sts/v1.0/issueToken",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "Ocp-Apim-Subscription-Key": ponyfillCredentials.subscriptionKey,
        },
      }
    );
    const token = await response.text();
    return token;
  }, [ponyfillCredentials.subscriptionKey]);

  // Fonction pour mettre à jour les voix disponibles
  const updateVoices = useCallback(async () => {
    try {
      const authorizationToken = await fetchToken();
      const voices = await fetchVoices({
        authorizationToken,
        region: "westeurope",
        speechSynthesisHostname: "westeurope.tts.speech.microsoft.com",
      });
      const mappedVoices = voices.map(
        ({ gender, lang, voiceURI }) =>
          new SpeechSynthesisVoice({ gender, lang, voiceURI })
      );
      onVoicesChanged(mappedVoices);
    } catch (error) {
      console.error("Failed to update voices", error);
    }
  }, [fetchToken, onVoicesChanged]);

  // Effet pour vérifier si les voix sont chargées
  useEffect(() => {
    // Fonction pour vérifier si les voix sont disponibles
    const checkVoicesLoaded = () => {
      if (!ponyfill.speechSynthesis) return false;
      const currentVoices = ponyfill.speechSynthesis.getVoices();
      return currentVoices && currentVoices.length > 0;
    };

    // Fonction pour gérer le changement de voix
    const handleVoicesChanged = () => {
      const loaded = checkVoicesLoaded();
      setVoicesLoaded(loaded);
      if (loaded) {
        const newVoices = ponyfill.speechSynthesis.getVoices();
        onVoicesChanged(newVoices);
      }
    };

    // Vérification de la disponibilité des voix et mise à jour en cas de besoin
    if (checkVoicesLoaded()) {
      setVoicesLoaded(true);
      onVoicesChanged(ponyfill.speechSynthesis.getVoices());
    } else {
      ponyfill.speechSynthesis.addEventListener(
        "voiceschanged",
        handleVoicesChanged
      );
      updateVoices();
    }

    // Nettoyage de l'événement lors du démontage du composant
    return () => {
      ponyfill.speechSynthesis.removeEventListener(
        "voiceschanged",
        handleVoicesChanged
      );
    };
  }, [ponyfill, updateVoices, onVoicesChanged]);

  // Rendu du composant
  return <div>{!voicesLoaded && <p>Chargement des voix en cours...</p>}</div>;
};

export default WebsocketLoadVoices;
