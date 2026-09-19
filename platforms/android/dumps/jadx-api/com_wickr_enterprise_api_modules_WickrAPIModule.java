package com.wickr.enterprise.api.modules;

import androidx.core.app.NotificationCompat;
import com.wickr.android.api.WickrAPIObjects;
import com.wickr.android.api.WickrAPIRequests;
import com.wickr.enterprise.api.WickrAPIContext;
import com.wickr.enterprise.api.connections.WickrAPIConnection;
import com.wickr.session.Session;
import io.sentry.SentryBaseEvent;
import io.sentry.cache.EnvelopeCache;
import io.sentry.protocol.App;
import java.util.List;
import kotlin.Metadata;
import kotlin.collections.CollectionsKt;
import kotlin.coroutines.Continuation;
import kotlin.coroutines.jvm.internal.Boxing;
import kotlin.jvm.internal.Intrinsics;
import ly.count.android.sdk.Countly;
import timber.log.Timber;

/* JADX INFO: compiled from: WickrAPIModule.kt */
/* JADX INFO: loaded from: classes4.dex */
@Metadata(d1 = {"\u0000@\n\u0002\u0018\u0002\n\u0002\u0010\u0000\n\u0000\n\u0002\u0018\u0002\n\u0000\n\u0002\u0018\u0002\n\u0002\b\u0007\n\u0002\u0010 \n\u0002\u0010\u000e\n\u0002\b\u0005\n\u0002\u0018\u0002\n\u0000\n\u0002\u0018\u0002\n\u0000\n\u0002\u0018\u0002\n\u0002\b\u0002\n\u0002\u0010\u000b\n\u0002\b\u0003\b'\u0018\u00002\u00020\u0001B\u0017\u0012\u0006\u0010\u0002\u001a\u00020\u0003\u0012\u0006\u0010\u0004\u001a\u00020\u0005¢\u0006\u0004\b\u0006\u0010\u0007J \u0010\u0013\u001a\u0004\u0018\u00010\u00142\u0006\u0010\u0015\u001a\u00020\u00162\u0006\u0010\u0017\u001a\u00020\u0018H\u0096@¢\u0006\u0002\u0010\u0019J\u0016\u0010\u001a\u001a\u00020\u001b2\u0006\u0010\u001c\u001a\u00020\u0001H\u0096@¢\u0006\u0002\u0010\u001dR\u0011\u0010\u0002\u001a\u00020\u0003¢\u0006\b\n\u0000\u001a\u0004\b\b\u0010\tR\u0011\u0010\u0004\u001a\u00020\u0005¢\u0006\b\n\u0000\u001a\u0004\b\n\u0010\u000bR\u0018\u0010\f\u001a\b\u0012\u0004\u0012\u00020\u000e0\rX¦\u0004¢\u0006\u0006\u001a\u0004\b\u000f\u0010\u0010R\u001a\u0010\u0011\u001a\b\u0012\u0004\u0012\u00020\u000e0\rX\u0096\u0004¢\u0006\b\n\u0000\u001a\u0004\b\u0012\u0010\u0010¨\u0006\u001e"}, d2 = {"Lcom/wickr/enterprise/api/modules/WickrAPIModule;", "", "apiContext", "Lcom/wickr/enterprise/api/WickrAPIContext;", EnvelopeCache.PREFIX_CURRENT_SESSION_FILE, "Lcom/wickr/session/Session;", "<init>", "(Lcom/wickr/enterprise/api/WickrAPIContext;Lcom/wickr/session/Session;)V", "getApiContext", "()Lcom/wickr/enterprise/api/WickrAPIContext;", "getSession", "()Lcom/wickr/session/Session;", "requests", "", "", "getRequests", "()Ljava/util/List;", Countly.CountlyFeatureNames.events, "getEvents", "processRequest", "Lcom/wickr/android/api/WickrAPIObjects$APIError;", App.TYPE, "Lcom/wickr/enterprise/api/connections/WickrAPIConnection;", SentryBaseEvent.JsonKeys.REQUEST, "Lcom/wickr/android/api/WickrAPIRequests$WickrAPIRequest;", "(Lcom/wickr/enterprise/api/connections/WickrAPIConnection;Lcom/wickr/android/api/WickrAPIRequests$WickrAPIRequest;Lkotlin/coroutines/Continuation;)Ljava/lang/Object;", "processEvent", "", NotificationCompat.CATEGORY_EVENT, "(Ljava/lang/Object;Lkotlin/coroutines/Continuation;)Ljava/lang/Object;", "app_awsRelease"}, k = 1, mv = {2, 2, 0}, xi = 48)
public abstract class WickrAPIModule {
    public static final int $stable = 8;
    private final WickrAPIContext apiContext;
    private final List<String> events;
    private final Session session;

    static /* synthetic */ Object processRequest$suspendImpl(WickrAPIModule wickrAPIModule, WickrAPIConnection wickrAPIConnection, WickrAPIRequests.WickrAPIRequest wickrAPIRequest, Continuation<? super WickrAPIObjects.APIError> continuation) {
        return null;
    }

    public abstract List<String> getRequests();

    public Object processEvent(Object obj, Continuation<? super Boolean> continuation) {
        return processEvent$suspendImpl(this, obj, continuation);
    }

    public Object processRequest(WickrAPIConnection wickrAPIConnection, WickrAPIRequests.WickrAPIRequest wickrAPIRequest, Continuation<? super WickrAPIObjects.APIError> continuation) {
        return processRequest$suspendImpl(this, wickrAPIConnection, wickrAPIRequest, continuation);
    }

    public WickrAPIModule(WickrAPIContext apiContext, Session session) {
        Intrinsics.checkNotNullParameter(apiContext, "apiContext");
        Intrinsics.checkNotNullParameter(session, "session");
        this.apiContext = apiContext;
        this.session = session;
        this.events = CollectionsKt.emptyList();
    }

    public final WickrAPIContext getApiContext() {
        return this.apiContext;
    }

    public final Session getSession() {
        return this.session;
    }

    public List<String> getEvents() {
        return this.events;
    }

    static /* synthetic */ Object processEvent$suspendImpl(WickrAPIModule wickrAPIModule, Object obj, Continuation<? super Boolean> continuation) {
        Timber.INSTANCE.w("Ignoring unexpected event: " + obj, new Object[0]);
        return Boxing.boxBoolean(false);
    }
}
