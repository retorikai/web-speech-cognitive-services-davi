// Importation des modules nécessaires
import React, { useState } from "react";
import SpeechSynthesisUtterance from "web-speech-cognitive-services/lib/SpeechServices/TextToSpeech/SpeechSynthesisUtterance";
import WebsocketLoadVoices from "./WebsocketLoadVoices";
import TextInput from "./TextInput";

// Composant principal
const RenderedSynthesisText = () => {
  // Etats pour les voix, leur chargement, la valeur du texte et la voix sélectionnée
  const [voices, setVoices] = useState([]);
  const [voicesLoaded, setVoicesLoaded] = useState(false);
  const [textValue, setTextValue] = useState("");
  const [selectedVoice, setSelectedVoice] = useState("");

  // Fonction pour mettre à jour les voix disponibles
  const handleVoicesChanged = (newVoices) => {
    setVoices(newVoices);
    setVoicesLoaded(true);
  };

  // Fonction pour mettre à jour la valeur du texte
  const handleTextChange = (event) => {
    setTextValue(event.target?.value);
  };

  // Fonction pour mettre à jour la voix sélectionnée
  const handleVoiceChange = (event) => {
    setSelectedVoice(event.target?.value);
  };

  // Fonction pour synthétiser le texte avec la voix sélectionnée
  const handleSpeak = () => {
    console.log("onSpeak called with", textValue, selectedVoice);
    if (!voicesLoaded) {
      return;
    }
    const voices = window.speechSynthesis.getVoices();
    const selectedVoiceObj = voices.find(
      (voice) => voice.voiceURI === selectedVoice
    );
    if (!selectedVoiceObj) {
      console.error("La voix sélectionnée n'est pas disponible.");
      return;
    }
    const utterance = new SpeechSynthesisUtterance(textValue);
    utterance.voice = selectedVoiceObj;
    window.speechSynthesis.speak(utterance);
  };

  return (
    <div>
      <WebsocketLoadVoices onVoicesChanged={handleVoicesChanged} />
      <br />
      {voicesLoaded ? (
        <TextInput
          voices={voices}
          onTextChange={handleTextChange}
          onVoiceChange={handleVoiceChange}
          onSpeak={handleSpeak}
        />
      ) : (
        <p>Chargement des voix en cours...</p>
      )}
    </div>
  );
};

export default RenderedSynthesisText;
