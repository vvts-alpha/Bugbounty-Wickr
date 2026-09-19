package com.wickr.enterprise.api.connections;

import com.wickr.android.api.WickrAPI;
import com.wickr.enterprise.api.WickrAPIEvent;
import com.wickr.enterprise.util.EventBusManager;
import com.wickr.session.Session;
import io.sentry.cache.EnvelopeCache;
import java.util.Collection;
import java.util.Comparator;
import java.util.List;
import java.util.concurrent.ConcurrentHashMap;
import kotlin.Metadata;
import kotlin.collections.CollectionsKt;
import kotlin.comparisons.ComparisonsKt;
import kotlin.jvm.internal.Intrinsics;
import timber.log.Timber;

/* JADX INFO: compiled from: WickrAPIConnectionManager.kt */
/* JADX INFO: loaded from: classes4.dex */
@Metadata(d1 = {"\u0000F\n\u0002\u0018\u0002\n\u0002\u0010\u0000\n\u0000\n\u0002\u0018\u0002\n\u0002\b\u0005\n\u0002\u0010\u000b\n\u0000\n\u0002\u0018\u0002\n\u0002\u0010\u000e\n\u0002\u0018\u0002\n\u0002\b\u0003\n\u0002\u0010\u0002\n\u0000\n\u0002\u0018\u0002\n\u0002\b\u0004\n\u0002\u0010 \n\u0002\b\u0005\n\u0002\u0018\u0002\n\u0002\b\u0004\b'\u0018\u00002\u00020\u0001B\u000f\u0012\u0006\u0010\u0002\u001a\u00020\u0003¢\u0006\u0004\b\u0004\u0010\u0005J\u000e\u0010\u0010\u001a\u00020\u00112\u0006\u0010\u0012\u001a\u00020\u0013J\u0010\u0010\u0014\u001a\u00020\u00112\u0006\u0010\u0012\u001a\u00020\u0013H&J\u0010\u0010\u0015\u001a\u00020\t2\u0006\u0010\u0016\u001a\u00020\fH&J\f\u0010\u0017\u001a\b\u0012\u0004\u0012\u00020\r0\u0018J\u0010\u0010\u0019\u001a\u0004\u0018\u00010\r2\u0006\u0010\u0016\u001a\u00020\fJ\u000e\u0010\u001a\u001a\u00020\t2\u0006\u0010\u001b\u001a\u00020\rJ\u000e\u0010\u001c\u001a\u00020\t2\u0006\u0010\u001b\u001a\u00020\rJ\u000e\u0010\u001d\u001a\b\u0012\u0004\u0012\u00020\u001e0\u0018H&J\u0012\u0010\u001f\u001a\u0004\u0018\u00010\u001e2\u0006\u0010\u0016\u001a\u00020\fH&J\u0010\u0010 \u001a\u00020\t2\u0006\u0010\u001b\u001a\u00020\u001eH&J\u0010\u0010!\u001a\u00020\t2\u0006\u0010\u001b\u001a\u00020\u001eH&R\u0011\u0010\u0002\u001a\u00020\u0003¢\u0006\b\n\u0000\u001a\u0004\b\u0006\u0010\u0007R\u000e\u0010\b\u001a\u00020\tX\u0082\u000e¢\u0006\u0002\n\u0000R\u001d\u0010\n\u001a\u000e\u0012\u0004\u0012\u00020\f\u0012\u0004\u0012\u00020\r0\u000b¢\u0006\b\n\u0000\u001a\u0004\b\u000e\u0010\u000f¨\u0006\""}, d2 = {"Lcom/wickr/enterprise/api/connections/WickrAPIConnectionManager;", "", "eventBusManager", "Lcom/wickr/enterprise/util/EventBusManager;", "<init>", "(Lcom/wickr/enterprise/util/EventBusManager;)V", "getEventBusManager", "()Lcom/wickr/enterprise/util/EventBusManager;", "isInitialized", "", "pendingRegistrationRequests", "Ljava/util/concurrent/ConcurrentHashMap;", "", "Lcom/wickr/enterprise/api/connections/PendingAPIConnection;", "getPendingRegistrationRequests", "()Ljava/util/concurrent/ConcurrentHashMap;", "initializeInternal", "", EnvelopeCache.PREFIX_CURRENT_SESSION_FILE, "Lcom/wickr/session/Session;", "initialize", "isApproved", WickrAPI.EXTRA_PACKAGE_NAME, "getPendingConnections", "", "getPendingConnection", "addPendingConnection", "connection", "removePendingConnection", "getConnections", "Lcom/wickr/enterprise/api/connections/ApprovedAPIConnection;", "getConnection", "saveConnection", "deleteConnection", "app_awsRelease"}, k = 1, mv = {2, 2, 0}, xi = 48)
public abstract class WickrAPIConnectionManager {
    public static final int $stable = 8;
    private final EventBusManager eventBusManager;
    private boolean isInitialized;
    private final ConcurrentHashMap<String, PendingAPIConnection> pendingRegistrationRequests;

    public abstract boolean deleteConnection(ApprovedAPIConnection connection);

    public abstract ApprovedAPIConnection getConnection(String packageName);

    public abstract List<ApprovedAPIConnection> getConnections();

    public abstract void initialize(Session session);

    public abstract boolean isApproved(String packageName);

    public abstract boolean saveConnection(ApprovedAPIConnection connection);

    public WickrAPIConnectionManager(EventBusManager eventBusManager) {
        Intrinsics.checkNotNullParameter(eventBusManager, "eventBusManager");
        this.eventBusManager = eventBusManager;
        this.pendingRegistrationRequests = new ConcurrentHashMap<>();
    }

    public final EventBusManager getEventBusManager() {
        return this.eventBusManager;
    }

    public final ConcurrentHashMap<String, PendingAPIConnection> getPendingRegistrationRequests() {
        return this.pendingRegistrationRequests;
    }

    public final void initializeInternal(Session session) {
        Intrinsics.checkNotNullParameter(session, "session");
        if (this.isInitialized) {
            return;
        }
        Timber.INSTANCE.i("Initializing connection manager " + getClass().getSimpleName(), new Object[0]);
        initialize(session);
        this.isInitialized = true;
    }

    public final List<PendingAPIConnection> getPendingConnections() {
        Collection<PendingAPIConnection> collectionValues = this.pendingRegistrationRequests.values();
        Intrinsics.checkNotNullExpressionValue(collectionValues, "<get-values>(...)");
        return CollectionsKt.sortedWith(CollectionsKt.toList(collectionValues), new Comparator() { // from class: com.wickr.enterprise.api.connections.WickrAPIConnectionManager$getPendingConnections$$inlined$sortedBy$1
            /* JADX WARN: Multi-variable type inference failed */
            @Override // java.util.Comparator
            public final int compare(T t, T t2) {
                return ComparisonsKt.compareValues(Long.valueOf(((PendingAPIConnection) t).getDateRequested()), Long.valueOf(((PendingAPIConnection) t2).getDateRequested()));
            }
        });
    }

    public final PendingAPIConnection getPendingConnection(String packageName) {
        Intrinsics.checkNotNullParameter(packageName, "packageName");
        return this.pendingRegistrationRequests.get(packageName);
    }

    public final boolean addPendingConnection(PendingAPIConnection connection) {
        Intrinsics.checkNotNullParameter(connection, "connection");
        Timber.INSTANCE.i("Adding pending connection for " + connection.getAppInfo().getPackageName(), new Object[0]);
        this.pendingRegistrationRequests.put(connection.getAppInfo().getPackageName(), connection);
        this.eventBusManager.postEvent(new WickrAPIEvent.ConnectionUpdated(connection));
        return true;
    }

    public final boolean removePendingConnection(PendingAPIConnection connection) {
        Intrinsics.checkNotNullParameter(connection, "connection");
        Timber.INSTANCE.i("Removing pending connection for " + connection.getAppInfo().getPackageName(), new Object[0]);
        boolean z = this.pendingRegistrationRequests.remove(connection.getAppInfo().getPackageName()) != null;
        if (z) {
            this.eventBusManager.postEvent(new WickrAPIEvent.ConnectionRemoved(connection));
        }
        return z;
    }
}
