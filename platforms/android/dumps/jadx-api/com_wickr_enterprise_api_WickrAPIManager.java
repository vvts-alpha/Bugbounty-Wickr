package com.wickr.enterprise.api;

import android.content.Context;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import androidx.core.app.NotificationCompat;
import com.google.protobuf.ByteString;
import com.mywickr.db.MigrationHelper;
import com.mywickr.interfaces.WickrConvoInterface;
import com.mywickr.interfaces.WickrMessageInterface;
import com.mywickr.interfaces.WickrUserInterface;
import com.mywickr.repository.ConvoRepository;
import com.mywickr.wickr.WickrConvoUser;
import com.mywickr.wickr.WickrDBAdapter;
import com.mywickr.wickr.WickrUser;
import com.sun.jna.Callback;
import com.wickr.android.api.WickrAPI;
import com.wickr.android.api.WickrAPIObjects;
import com.wickr.android.api.WickrAPIRequests;
import com.wickr.android.api.WickrAPIResponses;
import com.wickr.bugreporter.WickrBugReporter;
import com.wickr.enterprise.api.connections.ApprovedAPIConnection;
import com.wickr.enterprise.api.connections.PendingAPIConnection;
import com.wickr.enterprise.api.connections.WickrAPIConnection;
import com.wickr.enterprise.api.connections.WickrAPIConnectionManager;
import com.wickr.enterprise.api.modules.WickrAPIModuleManager;
import com.wickr.enterprise.api.receivers.WickrAPIBroadcastHandler;
import com.wickr.enterprise.notifications.NotificationManager;
import com.wickr.enterprise.util.EventBusManager;
import com.wickr.enterprise.util.NotificationUtilKt;
import com.wickr.networking.websockets.SwitchboardConnection;
import com.wickr.registration.LoginDetails;
import com.wickr.registration.LoginResult;
import com.wickr.search.SearchResultRepository;
import com.wickr.session.Session;
import com.wickr.session.SessionManager;
import io.sentry.SentryBaseEvent;
import io.sentry.protocol.App;
import io.sentry.protocol.Response;
import io.sentry.protocol.ViewHierarchyNode;
import java.io.ByteArrayOutputStream;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.util.List;
import javax.crypto.KeyGenerator;
import kotlin.Metadata;
import kotlin.NoWhenBranchMatchedException;
import kotlin.Pair;
import kotlin.ResultKt;
import kotlin.Unit;
import kotlin.coroutines.Continuation;
import kotlin.coroutines.intrinsics.IntrinsicsKt;
import kotlin.coroutines.jvm.internal.DebugMetadata;
import kotlin.coroutines.jvm.internal.SpillingKt;
import kotlin.coroutines.jvm.internal.SuspendLambda;
import kotlin.jvm.functions.Function1;
import kotlin.jvm.internal.Intrinsics;
import kotlin.text.StringsKt;
import org.greenrobot.eventbus.Subscribe;
import timber.log.Timber;

/* JADX INFO: compiled from: WickrAPIManager.kt */
/* JADX INFO: loaded from: classes4.dex */
@Metadata(d1 = {"\u0000à\u0001\n\u0002\u0018\u0002\n\u0002\u0018\u0002\n\u0002\u0018\u0002\n\u0000\n\u0002\u0018\u0002\n\u0000\n\u0002\u0018\u0002\n\u0000\n\u0002\u0018\u0002\n\u0000\n\u0002\u0018\u0002\n\u0000\n\u0002\u0018\u0002\n\u0000\n\u0002\u0018\u0002\n\u0000\n\u0002\u0018\u0002\n\u0000\n\u0002\u0018\u0002\n\u0000\n\u0002\u0018\u0002\n\u0002\b\u000e\n\u0002\u0010\u000b\n\u0000\n\u0002\u0010\u0002\n\u0000\n\u0002\u0010\u000e\n\u0000\n\u0002\u0018\u0002\n\u0002\u0018\u0002\n\u0002\u0010\u0000\n\u0002\b\u0003\n\u0002\u0018\u0002\n\u0002\b\u0002\n\u0002\u0018\u0002\n\u0002\b\u0002\n\u0002\u0018\u0002\n\u0002\b\u0002\n\u0002\u0010\u0012\n\u0002\b\u0003\n\u0002\u0018\u0002\n\u0002\b\u0002\n\u0002\u0018\u0002\n\u0000\n\u0002\u0018\u0002\n\u0002\b\u0004\n\u0002\u0010\t\n\u0002\b\u0003\n\u0002\u0018\u0002\n\u0000\n\u0002\u0018\u0002\n\u0002\b\u0002\n\u0002\u0018\u0002\n\u0002\b\b\n\u0002\u0018\u0002\n\u0002\b\u0002\n\u0002\u0018\u0002\n\u0002\b\u0004\n\u0002\u0018\u0002\n\u0000\n\u0002\u0010\b\n\u0000\n\u0002\u0018\u0002\n\u0002\b\u0004\b\u0007\u0018\u00002\u00020\u00012\u00020\u0002BW\u0012\u0006\u0010\u0003\u001a\u00020\u0004\u0012\u0006\u0010\u0005\u001a\u00020\u0006\u0012\u0006\u0010\u0007\u001a\u00020\b\u0012\u0006\u0010\t\u001a\u00020\n\u0012\u0006\u0010\u000b\u001a\u00020\f\u0012\u0006\u0010\r\u001a\u00020\u000e\u0012\u0006\u0010\u000f\u001a\u00020\u0010\u0012\u0006\u0010\u0011\u001a\u00020\u0012\u0012\u0006\u0010\u0013\u001a\u00020\u0014\u0012\u0006\u0010\u0015\u001a\u00020\u0014¢\u0006\u0004\b\u0016\u0010\u0017J\u0006\u0010\"\u001a\u00020#J3\u0010$\u001a\u00020%2\u0006\u0010&\u001a\u00020'2\u001c\u0010(\u001a\u0018\b\u0001\u0012\n\u0012\b\u0012\u0004\u0012\u00020%0*\u0012\u0006\u0012\u0004\u0018\u00010+0)H\u0002¢\u0006\u0002\u0010,J\u0010\u0010-\u001a\u00020%2\u0006\u0010.\u001a\u00020/H\u0016J\"\u00100\u001a\u00020%2\b\u00101\u001a\u0004\u0018\u0001022\u0006\u00103\u001a\u00020'2\u0006\u00104\u001a\u000205H\u0002J\u0018\u00106\u001a\u00020%2\u0006\u00101\u001a\u0002022\u0006\u00107\u001a\u000208H\u0002J\u0010\u00109\u001a\u00020%2\u0006\u0010.\u001a\u00020/H\u0016J\u0010\u0010:\u001a\u00020%2\u0006\u0010;\u001a\u00020<H\u0016J\u0018\u0010=\u001a\u00020#2\u0006\u0010>\u001a\u00020?2\u0006\u0010@\u001a\u00020AH\u0016J)\u0010B\u001a\u00020#2\u0006\u0010C\u001a\u00020'2\b\u0010D\u001a\u0004\u0018\u00010'2\b\u0010E\u001a\u0004\u0018\u00010FH\u0016¢\u0006\u0002\u0010GJ\u0018\u0010H\u001a\u00020#2\u0006\u0010C\u001a\u00020'2\u0006\u0010D\u001a\u00020'H\u0016J\u0018\u0010I\u001a\u00020%2\u0006\u00101\u001a\u00020J2\u0006\u0010K\u001a\u00020LH\u0016J \u0010M\u001a\u00020%2\u0006\u00101\u001a\u00020J2\u0006\u00103\u001a\u00020'2\u0006\u0010N\u001a\u00020OH\u0016J\u0018\u0010P\u001a\u00020%2\u0006\u0010&\u001a\u00020'2\u0006\u0010K\u001a\u00020LH\u0002J \u0010Q\u001a\u00020%2\u0006\u0010&\u001a\u00020'2\u0006\u0010K\u001a\u00020L2\u0006\u0010R\u001a\u000208H\u0002J \u0010S\u001a\u00020%2\u0006\u0010&\u001a\u00020'2\u0006\u00103\u001a\u00020'2\u0006\u0010N\u001a\u00020OH\u0002J\u0018\u0010S\u001a\u00020%2\u0006\u0010&\u001a\u00020'2\u0006\u0010K\u001a\u00020LH\u0002J\u0010\u0010T\u001a\u00020#2\u0006\u0010\t\u001a\u00020\nH\u0002J\u0010\u0010U\u001a\u00020#2\u0006\u0010\t\u001a\u00020\nH\u0002J\b\u0010V\u001a\u000208H\u0002J\u0012\u0010W\u001a\u0004\u0018\u00010X2\u0006\u0010Y\u001a\u00020'H\u0016J\u0012\u0010Z\u001a\u0004\u0018\u00010[2\u0006\u0010\\\u001a\u000208H\u0016J(\u0010]\u001a\u00020#2\u0006\u0010^\u001a\u00020[2\u0006\u0010_\u001a\u00020`2\u0006\u0010a\u001a\u00020b2\u0006\u0010c\u001a\u00020dH\u0016J\u0010\u0010e\u001a\u00020%2\u0006\u0010;\u001a\u00020+H\u0007J\u000e\u0010f\u001a\u00020%2\u0006\u00101\u001a\u000202J\u000e\u0010g\u001a\u00020%2\u0006\u00101\u001a\u00020JR\u0014\u0010\u0003\u001a\u00020\u0004X\u0096\u0004¢\u0006\b\n\u0000\u001a\u0004\b\u0018\u0010\u0019R\u0014\u0010\u0005\u001a\u00020\u0006X\u0096\u0004¢\u0006\b\n\u0000\u001a\u0004\b\u001a\u0010\u001bR\u000e\u0010\u0007\u001a\u00020\bX\u0082\u0004¢\u0006\u0002\n\u0000R\u000e\u0010\t\u001a\u00020\nX\u0082\u0004¢\u0006\u0002\n\u0000R\u000e\u0010\u000b\u001a\u00020\fX\u0082\u0004¢\u0006\u0002\n\u0000R\u000e\u0010\r\u001a\u00020\u000eX\u0082\u0004¢\u0006\u0002\n\u0000R\u000e\u0010\u000f\u001a\u00020\u0010X\u0082\u0004¢\u0006\u0002\n\u0000R\u000e\u0010\u0011\u001a\u00020\u0012X\u0082\u0004¢\u0006\u0002\n\u0000R\u0014\u0010\u0013\u001a\u00020\u0014X\u0096\u0004¢\u0006\b\n\u0000\u001a\u0004\b\u001c\u0010\u001dR\u0014\u0010\u0015\u001a\u00020\u0014X\u0096\u0004¢\u0006\b\n\u0000\u001a\u0004\b\u001e\u0010\u001dR\u0014\u0010\u001f\u001a\u00020\u00128VX\u0096\u0004¢\u0006\u0006\u001a\u0004\b \u0010!¨\u0006h"}, d2 = {"Lcom/wickr/enterprise/api/WickrAPIManager;", "Lcom/wickr/enterprise/api/receivers/WickrAPIBroadcastHandler;", "Lcom/wickr/enterprise/api/WickrAPIContext;", "context", "Landroid/content/Context;", "authHandler", "Lcom/wickr/enterprise/api/WickrAPIAuthHandler;", "threadExecutor", "Lcom/wickr/enterprise/api/APIThreadExecutor;", "sessionManager", "Lcom/wickr/session/SessionManager;", "notificationManager", "Lcom/wickr/enterprise/notifications/NotificationManager;", "eventBusManager", "Lcom/wickr/enterprise/util/EventBusManager;", "moduleManager", "Lcom/wickr/enterprise/api/modules/WickrAPIModuleManager;", "_connectionManager", "Lcom/wickr/enterprise/api/connections/WickrAPIConnectionManager;", "userLocalSearchRepository", "Lcom/wickr/search/SearchResultRepository;", "userServerSearchRepository", "<init>", "(Landroid/content/Context;Lcom/wickr/enterprise/api/WickrAPIAuthHandler;Lcom/wickr/enterprise/api/APIThreadExecutor;Lcom/wickr/session/SessionManager;Lcom/wickr/enterprise/notifications/NotificationManager;Lcom/wickr/enterprise/util/EventBusManager;Lcom/wickr/enterprise/api/modules/WickrAPIModuleManager;Lcom/wickr/enterprise/api/connections/WickrAPIConnectionManager;Lcom/wickr/search/SearchResultRepository;Lcom/wickr/search/SearchResultRepository;)V", "getContext", "()Landroid/content/Context;", "getAuthHandler", "()Lcom/wickr/enterprise/api/WickrAPIAuthHandler;", "getUserLocalSearchRepository", "()Lcom/wickr/search/SearchResultRepository;", "getUserServerSearchRepository", "connectionManager", "getConnectionManager", "()Lcom/wickr/enterprise/api/connections/WickrAPIConnectionManager;", "isEnabled", "", "executeBackgroundWork", "", WickrAPI.EXTRA_PACKAGE_NAME, "", Callback.METHOD_NAME, "Lkotlin/Function1;", "Lkotlin/coroutines/Continuation;", "", "(Ljava/lang/String;Lkotlin/jvm/functions/Function1;)V", "handlePairingRequest", "intent", "Landroid/content/Intent;", "processPairingRequest", App.TYPE, "Lcom/wickr/enterprise/api/connections/PendingAPIConnection;", ViewHierarchyNode.JsonKeys.IDENTIFIER, SentryBaseEvent.JsonKeys.REQUEST, "Lcom/wickr/android/api/WickrAPIRequests$PairingRequest;", "processPairingAckRequest", "encryptedRequest", "", "handleAPIRequest", "showEventNotification", NotificationCompat.CATEGORY_EVENT, "Lcom/wickr/enterprise/api/WickrAPIEvent;", "showMessageNotification", "convo", "Lcom/mywickr/interfaces/WickrConvoInterface;", "message", "Lcom/mywickr/interfaces/WickrMessageInterface;", "dismissMessageNotification", WickrConvoUser.Schema.KEY_convoID, "messageID", "timestamp", "", "(Ljava/lang/String;Ljava/lang/String;Ljava/lang/Long;)Z", "cancelPendingMessageNotification", "sendResponse", "Lcom/wickr/enterprise/api/connections/WickrAPIConnection;", Response.TYPE, "Lcom/wickr/android/api/WickrAPIResponses$WickrAPIResponse;", "sendError", "error", "Lcom/wickr/android/api/WickrAPIObjects$APIError;", "sendPairingResponse", "sendSuccessResponse", "key", "sendErrorResponse", "needsLogin", "loginIfNecessary", "generateEncryptionKey", "getUser", "Lcom/mywickr/interfaces/WickrUserInterface;", "userID", "decodeBitmap", "Landroid/graphics/Bitmap;", "bytes", "compressBitmap", "bitmap", "format", "Landroid/graphics/Bitmap$CompressFormat;", "quality", "", "stream", "Ljava/io/ByteArrayOutputStream;", "onAppEvent", "approveWickrAPIConnection", "removeWickrAPIConnection", "app_awsRelease"}, k = 1, mv = {2, 2, 0}, xi = 48)
public final class WickrAPIManager implements WickrAPIBroadcastHandler, WickrAPIContext {
    public static final int $stable = 8;
    private final WickrAPIConnectionManager _connectionManager;
    private final WickrAPIAuthHandler authHandler;
    private final Context context;
    private final EventBusManager eventBusManager;
    private final WickrAPIModuleManager moduleManager;
    private final NotificationManager notificationManager;
    private final SessionManager sessionManager;
    private final APIThreadExecutor threadExecutor;
    private final SearchResultRepository userLocalSearchRepository;
    private final SearchResultRepository userServerSearchRepository;

    public WickrAPIManager(Context context, WickrAPIAuthHandler authHandler, APIThreadExecutor threadExecutor, SessionManager sessionManager, NotificationManager notificationManager, EventBusManager eventBusManager, WickrAPIModuleManager moduleManager, WickrAPIConnectionManager _connectionManager, SearchResultRepository userLocalSearchRepository, SearchResultRepository userServerSearchRepository) {
        Intrinsics.checkNotNullParameter(context, "context");
        Intrinsics.checkNotNullParameter(authHandler, "authHandler");
        Intrinsics.checkNotNullParameter(threadExecutor, "threadExecutor");
        Intrinsics.checkNotNullParameter(sessionManager, "sessionManager");
        Intrinsics.checkNotNullParameter(notificationManager, "notificationManager");
        Intrinsics.checkNotNullParameter(eventBusManager, "eventBusManager");
        Intrinsics.checkNotNullParameter(moduleManager, "moduleManager");
        Intrinsics.checkNotNullParameter(_connectionManager, "_connectionManager");
        Intrinsics.checkNotNullParameter(userLocalSearchRepository, "userLocalSearchRepository");
        Intrinsics.checkNotNullParameter(userServerSearchRepository, "userServerSearchRepository");
        this.context = context;
        this.authHandler = authHandler;
        this.threadExecutor = threadExecutor;
        this.sessionManager = sessionManager;
        this.notificationManager = notificationManager;
        this.eventBusManager = eventBusManager;
        this.moduleManager = moduleManager;
        this._connectionManager = _connectionManager;
        this.userLocalSearchRepository = userLocalSearchRepository;
        this.userServerSearchRepository = userServerSearchRepository;
        Timber.INSTANCE.i("Initializing Wickr API manager", new Object[0]);
        eventBusManager.subscribe(this);
    }

    @Override // com.wickr.enterprise.api.WickrAPIContext
    public Context getContext() {
        return this.context;
    }

    @Override // com.wickr.enterprise.api.WickrAPIContext
    public WickrAPIAuthHandler getAuthHandler() {
        return this.authHandler;
    }

    @Override // com.wickr.enterprise.api.WickrAPIContext
    public SearchResultRepository getUserLocalSearchRepository() {
        return this.userLocalSearchRepository;
    }

    @Override // com.wickr.enterprise.api.WickrAPIContext
    public SearchResultRepository getUserServerSearchRepository() {
        return this.userServerSearchRepository;
    }

    @Override // com.wickr.enterprise.api.WickrAPIContext
    public WickrAPIConnectionManager getConnectionManager() {
        WickrAPIConnectionManager wickrAPIConnectionManager = this._connectionManager;
        Session activeSession = this.sessionManager.getActiveSession();
        if (activeSession != null) {
            wickrAPIConnectionManager.initializeInternal(activeSession);
        }
        return wickrAPIConnectionManager;
    }

    public final boolean isEnabled() {
        return getAuthHandler().isEnabled();
    }

    /* JADX INFO: renamed from: com.wickr.enterprise.api.WickrAPIManager$executeBackgroundWork$1, reason: invalid class name and case insensitive filesystem */
    /* JADX INFO: compiled from: WickrAPIManager.kt */
    @Metadata(d1 = {"\u0000\u0006\n\u0000\n\u0002\u0010\u0002\u0010\u0000\u001a\u00020\u0001H\n"}, d2 = {"<anonymous>", ""}, k = 3, mv = {2, 2, 0}, xi = 48)
    @DebugMetadata(c = "com.wickr.enterprise.api.WickrAPIManager$executeBackgroundWork$1", f = "WickrAPIManager.kt", i = {}, l = {77}, m = "invokeSuspend", n = {}, s = {}, v = 1)
    static final class C05391 extends SuspendLambda implements Function1<Continuation<? super Unit>, Object> {
        final /* synthetic */ Function1<Continuation<? super Unit>, Object> $callback;
        int label;

        /* JADX WARN: 'super' call moved to the top of the method (can break code semantics) */
        /* JADX WARN: Multi-variable type inference failed */
        C05391(Function1<? super Continuation<? super Unit>, ? extends Object> function1, Continuation<? super C05391> continuation) {
            super(1, continuation);
            this.$callback = function1;
        }

        @Override // kotlin.coroutines.jvm.internal.BaseContinuationImpl
        public final Continuation<Unit> create(Continuation<?> continuation) {
            return new C05391(this.$callback, continuation);
        }

        @Override // kotlin.jvm.functions.Function1
        public final Object invoke(Continuation<? super Unit> continuation) {
            return ((C05391) create(continuation)).invokeSuspend(Unit.INSTANCE);
        }

        @Override // kotlin.coroutines.jvm.internal.BaseContinuationImpl
        public final Object invokeSuspend(Object obj) {
            Object coroutine_suspended = IntrinsicsKt.getCOROUTINE_SUSPENDED();
            int i = this.label;
            if (i == 0) {
                ResultKt.throwOnFailure(obj);
                Function1<Continuation<? super Unit>, Object> function1 = this.$callback;
                this.label = 1;
                if (function1.invoke(this) == coroutine_suspended) {
                    return coroutine_suspended;
                }
            } else {
                if (i != 1) {
                    throw new IllegalStateException("call to 'resume' before 'invoke' with coroutine");
                }
                ResultKt.throwOnFailure(obj);
            }
            return Unit.INSTANCE;
        }
    }

    private final void executeBackgroundWork(String packageName, Function1<? super Continuation<? super Unit>, ? extends Object> callback) {
        Timber.INSTANCE.d("Queuing a background work for " + packageName, new Object[0]);
        this.threadExecutor.launch(packageName, new C05391(callback, null));
    }

    @Override // com.wickr.enterprise.api.receivers.WickrAPIBroadcastHandler
    public void handlePairingRequest(Intent intent) {
        Intrinsics.checkNotNullParameter(intent, "intent");
        if (Intrinsics.areEqual(intent.getAction(), WickrAPI.INTENT_ACTION_PAIR_APP)) {
            String stringExtra = intent.getStringExtra(WickrAPI.EXTRA_PACKAGE_NAME);
            String str = stringExtra;
            if (str == null || str.length() == 0) {
                Timber.INSTANCE.e("Unable to process API request because the package name is missing", new Object[0]);
            } else if (!getAuthHandler().isAllowed(stringExtra)) {
                Timber.INSTANCE.e("Package " + stringExtra + " is not authorized", new Object[0]);
            } else {
                executeBackgroundWork(stringExtra, new C05411(stringExtra, intent, null));
            }
        }
    }

    /* JADX INFO: renamed from: com.wickr.enterprise.api.WickrAPIManager$handlePairingRequest$1, reason: invalid class name and case insensitive filesystem */
    /* JADX INFO: compiled from: WickrAPIManager.kt */
    @Metadata(d1 = {"\u0000\u0006\n\u0000\n\u0002\u0010\u0002\u0010\u0000\u001a\u00020\u0001H\n"}, d2 = {"<anonymous>", ""}, k = 3, mv = {2, 2, 0}, xi = 48)
    @DebugMetadata(c = "com.wickr.enterprise.api.WickrAPIManager$handlePairingRequest$1", f = "WickrAPIManager.kt", i = {}, l = {}, m = "invokeSuspend", n = {}, s = {}, v = 1)
    static final class C05411 extends SuspendLambda implements Function1<Continuation<? super Unit>, Object> {
        final /* synthetic */ Intent $intent;
        final /* synthetic */ String $packageName;
        int label;

        /* JADX WARN: 'super' call moved to the top of the method (can break code semantics) */
        C05411(String str, Intent intent, Continuation<? super C05411> continuation) {
            super(1, continuation);
            this.$packageName = str;
            this.$intent = intent;
        }

        @Override // kotlin.coroutines.jvm.internal.BaseContinuationImpl
        public final Continuation<Unit> create(Continuation<?> continuation) {
            return WickrAPIManager.this.new C05411(this.$packageName, this.$intent, continuation);
        }

        @Override // kotlin.jvm.functions.Function1
        public final Object invoke(Continuation<? super Unit> continuation) {
            return ((C05411) create(continuation)).invokeSuspend(Unit.INSTANCE);
        }

        @Override // kotlin.coroutines.jvm.internal.BaseContinuationImpl
        public final Object invokeSuspend(Object obj) {
            boolean z;
            SwitchboardConnection switchboard;
            IntrinsicsKt.getCOROUTINE_SUSPENDED();
            if (this.label != 0) {
                throw new IllegalStateException("call to 'resume' before 'invoke' with coroutine");
            }
            ResultKt.throwOnFailure(obj);
            WickrAPIManager wickrAPIManager = WickrAPIManager.this;
            if (wickrAPIManager.needsLogin(wickrAPIManager.sessionManager)) {
                Timber.INSTANCE.i("Sending sync in progress error", new Object[0]);
                WickrAPIManager.this.sendErrorResponse(this.$packageName, "", WickrAPIObjects.APIError.SYNCING);
                WickrAPIManager wickrAPIManager2 = WickrAPIManager.this;
                if (!wickrAPIManager2.loginIfNecessary(wickrAPIManager2.sessionManager)) {
                    Timber.INSTANCE.e("Unable to process API request because the Wickr user could not be fully logged in", new Object[0]);
                    WickrAPIManager.this.sendErrorResponse(this.$packageName, "", WickrAPIObjects.APIError.NOT_LOGGED_IN);
                    return Unit.INSTANCE;
                }
                z = true;
            } else {
                z = false;
            }
            Session activeSession = WickrAPIManager.this.sessionManager.getActiveSession();
            if (activeSession == null) {
                Timber.INSTANCE.e("Unable to process API request because the session could not be logged in", new Object[0]);
                WickrAPIManager.this.sendErrorResponse(this.$packageName, "", WickrAPIObjects.APIError.NOT_LOGGED_IN);
                return Unit.INSTANCE;
            }
            WickrAPIManager.this.getConnectionManager().initializeInternal(activeSession);
            if (z) {
                Timber.INSTANCE.i("Sending sync complete response", new Object[0]);
                WickrAPIResponses.SyncCompleteResponse.Builder builderNewBuilder = WickrAPIResponses.SyncCompleteResponse.newBuilder();
                Session activeSession2 = WickrAPIManager.this.sessionManager.getActiveSession();
                WickrAPIResponses.WickrAPIResponse wickrAPIResponseBuild = WickrAPIResponses.WickrAPIResponse.newBuilder().setSyncCompleteResponse(builderNewBuilder.setIsOnline((activeSession2 == null || (switchboard = activeSession2.getSwitchboard()) == null || !switchboard.isConnected()) ? false : true).build()).build();
                WickrAPIManager wickrAPIManager3 = WickrAPIManager.this;
                String str = this.$packageName;
                Intrinsics.checkNotNull(wickrAPIResponseBuild);
                wickrAPIManager3.sendPairingResponse(str, wickrAPIResponseBuild);
            }
            if (WickrAPIManager.this.getConnectionManager().isApproved(this.$packageName)) {
                Timber.INSTANCE.e("Unable to process API pairing request because the app is already paired", new Object[0]);
                WickrAPIManager.this.sendErrorResponse(this.$packageName, "", WickrAPIObjects.APIError.ALREADY_PAIRED);
                return Unit.INSTANCE;
            }
            if (!this.$intent.hasExtra(WickrAPI.EXTRA_PAIRING_REQUEST) && !this.$intent.hasExtra(WickrAPI.EXTRA_API_REQUEST)) {
                Timber.INSTANCE.e("Unable to process API pairing request because no request data was provided", new Object[0]);
                WickrAPIManager.this.sendErrorResponse(this.$packageName, "", WickrAPIObjects.APIError.INVALID_REQUEST);
                return Unit.INSTANCE;
            }
            PendingAPIConnection pendingConnection = WickrAPIManager.this.getConnectionManager().getPendingConnection(this.$packageName);
            byte[] byteArrayExtra = this.$intent.getByteArrayExtra(WickrAPI.EXTRA_PAIRING_REQUEST);
            byte[] byteArrayExtra2 = this.$intent.getByteArrayExtra(WickrAPI.EXTRA_API_REQUEST);
            if (byteArrayExtra != null) {
                try {
                    WickrAPIRequests.WickrAPIRequest from = WickrAPIRequests.WickrAPIRequest.parseFrom(byteArrayExtra);
                    if (!from.hasPairingRequest()) {
                        WickrAPIManager.this.sendErrorResponse(this.$packageName, "", WickrAPIObjects.APIError.INVALID_REQUEST);
                        return Unit.INSTANCE;
                    }
                    WickrAPIManager wickrAPIManager4 = WickrAPIManager.this;
                    String identifier = from.getIdentifier();
                    Intrinsics.checkNotNullExpressionValue(identifier, "getIdentifier(...)");
                    WickrAPIRequests.PairingRequest pairingRequest = from.getPairingRequest();
                    Intrinsics.checkNotNullExpressionValue(pairingRequest, "getPairingRequest(...)");
                    wickrAPIManager4.processPairingRequest(pendingConnection, identifier, pairingRequest);
                } catch (Exception unused) {
                    WickrAPIManager.this.sendErrorResponse(this.$packageName, "", WickrAPIObjects.APIError.FAILED_DESERIALIZATION);
                    return Unit.INSTANCE;
                }
            } else if (byteArrayExtra2 != null) {
                if (pendingConnection != null) {
                    WickrAPIManager.this.processPairingAckRequest(pendingConnection, byteArrayExtra2);
                } else {
                    Timber.INSTANCE.e("Unable to process encrypted request from unauthorized app", new Object[0]);
                    WickrAPIManager.this.sendErrorResponse(this.$packageName, "", WickrAPIObjects.APIError.NOT_PAIRED);
                    return Unit.INSTANCE;
                }
            }
            return Unit.INSTANCE;
        }
    }

    /* JADX INFO: Access modifiers changed from: private */
    public final void processPairingRequest(PendingAPIConnection app, String identifier, WickrAPIRequests.PairingRequest request) {
        Timber.INSTANCE.i("Processing pairing request from " + request.getAppInfo().getPackageName(), new Object[0]);
        if (app != null) {
            Timber.INSTANCE.e("Ignoring duplicate request from " + request.getAppInfo().getPackageName(), new Object[0]);
            String packageName = request.getAppInfo().getPackageName();
            Intrinsics.checkNotNullExpressionValue(packageName, "getPackageName(...)");
            sendErrorResponse(packageName, identifier, WickrAPIObjects.APIError.INVALID_REQUEST);
            return;
        }
        PendingAPIConnection pendingAPIConnection = new PendingAPIConnection(new Pair(identifier, request), System.currentTimeMillis(), null, 4, null);
        if (pendingAPIConnection.getPendingEncryptionKey() != null) {
            Timber.INSTANCE.e("Unable to process pairing ack request, app already initiated pairing", new Object[0]);
            String packageName2 = request.getAppInfo().getPackageName();
            Intrinsics.checkNotNullExpressionValue(packageName2, "getPackageName(...)");
            sendErrorResponse(packageName2, identifier, WickrAPIObjects.APIError.INVALID_REQUEST);
            return;
        }
        String appName = request.getAppInfo().getAppName();
        Intrinsics.checkNotNullExpressionValue(appName, "getAppName(...)");
        if (appName.length() == 0) {
            Timber.INSTANCE.e("Request is missing the app name", new Object[0]);
            String packageName3 = request.getAppInfo().getPackageName();
            Intrinsics.checkNotNullExpressionValue(packageName3, "getPackageName(...)");
            sendErrorResponse(packageName3, identifier, WickrAPIObjects.APIError.INVALID_REQUEST);
            return;
        }
        if (request.getAppInfo().getAppIcon().isEmpty()) {
            Timber.INSTANCE.e("Request is missing the app icon data", new Object[0]);
            String packageName4 = request.getAppInfo().getPackageName();
            Intrinsics.checkNotNullExpressionValue(packageName4, "getPackageName(...)");
            sendErrorResponse(packageName4, identifier, WickrAPIObjects.APIError.INVALID_REQUEST);
            return;
        }
        String appDescription = request.getAppInfo().getAppDescription();
        Intrinsics.checkNotNullExpressionValue(appDescription, "getAppDescription(...)");
        if (appDescription.length() == 0) {
            Timber.INSTANCE.e("Request is missing the app description", new Object[0]);
            String packageName5 = request.getAppInfo().getPackageName();
            Intrinsics.checkNotNullExpressionValue(packageName5, "getPackageName(...)");
            sendErrorResponse(packageName5, identifier, WickrAPIObjects.APIError.INVALID_REQUEST);
            return;
        }
        Timber.INSTANCE.i("Successfully verified pending API pairing request for " + pendingAPIConnection.getAppInfo().getPackageName(), new Object[0]);
        getConnectionManager().addPendingConnection(pendingAPIConnection);
        this.notificationManager.showAPIRegistrationNotification(new WickrAPIEvent.PairingRequest(pendingAPIConnection));
        WickrAPIResponses.WickrAPIResponse wickrAPIResponseBuild = WickrAPIResponses.WickrAPIResponse.newBuilder().setIdentifier(identifier).setSuccessResponse(WickrAPIResponses.SuccessResponse.newBuilder().build()).build();
        String packageName6 = pendingAPIConnection.getAppInfo().getPackageName();
        Intrinsics.checkNotNullExpressionValue(packageName6, "getPackageName(...)");
        Intrinsics.checkNotNull(wickrAPIResponseBuild);
        sendPairingResponse(packageName6, wickrAPIResponseBuild);
    }

    /* JADX INFO: Access modifiers changed from: private */
    public final void processPairingAckRequest(PendingAPIConnection app, byte[] encryptedRequest) {
        byte[] bArrDecryptData;
        Timber.INSTANCE.i("Processing incoming pairing ack request", new Object[0]);
        byte[] pendingEncryptionKey = app.getPendingEncryptionKey();
        if (pendingEncryptionKey == null) {
            Timber.INSTANCE.e("Unable to process pairing ack request because user did not approve of the app yet", new Object[0]);
            String packageName = app.getAppInfo().getPackageName();
            Intrinsics.checkNotNullExpressionValue(packageName, "getPackageName(...)");
            sendErrorResponse(packageName, "", WickrAPIObjects.APIError.NOT_PAIRED);
            return;
        }
        WickrAPIRequests.WickrAPIRequest from = null;
        try {
            bArrDecryptData = WickrAPI.INSTANCE.decryptData(encryptedRequest, pendingEncryptionKey);
        } catch (Exception e) {
            Timber.INSTANCE.e(e);
            bArrDecryptData = null;
        }
        if (bArrDecryptData == null || bArrDecryptData.length == 0) {
            Timber.INSTANCE.e("Unable to process API request because the request could not be decrypted", new Object[0]);
            String packageName2 = app.getAppInfo().getPackageName();
            Intrinsics.checkNotNullExpressionValue(packageName2, "getPackageName(...)");
            sendErrorResponse(packageName2, "", WickrAPIObjects.APIError.FAILED_DECRYPTION);
            return;
        }
        try {
            from = WickrAPIRequests.WickrAPIRequest.parseFrom(bArrDecryptData);
        } catch (Exception e2) {
            Timber.INSTANCE.e(e2);
        }
        if (from == null) {
            Timber.INSTANCE.e("Unable to process API request because the request could not be deserialized", new Object[0]);
            String packageName3 = app.getAppInfo().getPackageName();
            Intrinsics.checkNotNullExpressionValue(packageName3, "getPackageName(...)");
            sendErrorResponse(packageName3, "", WickrAPIObjects.APIError.FAILED_DESERIALIZATION);
            return;
        }
        if (!from.hasPairingAckRequest()) {
            Timber.INSTANCE.e("Unable to process API request because it is not the expected request", new Object[0]);
            String packageName4 = app.getAppInfo().getPackageName();
            Intrinsics.checkNotNullExpressionValue(packageName4, "getPackageName(...)");
            String identifier = from.getIdentifier();
            Intrinsics.checkNotNullExpressionValue(identifier, "getIdentifier(...)");
            sendErrorResponse(packageName4, identifier, WickrAPIObjects.APIError.INVALID_REQUEST);
            return;
        }
        Timber.INSTANCE.i("Successfully processed pairing ack from " + app.getAppInfo().getPackageName(), new Object[0]);
        ApprovedAPIConnection approvedAPIConnection = new ApprovedAPIConnection(app, System.currentTimeMillis());
        getConnectionManager().saveConnection(approvedAPIConnection);
        WickrAPIResponses.WickrAPIResponse wickrAPIResponseBuild = WickrAPIResponses.WickrAPIResponse.newBuilder().setIdentifier(from.getIdentifier()).setSuccessResponse(WickrAPIResponses.SuccessResponse.newBuilder().build()).build();
        String packageName5 = app.getAppInfo().getPackageName();
        Intrinsics.checkNotNullExpressionValue(packageName5, "getPackageName(...)");
        Intrinsics.checkNotNull(wickrAPIResponseBuild);
        sendSuccessResponse(packageName5, wickrAPIResponseBuild, approvedAPIConnection.getEncryptionKey());
    }

    @Override // com.wickr.enterprise.api.receivers.WickrAPIBroadcastHandler
    public void handleAPIRequest(Intent intent) {
        Intrinsics.checkNotNullParameter(intent, "intent");
        if (Intrinsics.areEqual(intent.getAction(), WickrAPI.INTENT_ACTION_REQUEST)) {
            String stringExtra = intent.getStringExtra(WickrAPI.EXTRA_PACKAGE_NAME);
            String str = stringExtra;
            if (str == null || str.length() == 0) {
                Timber.INSTANCE.e("Unable to process API request because the package name is missing", new Object[0]);
            } else if (!getAuthHandler().isAllowed(stringExtra)) {
                Timber.INSTANCE.e("Package " + stringExtra + " is not authorized", new Object[0]);
            } else {
                executeBackgroundWork(stringExtra, new C05401(stringExtra, intent, null));
            }
        }
    }

    /* JADX INFO: renamed from: com.wickr.enterprise.api.WickrAPIManager$handleAPIRequest$1, reason: invalid class name and case insensitive filesystem */
    /* JADX INFO: compiled from: WickrAPIManager.kt */
    @Metadata(d1 = {"\u0000\u0006\n\u0000\n\u0002\u0010\u0002\u0010\u0000\u001a\u00020\u0001H\n"}, d2 = {"<anonymous>", ""}, k = 3, mv = {2, 2, 0}, xi = 48)
    @DebugMetadata(c = "com.wickr.enterprise.api.WickrAPIManager$handleAPIRequest$1", f = "WickrAPIManager.kt", i = {0, 0, 0, 0, 0, 0, 0}, l = {389}, m = "invokeSuspend", n = {"activeSession", App.TYPE, "encryptedRequest", "decryptedRequest", WickrAPI.EXTRA_API_REQUEST, "sendSyncResponse", "requestTime"}, s = {"L$0", "L$1", "L$2", "L$3", "L$4", "I$0", "J$0"}, v = 1)
    static final class C05401 extends SuspendLambda implements Function1<Continuation<? super Unit>, Object> {
        final /* synthetic */ Intent $intent;
        final /* synthetic */ String $packageName;
        int I$0;
        long J$0;
        Object L$0;
        Object L$1;
        Object L$2;
        Object L$3;
        Object L$4;
        int label;

        /* JADX WARN: 'super' call moved to the top of the method (can break code semantics) */
        C05401(String str, Intent intent, Continuation<? super C05401> continuation) {
            super(1, continuation);
            this.$packageName = str;
            this.$intent = intent;
        }

        @Override // kotlin.coroutines.jvm.internal.BaseContinuationImpl
        public final Continuation<Unit> create(Continuation<?> continuation) {
            return WickrAPIManager.this.new C05401(this.$packageName, this.$intent, continuation);
        }

        @Override // kotlin.jvm.functions.Function1
        public final Object invoke(Continuation<? super Unit> continuation) {
            return ((C05401) create(continuation)).invokeSuspend(Unit.INSTANCE);
        }

        @Override // kotlin.coroutines.jvm.internal.BaseContinuationImpl
        public final Object invokeSuspend(Object obj) {
            int i;
            byte[] bArrDecryptData;
            ApprovedAPIConnection approvedAPIConnection;
            WickrAPIRequests.WickrAPIRequest wickrAPIRequest;
            long j;
            SwitchboardConnection switchboard;
            Object coroutine_suspended = IntrinsicsKt.getCOROUTINE_SUSPENDED();
            int i2 = this.label;
            if (i2 == 0) {
                ResultKt.throwOnFailure(obj);
                WickrAPIManager wickrAPIManager = WickrAPIManager.this;
                if (wickrAPIManager.needsLogin(wickrAPIManager.sessionManager)) {
                    Timber.INSTANCE.e("Sending sync in progress error", new Object[0]);
                    WickrAPIManager.this.sendErrorResponse(this.$packageName, "", WickrAPIObjects.APIError.SYNCING);
                    WickrAPIManager wickrAPIManager2 = WickrAPIManager.this;
                    if (!wickrAPIManager2.loginIfNecessary(wickrAPIManager2.sessionManager)) {
                        Timber.INSTANCE.e("Unable to process API request because the Wickr user could not be logged in", new Object[0]);
                        WickrAPIManager.this.sendErrorResponse(this.$packageName, "", WickrAPIObjects.APIError.NOT_LOGGED_IN);
                        return Unit.INSTANCE;
                    }
                    i = 1;
                } else {
                    i = 0;
                }
                Session activeSession = WickrAPIManager.this.sessionManager.getActiveSession();
                if (activeSession != null) {
                    WickrAPIManager.this.moduleManager.initializeInternal(WickrAPIManager.this, activeSession);
                    ApprovedAPIConnection connection = WickrAPIManager.this.getConnectionManager().getConnection(this.$packageName);
                    if (!WickrAPIManager.this.getConnectionManager().isApproved(this.$packageName) || connection == null) {
                        Timber.INSTANCE.e("Unable to process API request because the app is not paired", new Object[0]);
                        WickrAPIManager.this.sendErrorResponse(this.$packageName, "", WickrAPIObjects.APIError.NOT_PAIRED);
                        return Unit.INSTANCE;
                    }
                    if (i != 0) {
                        Timber.INSTANCE.i("Sending sync complete response", new Object[0]);
                        WickrAPIResponses.SyncCompleteResponse.Builder builderNewBuilder = WickrAPIResponses.SyncCompleteResponse.newBuilder();
                        Session activeSession2 = WickrAPIManager.this.sessionManager.getActiveSession();
                        WickrAPIResponses.WickrAPIResponse wickrAPIResponseBuild = WickrAPIResponses.WickrAPIResponse.newBuilder().setSyncCompleteResponse(builderNewBuilder.setIsOnline((activeSession2 == null || (switchboard = activeSession2.getSwitchboard()) == null || !switchboard.isConnected()) ? false : true).build()).build();
                        WickrAPIManager wickrAPIManager3 = WickrAPIManager.this;
                        String str = this.$packageName;
                        Intrinsics.checkNotNull(wickrAPIResponseBuild);
                        wickrAPIManager3.sendSuccessResponse(str, wickrAPIResponseBuild, connection.getEncryptionKey());
                    }
                    byte[] byteArrayExtra = this.$intent.getByteArrayExtra(WickrAPI.EXTRA_API_REQUEST);
                    if (byteArrayExtra == null || byteArrayExtra.length == 0) {
                        Timber.INSTANCE.e("Unable to process API request because the request is missing", new Object[0]);
                        WickrAPIManager.this.sendErrorResponse(this.$packageName, "", WickrAPIObjects.APIError.INVALID_REQUEST);
                        return Unit.INSTANCE;
                    }
                    WickrAPIRequests.WickrAPIRequest from = null;
                    try {
                        bArrDecryptData = WickrAPI.INSTANCE.decryptData(byteArrayExtra, connection.getEncryptionKey());
                    } catch (Exception e) {
                        Timber.INSTANCE.e(e);
                        bArrDecryptData = null;
                    }
                    if (bArrDecryptData == null || bArrDecryptData.length == 0) {
                        Timber.INSTANCE.e("Unable to process API request because the request could not be decrypted", new Object[0]);
                        WickrAPIManager.this.sendErrorResponse(this.$packageName, "", WickrAPIObjects.APIError.FAILED_DECRYPTION);
                        return Unit.INSTANCE;
                    }
                    try {
                        from = WickrAPIRequests.WickrAPIRequest.parseFrom(bArrDecryptData);
                    } catch (Exception e2) {
                        Timber.INSTANCE.e(e2);
                    }
                    if (from == null) {
                        Timber.INSTANCE.e("Unable to process API request because the request could not be deserialized", new Object[0]);
                        WickrAPIManager.this.sendErrorResponse(this.$packageName, "", WickrAPIObjects.APIError.FAILED_DESERIALIZATION);
                        return Unit.INSTANCE;
                    }
                    long jCurrentTimeMillis = System.currentTimeMillis();
                    this.L$0 = SpillingKt.nullOutSpilledVariable(activeSession);
                    this.L$1 = connection;
                    this.L$2 = SpillingKt.nullOutSpilledVariable(byteArrayExtra);
                    this.L$3 = SpillingKt.nullOutSpilledVariable(bArrDecryptData);
                    this.L$4 = from;
                    this.I$0 = i;
                    this.J$0 = jCurrentTimeMillis;
                    this.label = 1;
                    obj = WickrAPIManager.this.moduleManager.processRequest(connection, from, this);
                    if (obj == coroutine_suspended) {
                        return coroutine_suspended;
                    }
                    approvedAPIConnection = connection;
                    wickrAPIRequest = from;
                    j = jCurrentTimeMillis;
                } else {
                    Timber.INSTANCE.e("Unable to process API request because the session could not be logged in", new Object[0]);
                    WickrAPIManager.this.sendErrorResponse(this.$packageName, "", WickrAPIObjects.APIError.NOT_LOGGED_IN);
                    return Unit.INSTANCE;
                }
            } else {
                if (i2 != 1) {
                    throw new IllegalStateException("call to 'resume' before 'invoke' with coroutine");
                }
                j = this.J$0;
                wickrAPIRequest = (WickrAPIRequests.WickrAPIRequest) this.L$4;
                approvedAPIConnection = (ApprovedAPIConnection) this.L$1;
                ResultKt.throwOnFailure(obj);
            }
            WickrAPIObjects.APIError aPIError = (WickrAPIObjects.APIError) obj;
            if (aPIError == null) {
                Timber.INSTANCE.i("Successfully processed API request " + wickrAPIRequest.getRequestCase().name(), new Object[0]);
                WickrAPIResponses.WickrAPIResponse wickrAPIResponseBuild2 = WickrAPIResponses.WickrAPIResponse.newBuilder().setIdentifier(wickrAPIRequest.getIdentifier()).setSuccessResponse(WickrAPIResponses.SuccessResponse.newBuilder().build()).build();
                WickrAPIManager wickrAPIManager4 = WickrAPIManager.this;
                String packageName = approvedAPIConnection.getAppInfo().getPackageName();
                Intrinsics.checkNotNullExpressionValue(packageName, "getPackageName(...)");
                Intrinsics.checkNotNull(wickrAPIResponseBuild2);
                wickrAPIManager4.sendSuccessResponse(packageName, wickrAPIResponseBuild2, approvedAPIConnection.getEncryptionKey());
            } else {
                Timber.INSTANCE.e("Error processing API request " + wickrAPIRequest.getRequestCase().name() + ": " + aPIError.name(), new Object[0]);
                WickrAPIManager wickrAPIManager5 = WickrAPIManager.this;
                String str2 = this.$packageName;
                String identifier = wickrAPIRequest.getIdentifier();
                Intrinsics.checkNotNullExpressionValue(identifier, "getIdentifier(...)");
                wickrAPIManager5.sendErrorResponse(str2, identifier, aPIError);
            }
            approvedAPIConnection.setDateLastAccessed(j);
            WickrAPIManager.this.getConnectionManager().saveConnection(approvedAPIConnection);
            return Unit.INSTANCE;
        }
    }

    @Override // com.wickr.enterprise.api.WickrAPIContext
    public void showEventNotification(WickrAPIEvent event) {
        Intrinsics.checkNotNullParameter(event, "event");
        this.eventBusManager.postEvent(event);
    }

    @Override // com.wickr.enterprise.api.WickrAPIContext
    public boolean showMessageNotification(WickrConvoInterface convo, WickrMessageInterface message) {
        String strGenerateNotificationContent;
        Intrinsics.checkNotNullParameter(convo, "convo");
        Intrinsics.checkNotNullParameter(message, "message");
        if (!getAuthHandler().isEnabled()) {
            Timber.INSTANCE.e("API is not enabled", new Object[0]);
            return false;
        }
        Session activeSession = this.sessionManager.getActiveSession();
        if (activeSession == null) {
            Timber.INSTANCE.e("User is not signed in", new Object[0]);
            return false;
        }
        List<ApprovedAPIConnection> connections = getConnectionManager().getConnections();
        if (connections.isEmpty()) {
            Timber.INSTANCE.w("No paired apps", new Object[0]);
            return false;
        }
        String strGenerateNotificationTitle = NotificationUtilKt.generateNotificationTitle(getContext(), convo, NotificationUtilKt.showNotificationContent(activeSession.getSettings()));
        if (NotificationUtilKt.showAnonymousNotifications(activeSession.getSettings())) {
            strGenerateNotificationContent = NotificationUtilKt.generateAnonymousNotificationContent(getContext(), message, convo.getUnreadMessageCount());
        } else {
            strGenerateNotificationContent = NotificationUtilKt.generateNotificationContent(getContext(), convo, message, NotificationUtilKt.showNotificationContent(activeSession.getSettings()), true);
        }
        for (ApprovedAPIConnection approvedAPIConnection : connections) {
            WickrAPIAuthHandler authHandler = getAuthHandler();
            String packageName = approvedAPIConnection.getAppInfo().getPackageName();
            Intrinsics.checkNotNullExpressionValue(packageName, "getPackageName(...)");
            if (authHandler.isAllowed(packageName)) {
                WickrAPIResponses.WickrAPIResponse wickrAPIResponseBuild = WickrAPIResponses.WickrAPIResponse.newBuilder().setIdentifier("WickrMessageNotification").setMessageNotificationResponse(WickrAPIResponses.MessageNotificationResponse.newBuilder().setConvoID(convo.getVGroupID()).setMessageID(message.getSrvMsgID()).setTitle(strGenerateNotificationTitle).setContent(strGenerateNotificationContent).setTimestamp(message.fullTimestampMillis()).build()).build();
                Timber.INSTANCE.i("Sending new message API response to " + approvedAPIConnection.getAppInfo().getPackageName(), new Object[0]);
                String packageName2 = approvedAPIConnection.getAppInfo().getPackageName();
                Intrinsics.checkNotNullExpressionValue(packageName2, "getPackageName(...)");
                Intrinsics.checkNotNull(wickrAPIResponseBuild);
                sendSuccessResponse(packageName2, wickrAPIResponseBuild, approvedAPIConnection.getEncryptionKey());
            }
        }
        return true;
    }

    @Override // com.wickr.enterprise.api.WickrAPIContext
    public boolean dismissMessageNotification(String convoID, String messageID, Long timestamp) {
        Intrinsics.checkNotNullParameter(convoID, "convoID");
        if (!getAuthHandler().isEnabled() || this.sessionManager.getActiveSession() == null) {
            return false;
        }
        List<ApprovedAPIConnection> connections = getConnectionManager().getConnections();
        if (connections.isEmpty()) {
            return false;
        }
        for (ApprovedAPIConnection approvedAPIConnection : connections) {
            WickrAPIAuthHandler authHandler = getAuthHandler();
            String packageName = approvedAPIConnection.getAppInfo().getPackageName();
            Intrinsics.checkNotNullExpressionValue(packageName, "getPackageName(...)");
            if (authHandler.isAllowed(packageName)) {
                WickrAPIResponses.DismissNotificationResponse.Builder convoID2 = WickrAPIResponses.DismissNotificationResponse.newBuilder().setConvoID(convoID);
                String str = messageID;
                if (str != null && !StringsKt.isBlank(str)) {
                    convoID2.setMessageID(messageID);
                }
                if (timestamp != null) {
                    convoID2.setTimestamp(timestamp.longValue());
                }
                WickrAPIResponses.WickrAPIResponse wickrAPIResponseBuild = WickrAPIResponses.WickrAPIResponse.newBuilder().setIdentifier("WickrMessageNotification").setDismissNotificationResponse(convoID2.build()).build();
                Timber.INSTANCE.i("Sending dismiss new message API response to " + approvedAPIConnection.getAppInfo().getPackageName(), new Object[0]);
                String packageName2 = approvedAPIConnection.getAppInfo().getPackageName();
                Intrinsics.checkNotNullExpressionValue(packageName2, "getPackageName(...)");
                Intrinsics.checkNotNull(wickrAPIResponseBuild);
                sendSuccessResponse(packageName2, wickrAPIResponseBuild, approvedAPIConnection.getEncryptionKey());
            }
        }
        return true;
    }

    @Override // com.wickr.enterprise.api.WickrAPIContext
    public boolean cancelPendingMessageNotification(String convoID, String messageID) {
        Intrinsics.checkNotNullParameter(convoID, "convoID");
        Intrinsics.checkNotNullParameter(messageID, "messageID");
        if (!getAuthHandler().isEnabled()) {
            Timber.INSTANCE.e("API is not enabled", new Object[0]);
            return false;
        }
        Session activeSession = this.sessionManager.getActiveSession();
        if (activeSession == null) {
            Timber.INSTANCE.e("Unable to cancel message notification, session is logged out", new Object[0]);
            return false;
        }
        WickrConvoInterface wickrConvoInterface = activeSession.getConvoRepository().get(convoID);
        if (wickrConvoInterface == null) {
            Timber.INSTANCE.e("Unable to cancel message notification, convo is missing", new Object[0]);
            return false;
        }
        Timber.INSTANCE.i("Cancelling new message notification " + messageID + " in " + convoID, new Object[0]);
        this.notificationManager.cancelPendingMessage(wickrConvoInterface, messageID);
        return true;
    }

    @Override // com.wickr.enterprise.api.WickrAPIContext
    public void sendResponse(WickrAPIConnection app, WickrAPIResponses.WickrAPIResponse response) {
        Intrinsics.checkNotNullParameter(app, "app");
        Intrinsics.checkNotNullParameter(response, "response");
        if (app instanceof ApprovedAPIConnection) {
            String packageName = app.getAppInfo().getPackageName();
            Intrinsics.checkNotNullExpressionValue(packageName, "getPackageName(...)");
            sendSuccessResponse(packageName, response, ((ApprovedAPIConnection) app).getEncryptionKey());
        }
    }

    @Override // com.wickr.enterprise.api.WickrAPIContext
    public void sendError(WickrAPIConnection app, String identifier, WickrAPIObjects.APIError error) {
        Intrinsics.checkNotNullParameter(app, "app");
        Intrinsics.checkNotNullParameter(identifier, "identifier");
        Intrinsics.checkNotNullParameter(error, "error");
        String packageName = app.getAppInfo().getPackageName();
        Intrinsics.checkNotNullExpressionValue(packageName, "getPackageName(...)");
        sendErrorResponse(packageName, identifier, error);
    }

    /* JADX INFO: Access modifiers changed from: private */
    public final void sendPairingResponse(String packageName, WickrAPIResponses.WickrAPIResponse response) {
        if (!getAuthHandler().isAllowed(packageName)) {
            Timber.INSTANCE.e("App " + packageName + " is no longer authorized", new Object[0]);
            return;
        }
        Timber.INSTANCE.i("Sending pairing response " + response.getResponseCase().name() + " to " + packageName, new Object[0]);
        Intent intent = new Intent();
        intent.setPackage(packageName);
        intent.setAction(WickrAPI.INTENT_ACTION_RESPONSE);
        intent.putExtra(WickrAPI.EXTRA_PAIRING_RESPONSE, response.toByteArray());
        getContext().sendBroadcast(intent);
    }

    /* JADX INFO: Access modifiers changed from: private */
    public final void sendSuccessResponse(String packageName, WickrAPIResponses.WickrAPIResponse response, byte[] key) {
        if (!getAuthHandler().isAllowed(packageName)) {
            Timber.INSTANCE.e("App " + packageName + " is no longer authorized", new Object[0]);
            return;
        }
        Timber.INSTANCE.d("Sending success response " + response.getResponseCase().name() + " to " + packageName, new Object[0]);
        try {
            WickrAPI wickrAPI = WickrAPI.INSTANCE;
            byte[] byteArray = response.toByteArray();
            Intrinsics.checkNotNullExpressionValue(byteArray, "toByteArray(...)");
            byte[] bArrEncryptData = wickrAPI.encryptData(byteArray, key);
            Intent intent = new Intent();
            intent.setPackage(packageName);
            intent.setAction(WickrAPI.INTENT_ACTION_RESPONSE);
            intent.putExtra(WickrAPI.EXTRA_API_RESPONSE, bArrEncryptData);
            getContext().sendBroadcast(intent);
        } catch (Exception e) {
            Timber.INSTANCE.e(e);
            Timber.INSTANCE.e("Unable to encrypt API response", new Object[0]);
            String identifier = response.getIdentifier();
            Intrinsics.checkNotNullExpressionValue(identifier, "getIdentifier(...)");
            sendErrorResponse(packageName, identifier, WickrAPIObjects.APIError.FAILED_ENCRYPTION);
        }
    }

    /* JADX INFO: Access modifiers changed from: private */
    public final void sendErrorResponse(String packageName, String identifier, WickrAPIObjects.APIError error) {
        WickrAPIResponses.WickrAPIResponse wickrAPIResponseBuild = WickrAPIResponses.WickrAPIResponse.newBuilder().setIdentifier(identifier).setErrorResponse(WickrAPIResponses.ErrorResponse.newBuilder().setError(error).build()).build();
        Intrinsics.checkNotNull(wickrAPIResponseBuild);
        sendErrorResponse(packageName, wickrAPIResponseBuild);
    }

    private final void sendErrorResponse(String packageName, WickrAPIResponses.WickrAPIResponse response) {
        if (!getAuthHandler().isAllowed(packageName)) {
            Timber.INSTANCE.e("App " + packageName + " is no longer authorized", new Object[0]);
            return;
        }
        Timber.INSTANCE.e("Sending error response " + response.getErrorResponse().getError().name() + " to " + packageName, new Object[0]);
        Intent intent = new Intent();
        intent.setPackage(packageName);
        intent.setAction(WickrAPI.INTENT_ACTION_RESPONSE);
        intent.putExtra(WickrAPI.EXTRA_API_ERROR, response.toByteArray());
        getContext().sendBroadcast(intent);
    }

    /* JADX INFO: Access modifiers changed from: private */
    public final boolean needsLogin(SessionManager sessionManager) {
        Session activeSession;
        ConvoRepository convoRepository;
        Session activeSession2;
        Session activeSession3;
        SwitchboardConnection switchboard;
        return !WickrDBAdapter.doesDBExist(getContext()) || !sessionManager.isLoggedIn() || (activeSession = sessionManager.getActiveSession()) == null || (convoRepository = activeSession.getConvoRepository()) == null || !convoRepository.isInitialized() || (activeSession2 = sessionManager.getActiveSession()) == null || !activeSession2.getCompletedServerLogin() || (activeSession3 = sessionManager.getActiveSession()) == null || (switchboard = activeSession3.getSwitchboard()) == null || !switchboard.isConnected();
    }

    /* JADX INFO: Access modifiers changed from: private */
    public final boolean loginIfNecessary(SessionManager sessionManager) {
        try {
            if (!WickrDBAdapter.doesDBExist(getContext())) {
                Timber.INSTANCE.e("Cannot process API request, user is not registered", new Object[0]);
                return false;
            }
            if (!sessionManager.isLoggedIn() && sessionManager.isSessionCached()) {
                Timber.INSTANCE.i("Attempting to log in", new Object[0]);
                sessionManager.restoreCachedSession();
            }
            if (!sessionManager.isLoggedIn()) {
                Timber.INSTANCE.e("Cannot process API request, unable to log into cached session", new Object[0]);
                return false;
            }
            if (MigrationHelper.needsMigration(getContext())) {
                Timber.INSTANCE.i("Running login migrations", new Object[0]);
                MigrationHelper.performMigrations(getContext());
            }
            WickrUser.getUserCacheList(true);
            Session activeSession = sessionManager.getActiveSession();
            Intrinsics.checkNotNull(activeSession);
            ConvoRepository convoRepository = activeSession.getConvoRepository();
            if (!convoRepository.isInitialized()) {
                convoRepository.refreshFromDatabase().blockingAwait();
            }
            Timber.INSTANCE.i("Performing background login", new Object[0]);
            LoginResult loginResultBlockingGet = activeSession.getLoginManager().login(new LoginDetails(null, false, false, false, false, false, null, null, null, 511, null)).blockingGet();
            Intrinsics.checkNotNullExpressionValue(loginResultBlockingGet, "blockingGet(...)");
            LoginResult loginResult = loginResultBlockingGet;
            if (!loginResult.getSuccess()) {
                Timber.INSTANCE.w("Unable to perform network login: NetworkError: " + loginResult.getNetworkError() + ", ApiCode: " + loginResult.getApiCode(), new Object[0]);
                if (!loginResult.getNetworkError()) {
                    return false;
                }
            }
            return true;
        } catch (Exception e) {
            Exception exc = e;
            WickrBugReporter.report$default(exc, null, null, 6, null);
            Timber.INSTANCE.e(exc);
            return false;
        }
    }

    /* JADX INFO: Access modifiers changed from: private */
    public final byte[] generateEncryptionKey() throws NoSuchAlgorithmException {
        KeyGenerator keyGenerator = KeyGenerator.getInstance("AES");
        keyGenerator.init(256, SecureRandom.getInstanceStrong());
        byte[] encoded = keyGenerator.generateKey().getEncoded();
        Intrinsics.checkNotNullExpressionValue(encoded, "getEncoded(...)");
        return encoded;
    }

    @Override // com.wickr.enterprise.api.WickrAPIContext
    public WickrUserInterface getUser(String userID) {
        Intrinsics.checkNotNullParameter(userID, "userID");
        return WickrUser.getUserWithServerIDHash(userID);
    }

    @Override // com.wickr.enterprise.api.WickrAPIContext
    public Bitmap decodeBitmap(byte[] bytes) {
        Intrinsics.checkNotNullParameter(bytes, "bytes");
        if (bytes.length == 0) {
            return null;
        }
        try {
            return BitmapFactory.decodeByteArray(bytes, 0, bytes.length);
        } catch (Exception unused) {
            return null;
        }
    }

    @Override // com.wickr.enterprise.api.WickrAPIContext
    public boolean compressBitmap(Bitmap bitmap, Bitmap.CompressFormat format, int quality, ByteArrayOutputStream stream) {
        Intrinsics.checkNotNullParameter(bitmap, "bitmap");
        Intrinsics.checkNotNullParameter(format, "format");
        Intrinsics.checkNotNullParameter(stream, "stream");
        try {
            return bitmap.compress(format, quality, stream);
        } catch (Exception unused) {
            return false;
        }
    }

    @Subscribe
    public final void onAppEvent(Object event) {
        Intrinsics.checkNotNullParameter(event, "event");
        Timber.INSTANCE.d("Received event: " + event.getClass(), new Object[0]);
        if (!getAuthHandler().isEnabled()) {
            Timber.INSTANCE.d("Ignoring event because API is not enabled", new Object[0]);
        } else {
            this.threadExecutor.launch(new C05421(event, null));
        }
    }

    /* JADX INFO: renamed from: com.wickr.enterprise.api.WickrAPIManager$onAppEvent$1, reason: invalid class name and case insensitive filesystem */
    /* JADX INFO: compiled from: WickrAPIManager.kt */
    @Metadata(d1 = {"\u0000\u0006\n\u0000\n\u0002\u0010\u0002\u0010\u0000\u001a\u00020\u0001H\n"}, d2 = {"<anonymous>", ""}, k = 3, mv = {2, 2, 0}, xi = 48)
    @DebugMetadata(c = "com.wickr.enterprise.api.WickrAPIManager$onAppEvent$1", f = "WickrAPIManager.kt", i = {}, l = {727}, m = "invokeSuspend", n = {}, s = {}, v = 1)
    static final class C05421 extends SuspendLambda implements Function1<Continuation<? super Unit>, Object> {
        final /* synthetic */ Object $event;
        int label;

        /* JADX WARN: 'super' call moved to the top of the method (can break code semantics) */
        C05421(Object obj, Continuation<? super C05421> continuation) {
            super(1, continuation);
            this.$event = obj;
        }

        @Override // kotlin.coroutines.jvm.internal.BaseContinuationImpl
        public final Continuation<Unit> create(Continuation<?> continuation) {
            return WickrAPIManager.this.new C05421(this.$event, continuation);
        }

        @Override // kotlin.jvm.functions.Function1
        public final Object invoke(Continuation<? super Unit> continuation) {
            return ((C05421) create(continuation)).invokeSuspend(Unit.INSTANCE);
        }

        @Override // kotlin.coroutines.jvm.internal.BaseContinuationImpl
        public final Object invokeSuspend(Object obj) {
            Object coroutine_suspended = IntrinsicsKt.getCOROUTINE_SUSPENDED();
            int i = this.label;
            if (i == 0) {
                ResultKt.throwOnFailure(obj);
                if (!WickrAPIManager.this.sessionManager.isLoggedIn()) {
                    Timber.INSTANCE.d("Ignoring event because session is not logged in", new Object[0]);
                    return Unit.INSTANCE;
                }
                Object obj2 = this.$event;
                if (!(obj2 instanceof WickrAPIEvent)) {
                    this.label = 1;
                    if (WickrAPIManager.this.moduleManager.processEvent(this.$event, this) == coroutine_suspended) {
                        return coroutine_suspended;
                    }
                } else {
                    if (((WickrAPIEvent) obj2) instanceof WickrAPIEvent.ConnectionUpdated) {
                        Timber.INSTANCE.i("API Connections were updated", new Object[0]);
                    } else {
                        Timber.INSTANCE.i("Ignoring API event: " + this.$event.getClass().getSimpleName(), new Object[0]);
                    }
                    Unit unit = Unit.INSTANCE;
                }
            } else {
                if (i != 1) {
                    throw new IllegalStateException("call to 'resume' before 'invoke' with coroutine");
                }
                ResultKt.throwOnFailure(obj);
            }
            return Unit.INSTANCE;
        }
    }

    public final void approveWickrAPIConnection(PendingAPIConnection app) {
        Intrinsics.checkNotNullParameter(app, "app");
        if (!getAuthHandler().isEnabled()) {
            Timber.INSTANCE.e("API is not enabled", new Object[0]);
            return;
        }
        WickrAPIAuthHandler authHandler = getAuthHandler();
        String packageName = app.getAppInfo().getPackageName();
        Intrinsics.checkNotNullExpressionValue(packageName, "getPackageName(...)");
        if (!authHandler.isAllowed(packageName)) {
            Timber.INSTANCE.e("Package " + app.getAppInfo().getPackageName() + " is not authorized", new Object[0]);
            return;
        }
        this.threadExecutor.launch(new AnonymousClass1(app, this, null));
    }

    /* JADX INFO: renamed from: com.wickr.enterprise.api.WickrAPIManager$approveWickrAPIConnection$1, reason: invalid class name */
    /* JADX INFO: compiled from: WickrAPIManager.kt */
    @Metadata(d1 = {"\u0000\u0006\n\u0000\n\u0002\u0010\u0002\u0010\u0000\u001a\u00020\u0001H\n"}, d2 = {"<anonymous>", ""}, k = 3, mv = {2, 2, 0}, xi = 48)
    @DebugMetadata(c = "com.wickr.enterprise.api.WickrAPIManager$approveWickrAPIConnection$1", f = "WickrAPIManager.kt", i = {}, l = {}, m = "invokeSuspend", n = {}, s = {}, v = 1)
    static final class AnonymousClass1 extends SuspendLambda implements Function1<Continuation<? super Unit>, Object> {
        final /* synthetic */ PendingAPIConnection $app;
        int label;
        final /* synthetic */ WickrAPIManager this$0;

        /* JADX WARN: 'super' call moved to the top of the method (can break code semantics) */
        AnonymousClass1(PendingAPIConnection pendingAPIConnection, WickrAPIManager wickrAPIManager, Continuation<? super AnonymousClass1> continuation) {
            super(1, continuation);
            this.$app = pendingAPIConnection;
            this.this$0 = wickrAPIManager;
        }

        @Override // kotlin.coroutines.jvm.internal.BaseContinuationImpl
        public final Continuation<Unit> create(Continuation<?> continuation) {
            return new AnonymousClass1(this.$app, this.this$0, continuation);
        }

        @Override // kotlin.jvm.functions.Function1
        public final Object invoke(Continuation<? super Unit> continuation) {
            return ((AnonymousClass1) create(continuation)).invokeSuspend(Unit.INSTANCE);
        }

        @Override // kotlin.coroutines.jvm.internal.BaseContinuationImpl
        public final Object invokeSuspend(Object obj) throws NoSuchAlgorithmException {
            IntrinsicsKt.getCOROUTINE_SUSPENDED();
            if (this.label != 0) {
                throw new IllegalStateException("call to 'resume' before 'invoke' with coroutine");
            }
            ResultKt.throwOnFailure(obj);
            if (this.$app.getPendingEncryptionKey() != null) {
                Timber.INSTANCE.e("Ignoring unexpected connection approved event", new Object[0]);
                return Unit.INSTANCE;
            }
            String packageName = this.$app.getAppInfo().getPackageName();
            String first = this.$app.getPairingRequest().getFirst();
            Timber.INSTANCE.i("Processing user API approval action for " + packageName, new Object[0]);
            byte[] bArrGenerateEncryptionKey = this.this$0.generateEncryptionKey();
            if (bArrGenerateEncryptionKey == null) {
                Timber.INSTANCE.e("Unable to generate encryption key for " + packageName, new Object[0]);
                WickrAPIManager wickrAPIManager = this.this$0;
                Intrinsics.checkNotNull(packageName);
                wickrAPIManager.sendErrorResponse(packageName, first, WickrAPIObjects.APIError.INTERNAL_ERROR);
                return Unit.INSTANCE;
            }
            WickrAPIAuthHandler authHandler = this.this$0.getAuthHandler();
            Intrinsics.checkNotNull(packageName);
            if (!authHandler.isAllowed(packageName)) {
                Timber.INSTANCE.e("App " + packageName + " is no longer allowed", new Object[0]);
                return Unit.INSTANCE;
            }
            Timber.INSTANCE.i("Sending pairing response to " + packageName, new Object[0]);
            WickrAPIResponses.WickrAPIResponse wickrAPIResponseBuild = WickrAPIResponses.WickrAPIResponse.newBuilder().setIdentifier(first).setPairingResponse(WickrAPIResponses.PairingResponse.newBuilder().setEncryptionKey(ByteString.copyFrom(bArrGenerateEncryptionKey)).build()).build();
            WickrAPIManager wickrAPIManager2 = this.this$0;
            Intrinsics.checkNotNull(wickrAPIResponseBuild);
            wickrAPIManager2.sendPairingResponse(packageName, wickrAPIResponseBuild);
            Timber.INSTANCE.i("Updating " + packageName + " pending connection with encryption key", new Object[0]);
            this.$app.setPendingEncryptionKey(bArrGenerateEncryptionKey);
            this.this$0.getConnectionManager().addPendingConnection(this.$app);
            return Unit.INSTANCE;
        }
    }

    /* JADX INFO: renamed from: com.wickr.enterprise.api.WickrAPIManager$removeWickrAPIConnection$1, reason: invalid class name and case insensitive filesystem */
    /* JADX INFO: compiled from: WickrAPIManager.kt */
    @Metadata(d1 = {"\u0000\u0006\n\u0000\n\u0002\u0010\u0002\u0010\u0000\u001a\u00020\u0001H\n"}, d2 = {"<anonymous>", ""}, k = 3, mv = {2, 2, 0}, xi = 48)
    @DebugMetadata(c = "com.wickr.enterprise.api.WickrAPIManager$removeWickrAPIConnection$1", f = "WickrAPIManager.kt", i = {}, l = {}, m = "invokeSuspend", n = {}, s = {}, v = 1)
    static final class C05431 extends SuspendLambda implements Function1<Continuation<? super Unit>, Object> {
        final /* synthetic */ WickrAPIConnection $app;
        int label;
        final /* synthetic */ WickrAPIManager this$0;

        /* JADX WARN: 'super' call moved to the top of the method (can break code semantics) */
        C05431(WickrAPIConnection wickrAPIConnection, WickrAPIManager wickrAPIManager, Continuation<? super C05431> continuation) {
            super(1, continuation);
            this.$app = wickrAPIConnection;
            this.this$0 = wickrAPIManager;
        }

        @Override // kotlin.coroutines.jvm.internal.BaseContinuationImpl
        public final Continuation<Unit> create(Continuation<?> continuation) {
            return new C05431(this.$app, this.this$0, continuation);
        }

        @Override // kotlin.jvm.functions.Function1
        public final Object invoke(Continuation<? super Unit> continuation) {
            return ((C05431) create(continuation)).invokeSuspend(Unit.INSTANCE);
        }

        @Override // kotlin.coroutines.jvm.internal.BaseContinuationImpl
        public final Object invokeSuspend(Object obj) {
            IntrinsicsKt.getCOROUTINE_SUSPENDED();
            if (this.label != 0) {
                throw new IllegalStateException("call to 'resume' before 'invoke' with coroutine");
            }
            ResultKt.throwOnFailure(obj);
            Timber.INSTANCE.i("Removing app and sending pairing rejection to " + this.$app.getAppInfo().getPackageName(), new Object[0]);
            WickrAPIConnection wickrAPIConnection = this.$app;
            if (wickrAPIConnection instanceof PendingAPIConnection) {
                this.this$0.getConnectionManager().removePendingConnection((PendingAPIConnection) this.$app);
            } else {
                if (!(wickrAPIConnection instanceof ApprovedAPIConnection)) {
                    throw new NoWhenBranchMatchedException();
                }
                this.this$0.getConnectionManager().deleteConnection((ApprovedAPIConnection) this.$app);
            }
            WickrAPIAuthHandler authHandler = this.this$0.getAuthHandler();
            String packageName = this.$app.getAppInfo().getPackageName();
            Intrinsics.checkNotNullExpressionValue(packageName, "getPackageName(...)");
            if (!authHandler.isAllowed(packageName)) {
                Timber.INSTANCE.e("App " + this.$app.getAppInfo().getPackageName() + " is no longer allowed", new Object[0]);
                return Unit.INSTANCE;
            }
            WickrAPIResponses.WickrAPIResponse wickrAPIResponseBuild = WickrAPIResponses.WickrAPIResponse.newBuilder().setIdentifier(this.$app.getAppInfo().getPackageName()).setPairingDenialResponse(WickrAPIResponses.PairingDenialResponse.newBuilder().build()).build();
            WickrAPIManager wickrAPIManager = this.this$0;
            String packageName2 = this.$app.getAppInfo().getPackageName();
            Intrinsics.checkNotNullExpressionValue(packageName2, "getPackageName(...)");
            Intrinsics.checkNotNull(wickrAPIResponseBuild);
            wickrAPIManager.sendPairingResponse(packageName2, wickrAPIResponseBuild);
            return Unit.INSTANCE;
        }
    }

    public final void removeWickrAPIConnection(WickrAPIConnection app) {
        Intrinsics.checkNotNullParameter(app, "app");
        this.threadExecutor.launch(new C05431(app, this, null));
    }
}
