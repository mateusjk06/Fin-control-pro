package com.fincontrolpro.app;

import android.Manifest;
import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.speech.RecognizerIntent;
import java.util.ArrayList;
import java.util.Locale;
import org.json.JSONObject;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.CookieManager;
import android.webkit.PermissionRequest;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.TextView;
import android.graphics.Color;

public final class MainActivity extends Activity {
    private static final String APP_URL = "https://mateusjk06.github.io/Fin-control-pro/";
    private static final String HOST = "mateusjk06.github.io";
    private static final String PATH = "/Fin-control-pro/";
    private static final int AUDIO_REQUEST = 3001;
    private static final int SPEECH_REQUEST = 3002;
    private WebView webView;
    private TextView offline;
    private Button retry;
    private ProgressBar progress;
    private PermissionRequest pendingAudioRequest;

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        getWindow().setStatusBarColor(Color.rgb(15,23,42));
        getWindow().setNavigationBarColor(Color.rgb(15,23,42));
        getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR);

        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setBackgroundColor(Color.rgb(15,23,42));
        progress = new ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal);
        progress.setIndeterminate(true);
        root.addView(progress, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 3));
        // Reconhecimento de voz nativo caso a WebView não tenha Web Speech API.
        Button voiceButton = new Button(this);
        voiceButton.setText("🎙 Falar com assistente");
        voiceButton.setAllCaps(false);
        voiceButton.setOnClickListener(v -> startVoiceInput());
        root.addView(voiceButton, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 48));

        FrameLayout frame = new FrameLayout(this);
        root.addView(frame, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, 1));
        webView = new WebView(this);
        frame.addView(webView, new FrameLayout.LayoutParams(-1, -1));

        LinearLayout errorBox = new LinearLayout(this);
        errorBox.setOrientation(LinearLayout.VERTICAL);
        errorBox.setPadding(32,32,32,32);
        errorBox.setGravity(android.view.Gravity.CENTER);
        errorBox.setBackgroundColor(Color.rgb(15,23,42));
        offline = new TextView(this);
        offline.setText(R.string.offline);
        offline.setTextColor(Color.WHITE);
        offline.setTextSize(17f);
        retry = new Button(this);
        retry.setText(R.string.retry);
        retry.setOnClickListener(v -> webView.reload());
        errorBox.addView(offline);
        errorBox.addView(retry);
        frame.addView(errorBox, new FrameLayout.LayoutParams(-1,-1));
        errorBox.setVisibility(View.GONE);
        offline.setTag(errorBox);

        setContentView(root);
        configureWebView();
        webView.loadUrl(resolveLaunchUrl(getIntent()));
    }

    private boolean trusted(Uri uri) {
        if(uri == null) return false;
        return "https".equalsIgnoreCase(uri.getScheme()) &&
                HOST.equalsIgnoreCase(uri.getHost()) &&
                uri.getPath() != null &&
                (uri.getPath().equals("/Fin-control-pro") || uri.getPath().startsWith(PATH));
    }

    private String resolveLaunchUrl(Intent intent) {
        Uri data = intent != null ? intent.getData() : null;
        if(data != null && "fincontrolpro".equals(data.getScheme()) &&
                "assistente".equals(data.getHost())) {
            String cmd=data.getQueryParameter("fincontrol_cmd");
            Uri.Builder builder=Uri.parse(APP_URL).buildUpon().appendQueryParameter("assistente","1");
            if(cmd != null && cmd.length() <= 500)builder.appendQueryParameter("fincontrol_cmd",cmd);
            return builder.build().toString();
        }
        return APP_URL;
    }

    private void configureWebView() {
        WebSettings settings=webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setJavaScriptCanOpenWindowsAutomatically(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setMediaPlaybackRequiresUserGesture(true);
        if(Build.VERSION.SDK_INT >= 26) settings.setSafeBrowsingEnabled(true);
        CookieManager.getInstance().setAcceptCookie(true);
        CookieManager.getInstance().setAcceptThirdPartyCookies(webView,false);
        webView.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri=request.getUrl();
                if(trusted(uri))return false;
                if(!request.isForMainFrame())return false; // Firebase CDN and API resources still load normally.
                openExternal(uri);
                return true;
            }
            @Override public void onPageStarted(WebView view,String url,android.graphics.Bitmap icon) {
                progress.setVisibility(View.VISIBLE);
                ((View)offline.getTag()).setVisibility(View.GONE);
            }
            @Override public void onPageFinished(WebView view,String url) {
                progress.setVisibility(View.GONE);
            }
            @Override public void onReceivedError(WebView view,WebResourceRequest request,WebResourceError error) {
                if(request.isForMainFrame()){
                    progress.setVisibility(View.GONE);
                    ((View)offline.getTag()).setVisibility(View.VISIBLE);
                }
            }
        });
        webView.setWebChromeClient(new WebChromeClient() {
            @Override public void onPermissionRequest(PermissionRequest request) {
                runOnUiThread(() -> {
                    if(!trusted(request.getOrigin()) || request.getResources().length != 1 ||
                       !PermissionRequest.RESOURCE_AUDIO_CAPTURE.equals(request.getResources()[0])) {
                        request.deny(); return;
                    }
                    if(Build.VERSION.SDK_INT >= 23 &&
                       checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
                        pendingAudioRequest=request;
                        requestPermissions(new String[]{Manifest.permission.RECORD_AUDIO},AUDIO_REQUEST);
                    } else request.grant(new String[]{PermissionRequest.RESOURCE_AUDIO_CAPTURE});
                });
            }
            @Override public void onPermissionRequestCanceled(PermissionRequest request) {
                if(pendingAudioRequest==request)pendingAudioRequest=null;
            }
        });
    }

    private void startVoiceInput() {
        Intent intent=new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
        intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
        intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE, "pt-BR");
        intent.putExtra(RecognizerIntent.EXTRA_PROMPT,"Diga seu comando financeiro");
        try { startActivityForResult(intent,SPEECH_REQUEST); }
        catch(ActivityNotFoundException ignored){
            android.widget.Toast.makeText(this,"Reconhecimento de voz indisponível neste aparelho.",android.widget.Toast.LENGTH_LONG).show();
        }
    }

    @Override protected void onActivityResult(int requestCode,int resultCode,Intent data) {
        super.onActivityResult(requestCode,resultCode,data);
        if(requestCode!=SPEECH_REQUEST || resultCode!=RESULT_OK || data==null)return;
        ArrayList<String> results=data.getStringArrayListExtra(RecognizerIntent.EXTRA_RESULTS);
        if(results==null || results.isEmpty() || results.get(0)==null)return;
        String transcript=results.get(0).trim();
        if(transcript.isEmpty())return;
        if(transcript.length()>500)transcript=transcript.substring(0,500);
        Uri page=Uri.parse(webView.getUrl()==null?"":webView.getUrl());
        if(!trusted(page))return;
        String js="(function(){const tab=document.querySelector('[data-tab=gemini]');if(tab)tab.click();"+
                "const field=document.getElementById('gemini-user-input');"+
                "if(field){field.value="+JSONObject.quote(transcript)+";field.dispatchEvent(new Event('input',{bubbles:true}));field.focus();}})();";
        webView.evaluateJavascript(js,null); // Apenas rascunho; o usuário decide quando enviar.
    }

    private void openExternal(Uri uri) {
        if(uri==null)return;
        String scheme=uri.getScheme();
        if(!"https".equalsIgnoreCase(scheme) && !"mailto".equalsIgnoreCase(scheme) &&
           !"tel".equalsIgnoreCase(scheme))return;
        try{startActivity(new Intent(Intent.ACTION_VIEW,uri));}
        catch(ActivityNotFoundException ignored){}
    }

    @Override public void onRequestPermissionsResult(int code,String[] permissions,int[] results) {
        super.onRequestPermissionsResult(code,permissions,results);
        if(code == AUDIO_REQUEST && pendingAudioRequest!=null) {
            if(results.length>0 && results[0]==PackageManager.PERMISSION_GRANTED)
                pendingAudioRequest.grant(new String[]{PermissionRequest.RESOURCE_AUDIO_CAPTURE});
            else pendingAudioRequest.deny();
            pendingAudioRequest=null;
        }
    }

    @Override public void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        webView.loadUrl(resolveLaunchUrl(intent));
    }

    @Override public void onBackPressed() {
        if(webView!=null && webView.canGoBack())webView.goBack();
        else super.onBackPressed();
    }

    @Override protected void onDestroy(){
        if(pendingAudioRequest!=null){pendingAudioRequest.deny();pendingAudioRequest=null;}
        if(webView!=null)webView.destroy();
        super.onDestroy();
    }
}
