package com.manu365.birdsdex;

import android.graphics.Rect;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;
import android.webkit.CookieManager;
import android.webkit.WebView;

import androidx.activity.BackEventCompat;
import androidx.activity.OnBackPressedCallback;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private static final String TAG = "BirdsDex";
    private static final String COOKIE_NAME = "__Secure-next-auth.session-token";

    // How wide a strip along each screen edge is kept away from Android's back gesture. The system's own
    // gesture zone is roughly 24-40dp, and Android caps exclusion at 200dp of height per edge.
    private static final int EDGE_WIDTH_DP = 56;
    private static final int TAB_PADDING_DP = 24;
    private static final int POLL_MS = 500;

    // The side tabs (components/nav/lateralLeft.tsx, lateralRight.tsx) are dragged in from the screen edges,
    // exactly where the back gesture starts. Their wrapper is div.group.z-90; report where they are.
    private static final String TAB_RECTS_JS =
        "(function(){var o=[];document.querySelectorAll('div.group.z-90').forEach(function(e){"
        + "var r=e.getBoundingClientRect();if(r.height>0)o.push([r.top,r.bottom,(r.left+r.right)/2<innerWidth/2?0:1].join(','));});"
        + "return o.join(';');})()";

    // last tab positions applied; the system is only told when they change, because every
    // setSystemGestureExclusionRects call is an IPC to the system and the tabs rarely move
    private String lastTabRects = null;

    private final Handler handler = new Handler(Looper.getMainLooper());
    private final Runnable pollTabs = new Runnable() {
        @Override
        public void run() {
            updateGestureExclusion();
            handler.postDelayed(this, POLL_MS);
        }
    };

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // native Google sign-in for app/login/page.tsx; plugins must be registered before super.onCreate
        registerPlugin(GoogleSignInPlugin.class);

        // Debug shortcut: Google blocks its web sign-in inside a WebView, so a debug build can start with a
        // next-auth session cookie for the default account (BuildConfig.SESSION_TOKEN, written by
        // scripts/android-session-token.mjs). Release builds leave it empty and use the real sign-in.
        // First try before the bridge loads the site; some devices drop cookies set before the WebView exists.
        setSessionCookie();
        super.onCreate(savedInstanceState);

        // The WebView exists now. If the cookie didn't stick, set it again and load the site again.
        if (!BuildConfig.SESSION_TOKEN.isEmpty() && !hasSessionCookie()) {
            Log.w(TAG, "session cookie missing after startup, setting it again and reloading");
            setSessionCookie();
            final WebView webView = getBridge().getWebView();
            webView.post(() -> webView.loadUrl(BuildConfig.SITE_URL));
        }
        Log.i(TAG, "session cookie present: " + hasSessionCookie());

        installBackHandler();
    }

    @Override
    public void onResume() {
        super.onResume();
        handler.post(pollTabs);
    }

    @Override
    public void onPause() {
        handler.removeCallbacks(pollTabs);
        super.onPause();
    }

    // The app has its own edge navigation, so Android's back swipe is ignored. Capacitor 8 has no back
    // handling of its own (that lives in @capacitor/app), so without this a back swipe closes the app.
    // Only gesture back is swallowed: the button / 3-key back still goes back in the page history, or exits.
    // Gesture vs button is told apart by handleOnBackStarted, which only gestures call (Android 14+);
    // on older versions a swipe falls through to the button behaviour, the exclusion strips still protect the tabs.
    private void installBackHandler() {
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            private boolean fromGesture = false;

            @Override
            public void handleOnBackStarted(BackEventCompat backEvent) {
                fromGesture = true;
            }

            @Override
            public void handleOnBackCancelled() {
                fromGesture = false;
            }

            @Override
            public void handleOnBackPressed() {
                boolean ignore = fromGesture;
                fromGesture = false;
                if (ignore) return;

                WebView webView = getBridge().getWebView();
                if (webView.canGoBack()) {
                    webView.goBack();
                } else {
                    finish();
                }
            }
        });
    }

    private void updateGestureExclusion() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q || getBridge() == null) return;
        final WebView webView = getBridge().getWebView();
        webView.evaluateJavascript(TAB_RECTS_JS, value -> {
            // the view size is part of the key: the rects are in view pixels, so a resize invalidates them
            String key = value + "|" + webView.getWidth() + "x" + webView.getHeight();
            if (key.equals(lastTabRects)) return;
            lastTabRects = key;

            final float density = getResources().getDisplayMetrics().density;
            final int edge = Math.round(EDGE_WIDTH_DP * density);
            final int pad = Math.round(TAB_PADDING_DP * density);
            final int maxHeight = Math.round(200 * density);
            final int width = webView.getWidth();

            List<Rect> rects = new ArrayList<>();
            // value is a JSON string such as "120.5,216.5,0;120.5,216.5,1", or "null"/"" when there is nothing
            String data = value == null ? "" : value.replace("\"", "");
            if (!data.isEmpty() && !data.equals("null")) {
                for (String tab : data.split(";")) {
                    String[] parts = tab.split(",");
                    if (parts.length != 3) continue;
                    try {
                        int top = Math.max(0, Math.round(Float.parseFloat(parts[0]) * density) - pad);
                        int bottom = Math.min(webView.getHeight(), Math.round(Float.parseFloat(parts[1]) * density) + pad);
                        if (bottom - top > maxHeight) bottom = top + maxHeight;
                        boolean right = parts[2].equals("1");
                        rects.add(right ? new Rect(width - edge, top, width, bottom) : new Rect(0, top, edge, bottom));
                    } catch (NumberFormatException ignored) {
                        // a malformed answer just means no exclusion this round
                    }
                }
            }
            webView.setSystemGestureExclusionRects(rects.isEmpty() ? Collections.emptyList() : rects);
        });
    }

    private void setSessionCookie() {
        if (BuildConfig.SESSION_TOKEN.isEmpty()) return;
        CookieManager cookies = CookieManager.getInstance();
        cookies.setAcceptCookie(true);
        cookies.setCookie(
            BuildConfig.SITE_URL,
            COOKIE_NAME + "=" + BuildConfig.SESSION_TOKEN + "; Path=/; Secure; HttpOnly; SameSite=Lax"
        );
        cookies.flush();
    }

    private boolean hasSessionCookie() {
        String stored = CookieManager.getInstance().getCookie(BuildConfig.SITE_URL);
        return stored != null && stored.contains(COOKIE_NAME + "=");
    }
}
