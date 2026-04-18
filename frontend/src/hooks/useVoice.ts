/**
 * useVoice — Web Speech API hook for local TTS.
 *
 * Synthesis runs entirely in the browser using OS voices (macOS, Windows,
 * Linux all provide built-in voices).  No audio data ever leaves the device.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getVoiceSettings, updateVoiceSettings } from "@/api/voice";

export function useVoiceSettings() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["voice-settings"],
    queryFn: getVoiceSettings,
    staleTime: 60_000,
  });

  const mutation = useMutation({
    mutationFn: updateVoiceSettings,
    onSuccess: (updated) => {
      qc.setQueryData(["voice-settings"], updated);
    },
  });

  return { settings: data, isLoading, update: mutation.mutate };
}

export function useSpeech() {
  const { settings } = useVoiceSettings();
  const [speaking, setSpeaking] = useState(false);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      window.speechSynthesis?.cancel();
    };
  }, []);

  const speak = useCallback(
    (text: string) => {
      if (!("speechSynthesis" in window)) return;
      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = settings?.rate ?? 1.0;
      utterance.pitch = settings?.pitch ?? 1.0;
      utterance.onstart = () => setSpeaking(true);
      utterance.onend = () => setSpeaking(false);
      utterance.onerror = () => setSpeaking(false);

      utteranceRef.current = utterance;
      window.speechSynthesis.speak(utterance);
    },
    [settings]
  );

  const stop = useCallback(() => {
    window.speechSynthesis?.cancel();
    setSpeaking(false);
  }, []);

  return { speak, stop, speaking, supported: "speechSynthesis" in window };
}
