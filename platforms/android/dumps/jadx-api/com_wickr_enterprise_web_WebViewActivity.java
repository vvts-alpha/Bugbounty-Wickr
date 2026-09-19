package com.wickr.enterprise.web;

import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.webkit.CookieManager;
import android.webkit.ValueCallback;
import android.webkit.WebSettings;
import android.webkit.WebView;
import androidx.activity.OnBackPressedCallback;
import androidx.activity.OnBackPressedDispatcher;
import androidx.activity.OnBackPressedDispatcherKt;
import com.wickr.enterprise.base.BaseActivity;
import com.wickr.enterprise.databinding.ActivityWebviewBinding;
import com.wickr.enterprise.util.BuildUtils;
import com.wickr.registration.SSOResponseRedirectActivity;
import java.util.ArrayList;
import java.util.List;
import kotlin.Metadata;
import kotlin.Unit;
import kotlin.collections.CollectionsKt;
import kotlin.jvm.functions.Function1;
import kotlin.jvm.internal.DefaultConstructorMarker;
import kotlin.jvm.internal.Intrinsics;
import kotlin.jvm.internal.Reflection;
import kotlin.text.StringsKt;
import timber.log.Timber;

/* JADX INFO: compiled from: WebViewActivity.kt */
/* JADX INFO: loaded from: classes5.dex */
@Metadata(d1 = {"\u0000T\n\u0002\u0018\u0002\n\u0002\u0018\u0002\n\u0002\u0018\u0002\n\u0002\u0018\u0002\n\u0002\b\u0003\n\u0002\u0018\u0002\n\u0000\n\u0002\u0018\u0002\n\u0000\n\u0002\u0018\u0002\n\u0002\u0010\u000e\n\u0002\u0018\u0002\n\u0002\b\u0005\n\u0002\u0010\u000b\n\u0002\b\u0007\n\u0002\u0018\u0002\n\u0000\n\u0002\u0010\u0002\n\u0000\n\u0002\u0018\u0002\n\u0002\b\u0005\n\u0002\u0018\u0002\n\u0002\b\u0004\b\u0007\u0018\u0000 (2\u00020\u00012\u00020\u00022\u00020\u0003:\u0001(B\u0007¢\u0006\u0004\b\u0004\u0010\u0005J\u0012\u0010\u001c\u001a\u00020\u001d2\b\u0010\u001e\u001a\u0004\u0018\u00010\u001fH\u0015J\u0018\u0010 \u001a\u00020\u001d2\u0006\u0010!\u001a\u00020\f2\u0006\u0010\"\u001a\u00020\u0013H\u0016J\u0010\u0010#\u001a\u00020\u001d2\u0006\u0010$\u001a\u00020%H\u0016J\u0010\u0010&\u001a\u00020\u001d2\u0006\u0010$\u001a\u00020%H\u0016J\b\u0010'\u001a\u00020\u001dH\u0002J\b\u0010\u0014\u001a\u00020\u001dH\u0002R\u000e\u0010\u0006\u001a\u00020\u0007X\u0082.¢\u0006\u0002\n\u0000R\u000e\u0010\b\u001a\u00020\tX\u0082.¢\u0006\u0002\n\u0000R\u001e\u0010\n\u001a\u0012\u0012\u0004\u0012\u00020\f0\u000bj\b\u0012\u0004\u0012\u00020\f`\rX\u0082\u0004¢\u0006\u0002\n\u0000R\u001e\u0010\u000e\u001a\u0012\u0012\u0004\u0012\u00020\f0\u000bj\b\u0012\u0004\u0012\u00020\f`\rX\u0082\u0004¢\u0006\u0002\n\u0000R$\u0010\u000f\u001a\u0012\u0012\u0004\u0012\u00020\f0\u000bj\b\u0012\u0004\u0012\u00020\f`\rX\u0096\u0004¢\u0006\b\n\u0000\u001a\u0004\b\u0010\u0010\u0011R\u000e\u0010\u0012\u001a\u00020\u0013X\u0082\u000e¢\u0006\u0002\n\u0000R\u000e\u0010\u0014\u001a\u00020\u0013X\u0082\u000e¢\u0006\u0002\n\u0000R\u001a\u0010\u0015\u001a\u00020\u0013X\u0096\u000e¢\u0006\u000e\n\u0000\u001a\u0004\b\u0016\u0010\u0017\"\u0004\b\u0018\u0010\u0019R\u000e\u0010\u001a\u001a\u00020\u001bX\u0082.¢\u0006\u0002\n\u0000¨\u0006)"}, d2 = {"Lcom/wickr/enterprise/web/WebViewActivity;", "Lcom/wickr/enterprise/base/BaseActivity;", "Lcom/wickr/enterprise/web/WickrWebListener;", "Lcom/wickr/enterprise/web/WickrWebRedirectHandler;", "<init>", "()V", "webViewClient", "Lcom/wickr/enterprise/web/WickrWebViewClient;", "webChromeClient", "Lcom/wickr/enterprise/web/WickrWebChromeClient;", WebViewActivity.EXTRA_ALLOWED_DOMAINS, "Ljava/util/ArrayList;", "", "Lkotlin/collections/ArrayList;", WebViewActivity.EXTRA_ALLOWED_URLS, "internalRedirects", "getInternalRedirects", "()Ljava/util/ArrayList;", WebViewActivity.EXTRA_DISALLOW_BACK_PRESS, "", WebViewActivity.EXTRA_CLEAR_CACHE, "enableScreenshots", "getEnableScreenshots", "()Z", "setEnableScreenshots", "(Z)V", "binding", "Lcom/wickr/enterprise/databinding/ActivityWebviewBinding;", "onCreate", "", "savedInstanceState", "Landroid/os/Bundle;", "onWebPageLoading", "url", "loading", "openInternalUri", "uri", "Landroid/net/Uri;", "openExternalUri", "finishInternal", "Companion", "app_awsRelease"}, k = 1, mv = {2, 2, 0}, xi = 48)
public final class WebViewActivity extends BaseActivity implements WickrWebListener, WickrWebRedirectHandler {
    private static final String EXTRA_ALLOWED_DOMAINS = "allowedDomains";
    private static final String EXTRA_ALLOWED_URLS = "allowedUrls";
    private static final String EXTRA_CLEAR_CACHE = "clearCache";
    private static final String EXTRA_DISALLOW_BACK_PRESS = "disallowBackPress";
    private static final String EXTRA_REDIRECT_URLS = "redirectUrls";
    private static final String EXTRA_RESTRICT_NAVIGATION = "restrictNavigation";
    public static final String RESULT_EXTERNAL_BROWSER_OPENED = "externalBrowserOpened";
    public static final String RESULT_INTERNAL_REDIRECT_OPENED = "internalRedirectOpened";
    private ActivityWebviewBinding binding;
    private WickrWebChromeClient webChromeClient;
    private WickrWebViewClient webViewClient;

    /* JADX INFO: renamed from: Companion, reason: from kotlin metadata */
    public static final Companion INSTANCE = new Companion(null);
    public static final int $stable = 8;
    private final ArrayList<String> allowedDomains = new ArrayList<>();
    private final ArrayList<String> allowedUrls = new ArrayList<>();
    private final ArrayList<String> internalRedirects = new ArrayList<>();
    private boolean disallowBackPress = true;
    private boolean clearCache = true;
    private boolean enableScreenshots = true ^ BuildUtils.INSTANCE.isProductionVariant();

    /* JADX INFO: compiled from: WebViewActivity.kt */
    @Metadata(d1 = {"\u0000<\n\u0002\u0018\u0002\n\u0002\u0010\u0000\n\u0002\b\u0003\n\u0002\u0010\u000e\n\u0002\b\b\n\u0002\u0018\u0002\n\u0000\n\u0002\u0010 \n\u0002\b\u0003\n\u0002\u0010\u000b\n\u0002\b\u0003\n\u0002\u0010\u0002\n\u0000\n\u0002\u0018\u0002\n\u0000\n\u0002\u0018\u0002\n\u0000\b\u0086\u0003\u0018\u00002\u00020\u0001B\t\b\u0002¢\u0006\u0004\b\u0002\u0010\u0003JR\u0010\r\u001a\u00020\u000e2\f\u0010\u000f\u001a\b\u0012\u0004\u0012\u00020\u00050\u00102\u000e\b\u0002\u0010\u0011\u001a\b\u0012\u0004\u0012\u00020\u00050\u00102\u000e\b\u0002\u0010\u0012\u001a\b\u0012\u0004\u0012\u00020\u00050\u00102\b\b\u0002\u0010\u0013\u001a\u00020\u00142\b\b\u0002\u0010\u0015\u001a\u00020\u00142\b\b\u0002\u0010\u0016\u001a\u00020\u0014Jb\u0010\u0017\u001a\u00020\u00182\u0006\u0010\u0019\u001a\u00020\u001a2\u0006\u0010\u001b\u001a\u00020\u001c2\f\u0010\u000f\u001a\b\u0012\u0004\u0012\u00020\u00050\u00102\u000e\b\u0002\u0010\u0011\u001a\b\u0012\u0004\u0012\u00020\u00050\u00102\u000e\b\u0002\u0010\u0012\u001a\b\u0012\u0004\u0012\u00020\u00050\u00102\b\b\u0002\u0010\u0013\u001a\u00020\u00142\b\b\u0002\u0010\u0015\u001a\u00020\u00142\b\b\u0002\u0010\u0016\u001a\u00020\u0014R\u000e\u0010\u0004\u001a\u00020\u0005X\u0082T¢\u0006\u0002\n\u0000R\u000e\u0010\u0006\u001a\u00020\u0005X\u0082T¢\u0006\u0002\n\u0000R\u000e\u0010\u0007\u001a\u00020\u0005X\u0082T¢\u0006\u0002\n\u0000R\u000e\u0010\b\u001a\u00020\u0005X\u0082T¢\u0006\u0002\n\u0000R\u000e\u0010\t\u001a\u00020\u0005X\u0082T¢\u0006\u0002\n\u0000R\u000e\u0010\n\u001a\u00020\u0005X\u0082T¢\u0006\u0002\n\u0000R\u000e\u0010\u000b\u001a\u00020\u0005X\u0086T¢\u0006\u0002\n\u0000R\u000e\u0010\f\u001a\u00020\u0005X\u0086T¢\u0006\u0002\n\u0000¨\u0006\u001d"}, d2 = {"Lcom/wickr/enterprise/web/WebViewActivity$Companion;", "", "<init>", "()V", "EXTRA_REDIRECT_URLS", "", "EXTRA_ALLOWED_DOMAINS", "EXTRA_ALLOWED_URLS", "EXTRA_DISALLOW_BACK_PRESS", "EXTRA_CLEAR_CACHE", "EXTRA_RESTRICT_NAVIGATION", "RESULT_INTERNAL_REDIRECT_OPENED", "RESULT_EXTERNAL_BROWSER_OPENED", "configuration", "Landroid/os/Bundle;", WebViewActivity.EXTRA_REDIRECT_URLS, "", WebViewActivity.EXTRA_ALLOWED_DOMAINS, WebViewActivity.EXTRA_ALLOWED_URLS, WebViewActivity.EXTRA_DISALLOW_BACK_PRESS, "", WebViewActivity.EXTRA_CLEAR_CACHE, WebViewActivity.EXTRA_RESTRICT_NAVIGATION, "configure", "", "context", "Landroid/content/Context;", "intent", "Landroid/content/Intent;", "app_awsRelease"}, k = 1, mv = {2, 2, 0}, xi = 48)
    public static final class Companion {
        public /* synthetic */ Companion(DefaultConstructorMarker defaultConstructorMarker) {
            this();
        }

        private Companion() {
        }

        /* JADX WARN: Multi-variable type inference failed */
        public static /* synthetic */ Bundle configuration$default(Companion companion, List list, List list2, List list3, boolean z, boolean z2, boolean z3, int i, Object obj) {
            if ((i & 2) != 0) {
                list2 = CollectionsKt.emptyList();
            }
            List list4 = list2;
            if ((i & 4) != 0) {
                list3 = CollectionsKt.emptyList();
            }
            List list5 = list3;
            boolean z4 = (i & 8) != 0 ? false : z;
            boolean z5 = (i & 16) != 0 ? false : z2;
            if ((i & 32) != 0) {
                z3 = true;
            }
            return companion.configuration(list, list4, list5, z4, z5, z3);
        }

        public final Bundle configuration(List<String> redirectUrls, List<String> allowedDomains, List<String> allowedUrls, boolean disallowBackPress, boolean clearCache, boolean restrictNavigation) {
            Intrinsics.checkNotNullParameter(redirectUrls, "redirectUrls");
            Intrinsics.checkNotNullParameter(allowedDomains, "allowedDomains");
            Intrinsics.checkNotNullParameter(allowedUrls, "allowedUrls");
            Bundle bundle = new Bundle();
            bundle.putStringArray(WebViewActivity.EXTRA_REDIRECT_URLS, (String[]) redirectUrls.toArray(new String[0]));
            bundle.putStringArray(WebViewActivity.EXTRA_ALLOWED_DOMAINS, (String[]) allowedDomains.toArray(new String[0]));
            bundle.putStringArray(WebViewActivity.EXTRA_ALLOWED_URLS, (String[]) allowedUrls.toArray(new String[0]));
            bundle.putBoolean(WebViewActivity.EXTRA_DISALLOW_BACK_PRESS, disallowBackPress);
            bundle.putBoolean(WebViewActivity.EXTRA_CLEAR_CACHE, clearCache);
            bundle.putBoolean(WebViewActivity.EXTRA_RESTRICT_NAVIGATION, restrictNavigation);
            return bundle;
        }

        /* JADX WARN: Multi-variable type inference failed */
        public static /* synthetic */ void configure$default(Companion companion, Context context, Intent intent, List list, List list2, List list3, boolean z, boolean z2, boolean z3, int i, Object obj) {
            if ((i & 8) != 0) {
                list2 = CollectionsKt.emptyList();
            }
            companion.configure(context, intent, list, list2, (i & 16) != 0 ? CollectionsKt.emptyList() : list3, (i & 32) != 0 ? true : z, (i & 64) != 0 ? true : z2, (i & 128) != 0 ? true : z3);
        }

        public final void configure(Context context, Intent intent, List<String> redirectUrls, List<String> allowedDomains, List<String> allowedUrls, boolean disallowBackPress, boolean clearCache, boolean restrictNavigation) {
            Intrinsics.checkNotNullParameter(context, "context");
            Intrinsics.checkNotNullParameter(intent, "intent");
            Intrinsics.checkNotNullParameter(redirectUrls, "redirectUrls");
            Intrinsics.checkNotNullParameter(allowedDomains, "allowedDomains");
            Intrinsics.checkNotNullParameter(allowedUrls, "allowedUrls");
            intent.putExtras(configuration(redirectUrls, allowedDomains, allowedUrls, disallowBackPress, clearCache, restrictNavigation));
            intent.setPackage(context.getPackageName());
            intent.setClass(context, WebViewActivity.class);
        }
    }

    @Override // com.wickr.enterprise.web.WickrWebRedirectHandler
    public ArrayList<String> getInternalRedirects() {
        return this.internalRedirects;
    }

    @Override // com.wickr.enterprise.base.BaseActivity
    public boolean getEnableScreenshots() {
        return this.enableScreenshots;
    }

    public void setEnableScreenshots(boolean z) {
        this.enableScreenshots = z;
    }

    /* JADX WARN: Multi-variable type inference failed */
    @Override // com.wickr.enterprise.base.BaseActivity, com.wickr.enterprise.base.Hilt_BaseActivity, androidx.fragment.app.FragmentActivity, androidx.activity.ComponentActivity, androidx.core.app.ComponentActivity, android.app.Activity
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        ActivityWebviewBinding activityWebviewBindingInflate = ActivityWebviewBinding.inflate(getLayoutInflater());
        Intrinsics.checkNotNullExpressionValue(activityWebviewBindingInflate, "inflate(...)");
        this.binding = activityWebviewBindingInflate;
        ActivityWebviewBinding activityWebviewBinding = null;
        Object[] objArr = 0;
        if (activityWebviewBindingInflate == null) {
            Intrinsics.throwUninitializedPropertyAccessException("binding");
            activityWebviewBindingInflate = null;
        }
        setContentView(activityWebviewBindingInflate.getRoot());
        Uri data = getIntent().getData();
        boolean z = false;
        if (data == null) {
            Timber.INSTANCE.e("Missing data", new Object[0]);
            setResult(0);
            finishInternal();
            return;
        }
        String[] stringArrayExtra = getIntent().getStringArrayExtra(EXTRA_REDIRECT_URLS);
        if (stringArrayExtra == null) {
            stringArrayExtra = new String[0];
        }
        if (stringArrayExtra.length != 0) {
            for (String str : stringArrayExtra) {
                Intrinsics.checkNotNull(str);
                if (!StringsKt.isBlank(str)) {
                    CollectionsKt.addAll(getInternalRedirects(), stringArrayExtra);
                    String[] stringArrayExtra2 = getIntent().getStringArrayExtra(EXTRA_ALLOWED_DOMAINS);
                    if (stringArrayExtra2 != null) {
                        Timber.INSTANCE.i("Applying " + stringArrayExtra2.length + " allowedDomains", new Object[0]);
                        CollectionsKt.addAll(this.allowedDomains, stringArrayExtra2);
                    }
                    String[] stringArrayExtra3 = getIntent().getStringArrayExtra(EXTRA_ALLOWED_URLS);
                    if (stringArrayExtra3 != null) {
                        Timber.INSTANCE.i("Applying " + stringArrayExtra3.length + " allowedUrls", new Object[0]);
                        CollectionsKt.addAll(this.allowedUrls, stringArrayExtra3);
                    }
                    this.disallowBackPress = getIntent().getBooleanExtra(EXTRA_DISALLOW_BACK_PRESS, false);
                    this.clearCache = getIntent().getBooleanExtra(EXTRA_CLEAR_CACHE, false);
                    this.webViewClient = new WickrWebViewClient(this.allowedDomains, this.allowedUrls, this, this, getIntent().getBooleanExtra(EXTRA_RESTRICT_NAVIGATION, true));
                    this.webChromeClient = new WickrWebChromeClient(z, 1, objArr == true ? 1 : 0);
                    ActivityWebviewBinding activityWebviewBinding2 = this.binding;
                    if (activityWebviewBinding2 == null) {
                        Intrinsics.throwUninitializedPropertyAccessException("binding");
                        activityWebviewBinding2 = null;
                    }
                    WebView webView = activityWebviewBinding2.webView;
                    WickrWebViewClient wickrWebViewClient = this.webViewClient;
                    if (wickrWebViewClient == null) {
                        Intrinsics.throwUninitializedPropertyAccessException("webViewClient");
                        wickrWebViewClient = null;
                    }
                    webView.setWebViewClient(wickrWebViewClient);
                    WickrWebChromeClient wickrWebChromeClient = this.webChromeClient;
                    if (wickrWebChromeClient == null) {
                        Intrinsics.throwUninitializedPropertyAccessException("webChromeClient");
                        wickrWebChromeClient = null;
                    }
                    webView.setWebChromeClient(wickrWebChromeClient);
                    WebSettings settings = webView.getSettings();
                    settings.setGeolocationEnabled(false);
                    settings.setAllowFileAccess(false);
                    settings.setAllowFileAccess(false);
                    settings.setJavaScriptEnabled(true);
                    settings.setAllowContentAccess(false);
                    settings.setSafeBrowsingEnabled(true);
                    settings.setMediaPlaybackRequiresUserGesture(true);
                    settings.setJavaScriptCanOpenWindowsAutomatically(false);
                    settings.setDisabledActionModeMenuItems(7);
                    OnBackPressedDispatcher onBackPressedDispatcher = getOnBackPressedDispatcher();
                    Intrinsics.checkNotNullExpressionValue(onBackPressedDispatcher, "<get-onBackPressedDispatcher>(...)");
                    OnBackPressedDispatcherKt.addCallback$default(onBackPressedDispatcher, null, false, new Function1() { // from class: com.wickr.enterprise.web.WebViewActivity$$ExternalSyntheticLambda1
                        @Override // kotlin.jvm.functions.Function1
                        public final Object invoke(Object obj) {
                            return WebViewActivity.onCreate$lambda$4(this.f$0, (OnBackPressedCallback) obj);
                        }
                    }, 3, null);
                    if (this.clearCache) {
                        clearCache();
                    }
                    ActivityWebviewBinding activityWebviewBinding3 = this.binding;
                    if (activityWebviewBinding3 == null) {
                        Intrinsics.throwUninitializedPropertyAccessException("binding");
                    } else {
                        activityWebviewBinding = activityWebviewBinding3;
                    }
                    activityWebviewBinding.webView.loadUrl(data.toString());
                    return;
                }
            }
        }
        Timber.INSTANCE.e("Missing redirectUrls", new Object[0]);
        setResult(0);
        finishInternal();
    }

    /* JADX INFO: Access modifiers changed from: private */
    public static final Unit onCreate$lambda$4(WebViewActivity webViewActivity, OnBackPressedCallback addCallback) {
        Intrinsics.checkNotNullParameter(addCallback, "$this$addCallback");
        if (webViewActivity.disallowBackPress) {
            webViewActivity.setResult(0);
            webViewActivity.finishInternal();
        } else {
            ActivityWebviewBinding activityWebviewBinding = webViewActivity.binding;
            ActivityWebviewBinding activityWebviewBinding2 = null;
            if (activityWebviewBinding == null) {
                Intrinsics.throwUninitializedPropertyAccessException("binding");
                activityWebviewBinding = null;
            }
            if (activityWebviewBinding.webView.canGoBack()) {
                ActivityWebviewBinding activityWebviewBinding3 = webViewActivity.binding;
                if (activityWebviewBinding3 == null) {
                    Intrinsics.throwUninitializedPropertyAccessException("binding");
                } else {
                    activityWebviewBinding2 = activityWebviewBinding3;
                }
                activityWebviewBinding2.webView.goBack();
            } else {
                webViewActivity.finish();
            }
        }
        return Unit.INSTANCE;
    }

    @Override // com.wickr.enterprise.web.WickrWebListener
    public void onWebPageLoading(String url, boolean loading) {
        Intrinsics.checkNotNullParameter(url, "url");
        ActivityWebviewBinding activityWebviewBinding = this.binding;
        ActivityWebviewBinding activityWebviewBinding2 = null;
        if (activityWebviewBinding == null) {
            Intrinsics.throwUninitializedPropertyAccessException("binding");
            activityWebviewBinding = null;
        }
        activityWebviewBinding.progressBar.setVisibility(loading ? 0 : 4);
        ActivityWebviewBinding activityWebviewBinding3 = this.binding;
        if (activityWebviewBinding3 == null) {
            Intrinsics.throwUninitializedPropertyAccessException("binding");
        } else {
            activityWebviewBinding2 = activityWebviewBinding3;
        }
        activityWebviewBinding2.browserBarText.setText(url);
    }

    @Override // com.wickr.enterprise.web.WickrWebRedirectHandler
    public void openInternalUri(Uri uri) {
        Intrinsics.checkNotNullParameter(uri, "uri");
        Timber.INSTANCE.i("Opening internal uri %s", "");
        Intent intent = new Intent();
        intent.setData(uri);
        String packageName = getPackageName();
        String qualifiedName = Reflection.getOrCreateKotlinClass(SSOResponseRedirectActivity.class).getQualifiedName();
        Intrinsics.checkNotNull(qualifiedName);
        intent.setClassName(packageName, qualifiedName);
        startActivity(intent);
        Intent intent2 = new Intent();
        intent2.putExtra(RESULT_INTERNAL_REDIRECT_OPENED, true);
        setResult(-1, intent2);
        finishInternal();
    }

    @Override // com.wickr.enterprise.web.WickrWebRedirectHandler
    public void openExternalUri(Uri uri) {
        Intrinsics.checkNotNullParameter(uri, "uri");
        Timber.INSTANCE.i("Opening external uri %s", "");
        startActivity(new Intent("android.intent.action.VIEW", uri));
        Intent intent = new Intent();
        intent.putExtra(RESULT_EXTERNAL_BROWSER_OPENED, true);
        setResult(0, intent);
        finishInternal();
    }

    private final void finishInternal() {
        if (this.clearCache) {
            clearCache();
        }
        finish();
    }

    private final void clearCache() {
        CookieManager.getInstance().removeAllCookies(new ValueCallback() { // from class: com.wickr.enterprise.web.WebViewActivity$$ExternalSyntheticLambda0
            @Override // android.webkit.ValueCallback
            public final void onReceiveValue(Object obj) {
                WebViewActivity.clearCache$lambda$0((Boolean) obj);
            }
        });
        ActivityWebviewBinding activityWebviewBinding = this.binding;
        if (activityWebviewBinding == null) {
            Intrinsics.throwUninitializedPropertyAccessException("binding");
            activityWebviewBinding = null;
        }
        activityWebviewBinding.webView.clearCache(true);
    }

    /* JADX INFO: Access modifiers changed from: private */
    public static final void clearCache$lambda$0(Boolean bool) {
        Timber.INSTANCE.v("Removed cookies: " + bool, new Object[0]);
    }
}
