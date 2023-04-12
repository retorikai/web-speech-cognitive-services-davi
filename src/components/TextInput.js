import React from 'react';

const TextInput = ({ voices, onTextChange, onVoiceChange, onSpeak }) => {
  return (
    <div>
      <label htmlFor="text-input">Texte à synthétiser</label>
      <br />
      <textarea id="text-input" onChange={onTextChange}></textarea>
      <br />
      <label htmlFor="voice-select">Voix</label>
      <br />
      <select id="voice-select" onChange={onVoiceChange}>
        {voices.map((voice) => (
          <option key={voice.voiceURI} value={voice.voiceURI}>
            {voice.name} ({voice.lang})
          </option>
        ))}
      </select>
      <br />
      <button onClick={onSpeak}>Synthétiser</button>
    </div>
  );
};

export default TextInput;
