import { useDispatch, useSelector } from 'react-redux';
// eslint-disable-next-line no-unused-vars
import React, { useCallback } from 'react';

// eslint-disable-next-line no-unused-vars
import Select, { Option } from '../Bootstrap/Select';
import setSpeechRecognitionLanguage from '../data/actions/setSpeechRecognitionLanguage';

const RegionSelector = () => {
  const speechRecognitionLanguage = useSelector(({ speechRecognitionLanguage }) => speechRecognitionLanguage);
  const dispatch = useDispatch();
  const dispatchSetSpeechRecognitionLanguage = useCallback(
    value => dispatch(setSpeechRecognitionLanguage(value)),
    [dispatch]
  );

  return (
    <Select onChange={dispatchSetSpeechRecognitionLanguage} value={speechRecognitionLanguage}>
      <Option text="Chinese (Cantonese)" value="zh-HK" />
      <Option text="Chinese (Putonghua)" value="zh-CN" />
      <Option text="English (US)" value="en-US" />
      <Option text="French (France)" value="fr-FR" />
      <Option text="Japanese" value="ja-JP" />
      <Option text="Korean" value="ko-KR" />
    </Select>
  );
};

export default RegionSelector;
