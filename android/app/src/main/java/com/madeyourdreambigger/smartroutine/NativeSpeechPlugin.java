package com.madeyourdreambigger.smartroutine;

import android.Manifest;
import android.content.Intent;
import android.os.Bundle;
import android.speech.RecognitionListener;
import android.speech.RecognizerIntent;
import android.speech.SpeechRecognizer;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import java.util.ArrayList;

@CapacitorPlugin(
    name = "NativeSpeech",
    permissions = { @Permission(alias = "microphone", strings = { Manifest.permission.RECORD_AUDIO }) }
)
public class NativeSpeechPlugin extends Plugin implements RecognitionListener {
    private SpeechRecognizer speechRecognizer;
    private PluginCall pendingCall;

    @PluginMethod
    public void start(PluginCall call) {
        if (pendingCall != null) {
            call.reject("Speech recognition is already running.");
            return;
        }
        pendingCall = call;
        if (getPermissionState("microphone") != PermissionState.GRANTED) {
            requestPermissionForAlias("microphone", call, "onMicrophonePermission");
            return;
        }
        startRecognition(call);
    }

    @PermissionCallback
    private void onMicrophonePermission(PluginCall call) {
        if (call != pendingCall) {
            return;
        }
        if (getPermissionState("microphone") != PermissionState.GRANTED) {
            finishWithError("Microphone permission was not granted.", "PERMISSION_DENIED");
            return;
        }
        startRecognition(call);
    }

    private void startRecognition(PluginCall call) {
        if (call != pendingCall) {
            return;
        }
        if (!SpeechRecognizer.isRecognitionAvailable(getContext())) {
            finishWithError("Speech recognition is not available on this device.", "UNAVAILABLE");
            return;
        }
        getActivity().runOnUiThread(() -> {
            if (call != pendingCall) {
                return;
            }
            try {
                speechRecognizer = SpeechRecognizer.createSpeechRecognizer(getContext());
                speechRecognizer.setRecognitionListener(this);
                Intent intent = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
                intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
                intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE, "en-US");
                intent.putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1);
                intent.putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, false);
                intent.putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS, 3500L);
                intent.putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_POSSIBLY_COMPLETE_SILENCE_LENGTH_MILLIS, 3000L);
                intent.putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_MINIMUM_LENGTH_MILLIS, 1500L);
                speechRecognizer.startListening(intent);
            } catch (RuntimeException error) {
                finishWithError("Could not start Android speech recognition.", "UNAVAILABLE");
            }
        });
    }

    @PluginMethod
    public void stop(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            if (speechRecognizer != null) {
                speechRecognizer.cancel();
            }
            finishWithError("Speech recognition was stopped.", "CANCELED");
            call.resolve();
        });
    }

    @Override
    public void onResults(Bundle results) {
        ArrayList<String> matches = results.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
        if (matches == null || matches.isEmpty() || matches.get(0).trim().isEmpty()) {
            finishWithError("No speech was recognized.", "NO_MATCH");
            return;
        }
        JSObject result = new JSObject();
        result.put("transcript", matches.get(0).trim());
        finishWithResult(result);
    }

    @Override
    public void onError(int error) {
        String code = error == SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS
            ? "PERMISSION_DENIED"
            : error == SpeechRecognizer.ERROR_NO_MATCH || error == SpeechRecognizer.ERROR_SPEECH_TIMEOUT
                ? "NO_MATCH"
                : "UNAVAILABLE";
        finishWithError("Android could not recognize speech.", code);
    }

    private void finishWithResult(JSObject result) {
        PluginCall call = pendingCall;
        pendingCall = null;
        releaseRecognizer();
        if (call != null) call.resolve(result);
    }

    private void finishWithError(String message, String code) {
        PluginCall call = pendingCall;
        pendingCall = null;
        releaseRecognizer();
        if (call != null) call.reject(message, code);
    }

    private void releaseRecognizer() {
        if (speechRecognizer != null) {
            speechRecognizer.destroy();
            speechRecognizer = null;
        }
    }

    @Override
    protected void handleOnDestroy() {
        finishWithError("The app closed during speech recognition.", "CANCELED");
    }

    @Override public void onReadyForSpeech(Bundle params) {}
    @Override public void onBeginningOfSpeech() {}
    @Override public void onRmsChanged(float rmsdB) {}
    @Override public void onBufferReceived(byte[] buffer) {}
    @Override public void onEndOfSpeech() {}
    @Override public void onPartialResults(Bundle partialResults) {}
    @Override public void onEvent(int eventType, Bundle params) {}
}
