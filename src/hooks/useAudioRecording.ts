/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useRef, useState } from 'react';

import { WhisperService } from '@/lib/services/whisper.service';

const getRecordingErrorMessage = (error: unknown): string => {
  if (error instanceof DOMException) {
    return [error.name, error.message].filter(Boolean).join(': ');
  }

  if (error instanceof Error) {
    return error.message || error.name;
  }

  if (typeof error === 'string') {
    return error;
  }

  return 'Unknown recording error';
};

interface UseAudioRecordingProps {
  onTranscriptionComplete?: (text: string) => void;
  onNoAudioDetected?: () => void; // Callback when no meaningful audio is detected
  silenceThreshold?: number; // Threshold for silence detection (0-1)
  silenceTimeout?: number; // Time in milliseconds before stopping after silence
}

export const useAudioRecording = ({
  onTranscriptionComplete,
  onNoAudioDetected,
  silenceThreshold = 0.08, // Default threshold - adjust as needed
  silenceTimeout = 2000, // Default 2 seconds
}: UseAudioRecordingProps) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recorderRef = useRef<any>(null);
  const meaningfulAudioDetectedRef = useRef<boolean>(false);

  // Refs for silence detection
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const dataArrayRef = useRef<Uint8Array<ArrayBuffer> | null>(null);
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastAudioTimeRef = useRef<number>(0);

  // Cleanup function for audio analysis
  const cleanupAudioAnalysis = useCallback(() => {
    if (silenceTimerRef.current) {
      clearInterval(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }

    if (audioContextRef.current) {
      audioContextRef.current.close().catch(console.error);
      audioContextRef.current = null;
    }

    analyserRef.current = null;
    dataArrayRef.current = null;
  }, []);

  // Clean up resources when component unmounts
  useEffect(() => {
    return () => {
      cleanupAudioAnalysis();
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
    };
  }, [cleanupAudioAnalysis]);

  const stopRecording = useCallback(async () => {
    console.log('Stopping recording...');
    const currentRecorder = recorderRef.current;
    if (!currentRecorder) {
      console.log('No recorder instance found to stop');
      return;
    }

    // Clean up silence detection
    cleanupAudioAnalysis();

    return new Promise<void>((resolve) => {
      setIsProcessing(true);
      currentRecorder.stopRecording(async () => {
        const blob = currentRecorder.getBlob();

        // Check if meaningful audio was detected
        if (!meaningfulAudioDetectedRef.current) {
          console.log('No meaningful audio detected, skipping transcription');
          onNoAudioDetected?.();
          currentRecorder.destroy();
          recorderRef.current = null;
          setIsRecording(false);
          setIsProcessing(false);

          // Stop all tracks in the stream
          if (streamRef.current) {
            streamRef.current.getTracks().forEach((track) => track.stop());
            streamRef.current = null;
          }

          resolve();
          return;
        }

        try {
          const transcription = await WhisperService.transcribe(blob);
          onTranscriptionComplete?.(transcription);
        } catch (err) {
          setError(
            'Failed to transcribe audio: ' + getRecordingErrorMessage(err)
          );
          console.error('Transcription error:', err);
        }

        currentRecorder.destroy();
        recorderRef.current = null;
        setIsRecording(false);
        setIsProcessing(false);

        // Stop all tracks in the stream
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((track) => track.stop());
          streamRef.current = null;
        }

        resolve();
      });
    });
  }, [onTranscriptionComplete, onNoAudioDetected, cleanupAudioAnalysis]);

  const startRecording = useCallback(async () => {
    try {
      // Check if the browser supports getUserMedia
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        // Fallbacks for older browsers or specific mobile implementations
        const getUserMedia =
          navigator.mediaDevices?.getUserMedia ||
          (navigator as any).webkitGetUserMedia ||
          (navigator as any).mozGetUserMedia ||
          (navigator as any).msGetUserMedia;

        if (!getUserMedia) {
          throw new Error(
            'Your browser does not support audio recording. Please try using a different browser.'
          );
        }
      }

      // Cleanup any existing resources
      cleanupAudioAnalysis();

      // iOS Safari requires specific audio constraints
      const audioConstraints = {
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 44100,
          channelCount: 1,
        },
      };

      const stream =
        await navigator.mediaDevices.getUserMedia(audioConstraints);
      streamRef.current = stream;

      const RecordRTC = (await import('recordrtc')).default;
      const newRecorder = new RecordRTC(stream, {
        type: 'audio',
        mimeType: 'audio/wav',
        recorderType: RecordRTC.StereoAudioRecorder,
        numberOfAudioChannels: 1,
        sampleRate: 44100,
        // iOS Safari compatibility
        disableLogs: true,
        timeSlice: 1000,
        ondataavailable: () => {},
      });

      // Setup audio analysis for silence detection
      const audioContext = new (
        window.AudioContext || (window as any).webkitAudioContext
      )();
      audioContextRef.current = audioContext;

      const analyser = audioContext.createAnalyser();
      analyserRef.current = analyser;
      analyser.fftSize = 256;

      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);

      const bufferLength = analyser.frequencyBinCount;
      const freqBuf: ArrayBuffer = new ArrayBuffer(bufferLength); // 1 byte per bin
      const dataArray: Uint8Array<ArrayBuffer> = new Uint8Array(freqBuf);
      dataArrayRef.current = dataArray;

      // Set initial time
      lastAudioTimeRef.current = Date.now();

      // Start recorder first to ensure isRecording is true
      newRecorder.startRecording();
      recorderRef.current = newRecorder; // Track the current recorder instance
      setIsRecording(true);
      setError(null);
      meaningfulAudioDetectedRef.current = false; // Reset meaningful audio detection

      // Start checking for silence - using setTimeout to ensure state is updated
      setTimeout(() => {
        silenceTimerRef.current = setInterval(() => {
          if (!analyserRef.current || !dataArrayRef.current) return;

          analyserRef.current.getByteFrequencyData(dataArrayRef.current);

          // Calculate audio level
          const sum = dataArrayRef.current.reduce((acc, val) => acc + val, 0);
          const average = sum / dataArrayRef.current.length / 255; // Normalized 0-1

          console.log(
            `Audio level: ${average.toFixed(4)}, threshold: ${silenceThreshold}`
          );

          if (average > silenceThreshold) {
            // Audio detected, update the timestamp
            lastAudioTimeRef.current = Date.now();
            meaningfulAudioDetectedRef.current = true;
            console.log('Audio detected, updated timestamp');
          } else {
            // Check if silence duration exceeds our threshold
            const silenceDuration = Date.now() - lastAudioTimeRef.current;
            console.log(
              `Silence duration: ${silenceDuration}ms / ${silenceTimeout}ms`
            );

            if (silenceDuration >= silenceTimeout) {
              console.log(
                `Silence threshold reached (${silenceDuration}ms), stopping recording`
              );
              stopRecording();
              clearInterval(silenceTimerRef.current!);
              silenceTimerRef.current = null;
            }
          }
        }, 100); // Check every 100ms
      }, 500);
    } catch (err) {
      const errorMessage = getRecordingErrorMessage(err);
      let userFriendlyError = 'Failed to start recording. ';

      // iOS-specific error handling
      if (
        errorMessage.includes('Permission denied') ||
        errorMessage.includes('NotAllowedError')
      ) {
        userFriendlyError += 'Please allow microphone access and try again.';
      } else if (
        errorMessage.includes('NotFoundError') ||
        errorMessage.includes('NotReadableError')
      ) {
        userFriendlyError +=
          'No microphone found. Please check your device settings.';
      } else if (errorMessage.includes('NotSupportedError')) {
        userFriendlyError +=
          'Your browser does not support audio recording. Please try Safari or Chrome.';
      } else {
        userFriendlyError += 'Please refresh the page and try again.';
      }

      setError(userFriendlyError);
      console.error('Recording error:', err);
    }
  }, [silenceThreshold, silenceTimeout, cleanupAudioAnalysis, stopRecording]);

  return {
    isRecording,
    startRecording,
    stopRecording,
    isProcessing,
    error,
  };
};
