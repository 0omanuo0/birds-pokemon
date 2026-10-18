package com.manu365.birdsdex;

import android.util.Log;

import androidx.annotation.NonNull;
import androidx.core.content.ContextCompat;
import androidx.credentials.Credential;
import androidx.credentials.CredentialManager;
import androidx.credentials.CredentialManagerCallback;
import androidx.credentials.CustomCredential;
import androidx.credentials.GetCredentialRequest;
import androidx.credentials.GetCredentialResponse;
import androidx.credentials.exceptions.GetCredentialCancellationException;
import androidx.credentials.exceptions.GetCredentialException;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.android.libraries.identity.googleid.GetSignInWithGoogleOption;
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential;

// Native "Sign in with Google" for the web code in app/login/page.tsx (lib/nativeGoogle.ts is its JS side).
// Returns a Google ID token whose audience is the *web* client id (BuildConfig.GOOGLE_WEB_CLIENT_ID), which
// is what /api/native-login verifies. The Android OAuth client (package + signing SHA-1) only has to exist
// in the same Google Cloud project; its id is never used in code.
@CapacitorPlugin(name = "GoogleSignIn")
public class GoogleSignInPlugin extends Plugin {
    private static final String TAG = "BirdsDex";

    @PluginMethod
    public void signIn(final PluginCall call) {
        if (BuildConfig.GOOGLE_WEB_CLIENT_ID.isEmpty()) {
            call.reject("Google sign-in is not configured in this build (birdsdex.googleWebClientId)");
            return;
        }

        // the "Sign in with Google" flavour always shows the account chooser, so it works for first sign-in too
        GetSignInWithGoogleOption option = new GetSignInWithGoogleOption.Builder(BuildConfig.GOOGLE_WEB_CLIENT_ID).build();
        GetCredentialRequest request = new GetCredentialRequest.Builder().addCredentialOption(option).build();

        CredentialManager manager = CredentialManager.create(getActivity());
        manager.getCredentialAsync(
            getActivity(),
            request,
            null,
            ContextCompat.getMainExecutor(getContext()),
            new CredentialManagerCallback<GetCredentialResponse, GetCredentialException>() {
                @Override
                public void onResult(GetCredentialResponse result) {
                    Credential credential = result.getCredential();
                    if (credential instanceof CustomCredential
                        && GoogleIdTokenCredential.TYPE_GOOGLE_ID_TOKEN_CREDENTIAL.equals(credential.getType())) {
                        try {
                            GoogleIdTokenCredential google = GoogleIdTokenCredential.createFrom(credential.getData());
                            JSObject ret = new JSObject();
                            ret.put("idToken", google.getIdToken());
                            call.resolve(ret);
                        } catch (Exception e) { // GoogleIdTokenParsingException, which Kotlin doesn't declare
                            Log.e(TAG, "could not read the Google credential", e);
                            call.reject("Could not read the Google credential", e);
                        }
                    } else {
                        call.reject("Unexpected credential type: " + credential.getType());
                    }
                }

                @Override
                public void onError(@NonNull GetCredentialException e) {
                    if (e instanceof GetCredentialCancellationException) {
                        call.reject("canceled");
                        return;
                    }
                    // typical causes: no Android OAuth client for this package + SHA-1 in the web client's project,
                    // or no Google account on the phone
                    Log.e(TAG, "Google sign-in failed: " + e.getType() + " " + e.getMessage(), e);
                    call.reject("Google sign-in failed: " + e.getMessage(), e);
                }
            }
        );
    }
}
