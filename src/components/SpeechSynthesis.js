// Importation des modules nécessaires
import React from "react";
import SpeechSynthesisUtterance from "web-speech-cognitive-services/lib/SpeechServices/TextToSpeech/SpeechSynthesisUtterance";

// Composant pour la synthèse vocale
const SpeechSynthesis = ({ text, selectedVoice, voicesLoaded }) => {
  // Fonction pour gérer la synthèse vocale
  const handleSpeak = () => {
    // Vérification que les voix sont chargées
    if (!voicesLoaded) {
      return;
    }

    // Récupération des voix disponibles
    const voices = window.speechSynthesis.getVoices();

    // Récupération de la voix sélectionnée
    const selectedVoiceObj = voices.find(
      (voice) => voice.voiceURI === selectedVoice
    );

    // Vérification que la voix sélectionnée est disponible
    if (!selectedVoiceObj) {
      console.error("La voix sélectionnée n'est pas disponible.");
      return;
    }

    // Création d'une nouvelle instance de SpeechSynthesisUtterance avec le texte et la voix sélectionnée
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.voice = selectedVoiceObj;

    // Appel à la méthode speak pour lancer la synthèse vocale
    window.speechSynthesis.speak(utterance);
  };

  // Rendu du composant
  return (
    <div>
      <button onClick={handleSpeak}>Synthétiser</button>
    </div>
  );
};

export default SpeechSynthesis;
