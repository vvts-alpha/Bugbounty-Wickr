package com.wickr.enterprise.web;

import android.graphics.Bitmap;
import android.net.Uri;
import android.webkit.WebResourceRequest;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import androidx.webkit.ProxyConfig;
import io.sentry.SentryBaseEvent;
import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;
import kotlin.Metadata;
import kotlin.collections.CollectionsKt;
import kotlin.jvm.internal.DefaultConstructorMarker;
import kotlin.jvm.internal.Intrinsics;
import kotlin.text.StringsKt;
import timber.log.Timber;

/* JADX INFO: compiled from: WickrWebViewClient.kt */
/* JADX INFO: loaded from: classes5.dex */
@Metadata(d1 = {"\u0000V\n\u0002\u0018\u0002\n\u0002\u0018\u0002\n\u0000\n\u0002\u0010 \n\u0002\u0010\u000e\n\u0002\b\u0002\n\u0002\u0018\u0002\n\u0000\n\u0002\u0018\u0002\n\u0000\n\u0002\u0010\u000b\n\u0002\b\u0003\n\u0002\u0018\u0002\n\u0002\b\u0002\n\u0002\u0010\u0002\n\u0000\n\u0002\u0018\u0002\n\u0002\b\u0002\n\u0002\u0018\u0002\n\u0002\b\u0003\n\u0002\u0018\u0002\n\u0002\b\u0002\n\u0002\u0018\u0002\n\u0000\b\u0007\u0018\u00002\u00020\u0001B=\u0012\f\u0010\u0002\u001a\b\u0012\u0004\u0012\u00020\u00040\u0003\u0012\f\u0010\u0005\u001a\b\u0012\u0004\u0012\u00020\u00040\u0003\u0012\u0006\u0010\u0006\u001a\u00020\u0007\u0012\u0006\u0010\b\u001a\u00020\t\u0012\b\b\u0002\u0010\n\u001a\u00020\u000b¢\u0006\u0004\b\f\u0010\rJ\"\u0010\u0011\u001a\u00020\u00122\u0006\u0010\u0013\u001a\u00020\u00142\u0006\u0010\u0015\u001a\u00020\u00042\b\u0010\u0016\u001a\u0004\u0018\u00010\u0017H\u0016J\u0018\u0010\u0018\u001a\u00020\u00122\u0006\u0010\u0013\u001a\u00020\u00142\u0006\u0010\u0015\u001a\u00020\u0004H\u0016J\u0018\u0010\u0019\u001a\u00020\u000b2\u0006\u0010\u0013\u001a\u00020\u00142\u0006\u0010\u001a\u001a\u00020\u001bH\u0016J\u0010\u0010\u001c\u001a\u00020\u000b2\u0006\u0010\u001d\u001a\u00020\u001eH\u0002R\u0014\u0010\u0005\u001a\b\u0012\u0004\u0012\u00020\u00040\u0003X\u0082\u0004¢\u0006\u0002\n\u0000R\u000e\u0010\u0006\u001a\u00020\u0007X\u0082\u0004¢\u0006\u0002\n\u0000R\u000e\u0010\b\u001a\u00020\tX\u0082\u0004¢\u0006\u0002\n\u0000R\u000e\u0010\n\u001a\u00020\u000bX\u0082\u0004¢\u0006\u0002\n\u0000R\u001b\u0010\u000e\u001a\u000f\u0012\u000b\u0012\t\u0018\u00010\u0004¢\u0006\u0002\b\u000f0\u0003X\u0082\u0004¢\u0006\u0002\n\u0000R\u0014\u0010\u0010\u001a\b\u0012\u0004\u0012\u00020\u00040\u0003X\u0082\u0004¢\u0006\u0002\n\u0000¨\u0006\u001f"}, d2 = {"Lcom/wickr/enterprise/web/WickrWebViewClient;", "Landroid/webkit/WebViewClient;", "allowedDomains", "", "", "allowedUrls", "webListener", "Lcom/wickr/enterprise/web/WickrWebListener;", "redirectHandler", "Lcom/wickr/enterprise/web/WickrWebRedirectHandler;", "restrictNavigation", "", "<init>", "(Ljava/util/List;Ljava/util/List;Lcom/wickr/enterprise/web/WickrWebListener;Lcom/wickr/enterprise/web/WickrWebRedirectHandler;Z)V", "allowedDomainHosts", "Lkotlin/jvm/internal/EnhancedNullability;", "redirectHosts", "onPageStarted", "", "view", "Landroid/webkit/WebView;", "url", "favicon", "Landroid/graphics/Bitmap;", "onPageFinished", "shouldOverrideUrlLoading", SentryBaseEvent.JsonKeys.REQUEST, "Landroid/webkit/WebResourceRequest;", "isUriAuthorized", "uri", "Landroid/net/Uri;", "app_awsRelease"}, k = 1, mv = {2, 2, 0}, xi = 48)
public final class WickrWebViewClient extends WebViewClient {
    public static final int $stable = 8;
    private final List<String> allowedDomainHosts;
    private final List<String> allowedUrls;
    private final WickrWebRedirectHandler redirectHandler;
    private final List<String> redirectHosts;
    private final boolean restrictNavigation;
    private final WickrWebListener webListener;

    public WickrWebViewClient(List<String> allowedDomains, List<String> allowedUrls, WickrWebListener webListener, WickrWebRedirectHandler redirectHandler, boolean z) {
        Intrinsics.checkNotNullParameter(allowedDomains, "allowedDomains");
        Intrinsics.checkNotNullParameter(allowedUrls, "allowedUrls");
        Intrinsics.checkNotNullParameter(webListener, "webListener");
        Intrinsics.checkNotNullParameter(redirectHandler, "redirectHandler");
        this.allowedUrls = allowedUrls;
        this.webListener = webListener;
        this.redirectHandler = redirectHandler;
        this.restrictNavigation = z;
        List<String> list = allowedDomains;
        ArrayList arrayList = new ArrayList(CollectionsKt.collectionSizeOrDefault(list, 10));
        Iterator<T> it = list.iterator();
        while (it.hasNext()) {
            arrayList.add(Uri.parse((String) it.next()).getHost());
        }
        this.allowedDomainHosts = arrayList;
        List<String> internalRedirects = this.redirectHandler.getInternalRedirects();
        ArrayList arrayList2 = new ArrayList(CollectionsKt.collectionSizeOrDefault(internalRedirects, 10));
        Iterator<T> it2 = internalRedirects.iterator();
        while (it2.hasNext()) {
            arrayList2.add(StringsKt.substringBefore$default((String) it2.next(), ":", (String) null, 2, (Object) null));
        }
        ArrayList arrayList3 = new ArrayList();
        for (Object obj : arrayList2) {
            String str = (String) obj;
            if (!Intrinsics.areEqual(str, ProxyConfig.MATCH_HTTP) && !Intrinsics.areEqual(str, ProxyConfig.MATCH_HTTPS)) {
                arrayList3.add(obj);
            }
        }
        ArrayList arrayList4 = arrayList3;
        this.redirectHosts = arrayList4;
        Timber.INSTANCE.v("Allowed Urls: " + CollectionsKt.joinToString$default(this.allowedUrls, ",", null, null, 0, null, null, 62, null), new Object[0]);
        Timber.INSTANCE.v("Allowed Domains: " + CollectionsKt.joinToString$default(this.allowedDomainHosts, ",", null, null, 0, null, null, 62, null), new Object[0]);
        Timber.INSTANCE.v("Internal Redirect Hosts: " + CollectionsKt.joinToString$default(arrayList4, ",", null, null, 0, null, null, 62, null), new Object[0]);
    }

    public /* synthetic */ WickrWebViewClient(List list, List list2, WickrWebListener wickrWebListener, WickrWebRedirectHandler wickrWebRedirectHandler, boolean z, int i, DefaultConstructorMarker defaultConstructorMarker) {
        this(list, list2, wickrWebListener, wickrWebRedirectHandler, (i & 16) != 0 ? true : z);
    }

    @Override // android.webkit.WebViewClient
    public void onPageStarted(WebView view, String url, Bitmap favicon) {
        Intrinsics.checkNotNullParameter(view, "view");
        Intrinsics.checkNotNullParameter(url, "url");
        super.onPageStarted(view, url, favicon);
        this.webListener.onWebPageLoading(url, true);
    }

    @Override // android.webkit.WebViewClient
    public void onPageFinished(WebView view, String url) {
        Intrinsics.checkNotNullParameter(view, "view");
        Intrinsics.checkNotNullParameter(url, "url");
        super.onPageFinished(view, url);
        this.webListener.onWebPageLoading(url, false);
    }

    @Override // android.webkit.WebViewClient
    public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
        Intrinsics.checkNotNullParameter(view, "view");
        Intrinsics.checkNotNullParameter(request, "request");
        if (CollectionsKt.contains(this.redirectHosts, request.getUrl().getScheme())) {
            WickrWebRedirectHandler wickrWebRedirectHandler = this.redirectHandler;
            Uri url = request.getUrl();
            Intrinsics.checkNotNullExpressionValue(url, "getUrl(...)");
            wickrWebRedirectHandler.openInternalUri(url);
            return true;
        }
        Uri url2 = request.getUrl();
        Intrinsics.checkNotNullExpressionValue(url2, "getUrl(...)");
        if (isUriAuthorized(url2)) {
            return false;
        }
        WickrWebRedirectHandler wickrWebRedirectHandler2 = this.redirectHandler;
        Uri url3 = request.getUrl();
        Intrinsics.checkNotNullExpressionValue(url3, "getUrl(...)");
        wickrWebRedirectHandler2.openExternalUri(url3);
        return true;
    }

    /* JADX WARN: Code duplicated, block: B:14:0x003c  */
    private final boolean isUriAuthorized(Uri uri) {
        boolean z;
        if (!this.restrictNavigation && this.allowedUrls.isEmpty() && this.allowedDomainHosts.isEmpty()) {
            return true;
        }
        if (this.allowedUrls.isEmpty()) {
            z = false;
        } else {
            List<String> list = this.allowedUrls;
            String string = uri.toString();
            Intrinsics.checkNotNullExpressionValue(string, "toString(...)");
            if (list.contains(StringsKt.substringBefore$default(string, "?", (String) null, 2, (Object) null))) {
                z = true;
            } else {
                z = false;
            }
        }
        return z || (!this.allowedDomainHosts.isEmpty() && this.allowedDomainHosts.contains(uri.getHost()));
    }
}
