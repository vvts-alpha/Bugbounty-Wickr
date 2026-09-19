package com.wickr.enterprise.api.modules;

import androidx.core.app.NotificationCompat;
import com.wickr.android.api.WickrAPIObjects;
import com.wickr.android.api.WickrAPIRequests;
import com.wickr.enterprise.api.APIUtilsKt;
import com.wickr.enterprise.api.WickrAPIContext;
import com.wickr.enterprise.api.connections.WickrAPIConnection;
import com.wickr.session.Session;
import io.sentry.SentryBaseEvent;
import io.sentry.SentryEvent;
import io.sentry.cache.EnvelopeCache;
import io.sentry.protocol.App;
import java.util.HashMap;
import kotlin.Metadata;
import kotlin.ResultKt;
import kotlin.coroutines.Continuation;
import kotlin.coroutines.intrinsics.IntrinsicsKt;
import kotlin.coroutines.jvm.internal.ContinuationImpl;
import kotlin.coroutines.jvm.internal.DebugMetadata;
import kotlin.coroutines.jvm.internal.SpillingKt;
import kotlin.jvm.internal.Intrinsics;
import timber.log.Timber;

/* JADX INFO: compiled from: WickrAPIModuleManager.kt */
/* JADX INFO: loaded from: classes4.dex */
@Metadata(d1 = {"\u0000L\n\u0002\u0018\u0002\n\u0002\u0010\u0000\n\u0002\b\u0003\n\u0002\u0018\u0002\n\u0002\u0010\u000e\n\u0002\u0018\u0002\n\u0002\u0018\u0002\n\u0000\n\u0002\u0010\u000b\n\u0000\n\u0002\u0010\u0002\n\u0000\n\u0002\u0018\u0002\n\u0000\n\u0002\u0018\u0002\n\u0002\b\u0006\n\u0002\u0018\u0002\n\u0000\n\u0002\u0018\u0002\n\u0000\n\u0002\u0018\u0002\n\u0002\b\u0005\b'\u0018\u00002\u00020\u0001B\u0007¢\u0006\u0004\b\u0002\u0010\u0003J\u0006\u0010\t\u001a\u00020\nJ\u0016\u0010\u000b\u001a\u00020\f2\u0006\u0010\r\u001a\u00020\u000e2\u0006\u0010\u000f\u001a\u00020\u0010J\u0018\u0010\u0011\u001a\u00020\f2\u0006\u0010\r\u001a\u00020\u000e2\u0006\u0010\u000f\u001a\u00020\u0010H&J\u0010\u0010\u0012\u001a\u00020\n2\u0006\u0010\u0013\u001a\u00020\u0006H\u0002J\u000e\u0010\u0014\u001a\u00020\n2\u0006\u0010\u0015\u001a\u00020\u0007J \u0010\u0016\u001a\u0004\u0018\u00010\u00172\u0006\u0010\u0018\u001a\u00020\u00192\u0006\u0010\u001a\u001a\u00020\u001bH\u0086@¢\u0006\u0002\u0010\u001cJ\u0016\u0010\u001d\u001a\u00020\n2\u0006\u0010\u001e\u001a\u00020\u0001H\u0086@¢\u0006\u0002\u0010\u001fR*\u0010\u0004\u001a\u001e\u0012\u0004\u0012\u00020\u0006\u0012\u0004\u0012\u00020\u00070\u0005j\u000e\u0012\u0004\u0012\u00020\u0006\u0012\u0004\u0012\u00020\u0007`\bX\u0082\u0004¢\u0006\u0002\n\u0000R\u000e\u0010\t\u001a\u00020\nX\u0082\u000e¢\u0006\u0002\n\u0000¨\u0006 "}, d2 = {"Lcom/wickr/enterprise/api/modules/WickrAPIModuleManager;", "", "<init>", "()V", SentryEvent.JsonKeys.MODULES, "Ljava/util/HashMap;", "", "Lcom/wickr/enterprise/api/modules/WickrAPIModule;", "Lkotlin/collections/HashMap;", "isInitialized", "", "initializeInternal", "", "apiContext", "Lcom/wickr/enterprise/api/WickrAPIContext;", EnvelopeCache.PREFIX_CURRENT_SESSION_FILE, "Lcom/wickr/session/Session;", "initialize", "isRegistered", "requestClassName", "register", "module", "processRequest", "Lcom/wickr/android/api/WickrAPIObjects$APIError;", App.TYPE, "Lcom/wickr/enterprise/api/connections/WickrAPIConnection;", SentryBaseEvent.JsonKeys.REQUEST, "Lcom/wickr/android/api/WickrAPIRequests$WickrAPIRequest;", "(Lcom/wickr/enterprise/api/connections/WickrAPIConnection;Lcom/wickr/android/api/WickrAPIRequests$WickrAPIRequest;Lkotlin/coroutines/Continuation;)Ljava/lang/Object;", "processEvent", NotificationCompat.CATEGORY_EVENT, "(Ljava/lang/Object;Lkotlin/coroutines/Continuation;)Ljava/lang/Object;", "app_awsRelease"}, k = 1, mv = {2, 2, 0}, xi = 48)
public abstract class WickrAPIModuleManager {
    public static final int $stable = 8;
    private boolean isInitialized;
    private final HashMap<String, WickrAPIModule> modules = new HashMap<>();

    /* JADX INFO: renamed from: com.wickr.enterprise.api.modules.WickrAPIModuleManager$processEvent$1, reason: invalid class name */
    /* JADX INFO: compiled from: WickrAPIModuleManager.kt */
    @Metadata(k = 3, mv = {2, 2, 0}, xi = 48)
    @DebugMetadata(c = "com.wickr.enterprise.api.modules.WickrAPIModuleManager", f = "WickrAPIModuleManager.kt", i = {0, 0, 0, 0}, l = {83}, m = "processEvent", n = {NotificationCompat.CATEGORY_EVENT, "eventClass", "module", "processedEvent"}, s = {"L$0", "L$1", "L$3", "I$0"}, v = 1)
    static final class AnonymousClass1 extends ContinuationImpl {
        int I$0;
        Object L$0;
        Object L$1;
        Object L$2;
        Object L$3;
        int label;
        /* synthetic */ Object result;

        AnonymousClass1(Continuation<? super AnonymousClass1> continuation) {
            super(continuation);
        }

        @Override // kotlin.coroutines.jvm.internal.BaseContinuationImpl
        public final Object invokeSuspend(Object obj) {
            this.result = obj;
            this.label |= Integer.MIN_VALUE;
            return WickrAPIModuleManager.this.processEvent(null, this);
        }
    }

    /* JADX INFO: renamed from: com.wickr.enterprise.api.modules.WickrAPIModuleManager$processRequest$1, reason: invalid class name and case insensitive filesystem */
    /* JADX INFO: compiled from: WickrAPIModuleManager.kt */
    @Metadata(k = 3, mv = {2, 2, 0}, xi = 48)
    @DebugMetadata(c = "com.wickr.enterprise.api.modules.WickrAPIModuleManager", f = "WickrAPIModuleManager.kt", i = {0, 0, 0}, l = {63}, m = "processRequest", n = {App.TYPE, SentryBaseEvent.JsonKeys.REQUEST, "module"}, s = {"L$0", "L$1", "L$2"}, v = 1)
    static final class C05441 extends ContinuationImpl {
        Object L$0;
        Object L$1;
        Object L$2;
        int label;
        /* synthetic */ Object result;

        C05441(Continuation<? super C05441> continuation) {
            super(continuation);
        }

        @Override // kotlin.coroutines.jvm.internal.BaseContinuationImpl
        public final Object invokeSuspend(Object obj) {
            this.result = obj;
            this.label |= Integer.MIN_VALUE;
            return WickrAPIModuleManager.this.processRequest(null, null, this);
        }
    }

    public abstract void initialize(WickrAPIContext apiContext, Session session);

    /* JADX INFO: renamed from: isInitialized, reason: from getter */
    public final boolean getIsInitialized() {
        return this.isInitialized;
    }

    public final void initializeInternal(WickrAPIContext apiContext, Session session) {
        Intrinsics.checkNotNullParameter(apiContext, "apiContext");
        Intrinsics.checkNotNullParameter(session, "session");
        if (getIsInitialized()) {
            return;
        }
        Timber.INSTANCE.i("Initializing module manager " + getClass().getSimpleName(), new Object[0]);
        initialize(apiContext, session);
        this.isInitialized = true;
    }

    private final boolean isRegistered(String requestClassName) {
        return this.modules.containsKey(requestClassName);
    }

    public final boolean register(WickrAPIModule module) {
        Intrinsics.checkNotNullParameter(module, "module");
        if (this.modules.containsValue(module)) {
            Timber.INSTANCE.e("Module " + APIUtilsKt.getClassName(module) + " is already registered", new Object[0]);
            return false;
        }
        for (String str : module.getRequests()) {
            if (isRegistered(str)) {
                WickrAPIModule wickrAPIModule = this.modules.get(str);
                Intrinsics.checkNotNull(wickrAPIModule);
                Timber.INSTANCE.e("Unable to register module " + APIUtilsKt.getClassName(module) + ": request " + str + " is already registered to module " + APIUtilsKt.getClassName(wickrAPIModule), new Object[0]);
                return false;
            }
        }
        Timber.INSTANCE.i("Registering API module: " + APIUtilsKt.getClassName(module), new Object[0]);
        for (String str2 : module.getRequests()) {
            Timber.INSTANCE.i("Registering module for request: " + str2, new Object[0]);
            this.modules.put(str2, module);
        }
        return true;
    }

    /* JADX WARN: Code duplicated, block: B:7:0x0014  */
    public final Object processRequest(WickrAPIConnection wickrAPIConnection, WickrAPIRequests.WickrAPIRequest wickrAPIRequest, Continuation<? super WickrAPIObjects.APIError> continuation) throws Throwable {
        C05441 c05441;
        WickrAPIModule wickrAPIModule;
        if (continuation instanceof C05441) {
            c05441 = (C05441) continuation;
            if ((c05441.label & Integer.MIN_VALUE) != 0) {
                c05441.label -= Integer.MIN_VALUE;
            } else {
                c05441 = new C05441(continuation);
            }
        } else {
            c05441 = new C05441(continuation);
        }
        Object objProcessRequest = c05441.result;
        Object coroutine_suspended = IntrinsicsKt.getCOROUTINE_SUSPENDED();
        int i = c05441.label;
        if (i == 0) {
            ResultKt.throwOnFailure(objProcessRequest);
            wickrAPIModule = this.modules.get(wickrAPIRequest.getRequestCase().name());
            if (wickrAPIModule == null) {
                Timber.INSTANCE.e("There is no module available to process request " + wickrAPIRequest.getRequestCase().name(), new Object[0]);
                return WickrAPIObjects.APIError.INVALID_REQUEST;
            }
            c05441.L$0 = SpillingKt.nullOutSpilledVariable(wickrAPIConnection);
            c05441.L$1 = wickrAPIRequest;
            c05441.L$2 = wickrAPIModule;
            c05441.label = 1;
            objProcessRequest = wickrAPIModule.processRequest(wickrAPIConnection, wickrAPIRequest, c05441);
            if (objProcessRequest == coroutine_suspended) {
                return coroutine_suspended;
            }
        } else {
            if (i != 1) {
                throw new IllegalStateException("call to 'resume' before 'invoke' with coroutine");
            }
            wickrAPIModule = (WickrAPIModule) c05441.L$2;
            wickrAPIRequest = (WickrAPIRequests.WickrAPIRequest) c05441.L$1;
            ResultKt.throwOnFailure(objProcessRequest);
        }
        WickrAPIObjects.APIError aPIError = (WickrAPIObjects.APIError) objProcessRequest;
        if (aPIError != null) {
            Timber.INSTANCE.e("Module " + APIUtilsKt.getClassName(wickrAPIModule) + " was unable to process request " + wickrAPIRequest.getRequestCase().name(), new Object[0]);
            return aPIError;
        }
        Timber.INSTANCE.i("Module " + APIUtilsKt.getClassName(wickrAPIModule) + " successfully processed request " + wickrAPIRequest.getRequestCase().name(), new Object[0]);
        return null;
    }

    /* JADX WARN: Code duplicated, block: B:21:0x006f  */
    /* JADX WARN: Code duplicated, block: B:25:0x00be A[RETURN] */
    /* JADX WARN: Code duplicated, block: B:30:0x0084 A[SYNTHETIC] */
    /* JADX WARN: Code duplicated, block: B:32:? A[LOOP:0: B:19:0x0069->B:32:?, LOOP_END, SYNTHETIC] */
    /* JADX WARN: Code duplicated, block: B:7:0x0014  */
    /* JADX WARN: Type inference failed for: r2v2 */
    /* JADX WARN: Type inference failed for: r2v3, types: [boolean, int] */
    /* JADX WARN: Type inference failed for: r2v5 */
    /* JADX WARN: Unsupported multi-entry loop pattern (BACK_EDGE: B:24:0x00bc -> B:26:0x00bf). Please report as a decompilation issue!!! */
    /*  JADX ERROR: StackOverflowError in pass: RegionMakerVisitor
        java.lang.StackOverflowError
        	at jadx.core.utils.BlockUtils.traverseSuccessorsUntil(BlockUtils.java:731)
        	at jadx.core.utils.BlockUtils.traverseSuccessorsUntil(BlockUtils.java:749)
        */
    public final java.lang.Object processEvent(java.lang.Object r11, kotlin.coroutines.Continuation<? super java.lang.Boolean> r12) {
        /*
            r10 = this;
            boolean r0 = r12 instanceof com.wickr.enterprise.api.modules.WickrAPIModuleManager.AnonymousClass1
            if (r0 == 0) goto L14
            r0 = r12
            com.wickr.enterprise.api.modules.WickrAPIModuleManager$processEvent$1 r0 = (com.wickr.enterprise.api.modules.WickrAPIModuleManager.AnonymousClass1) r0
            int r1 = r0.label
            r2 = -2147483648(0xffffffff80000000, float:-0.0)
            r1 = r1 & r2
            if (r1 == 0) goto L14
            int r12 = r0.label
            int r12 = r12 - r2
            r0.label = r12
            goto L19
        L14:
            com.wickr.enterprise.api.modules.WickrAPIModuleManager$processEvent$1 r0 = new com.wickr.enterprise.api.modules.WickrAPIModuleManager$processEvent$1
            r0.<init>(r12)
        L19:
            java.lang.Object r12 = r0.result
            java.lang.Object r1 = kotlin.coroutines.intrinsics.IntrinsicsKt.getCOROUTINE_SUSPENDED()
            int r2 = r0.label
            r3 = 0
            r4 = 1
            if (r2 == 0) goto L45
            if (r2 != r4) goto L3d
            int r10 = r0.I$0
            java.lang.Object r10 = r0.L$3
            com.wickr.enterprise.api.modules.WickrAPIModule r10 = (com.wickr.enterprise.api.modules.WickrAPIModule) r10
            java.lang.Object r10 = r0.L$2
            java.util.Iterator r10 = (java.util.Iterator) r10
            java.lang.Object r11 = r0.L$1
            java.lang.String r11 = (java.lang.String) r11
            java.lang.Object r2 = r0.L$0
            kotlin.ResultKt.throwOnFailure(r12)
            r12 = r2
            goto Lbf
        L3d:
            java.lang.IllegalStateException r10 = new java.lang.IllegalStateException
            java.lang.String r11 = "call to 'resume' before 'invoke' with coroutine"
            r10.<init>(r11)
            throw r10
        L45:
            kotlin.ResultKt.throwOnFailure(r12)
            boolean r12 = r10.getIsInitialized()
            if (r12 != 0) goto L53
            java.lang.Boolean r10 = kotlin.coroutines.jvm.internal.Boxing.boxBoolean(r3)
            return r10
        L53:
            java.lang.Class r12 = r11.getClass()
            java.lang.String r12 = r12.getName()
            java.util.HashMap<java.lang.String, com.wickr.enterprise.api.modules.WickrAPIModule> r10 = r10.modules
            java.util.Collection r10 = r10.values()
            java.util.Iterator r10 = r10.iterator()
            r2 = r12
            r12 = r11
            r11 = r2
            r2 = r3
        L69:
            boolean r5 = r10.hasNext()
            if (r5 == 0) goto Lc1
            java.lang.Object r5 = r10.next()
            java.lang.String r6 = "next(...)"
            kotlin.jvm.internal.Intrinsics.checkNotNullExpressionValue(r5, r6)
            com.wickr.enterprise.api.modules.WickrAPIModule r5 = (com.wickr.enterprise.api.modules.WickrAPIModule) r5
            java.util.List r6 = r5.getEvents()
            boolean r6 = r6.contains(r11)
            if (r6 == 0) goto L69
            timber.log.Timber$Forest r6 = timber.log.Timber.INSTANCE
            java.lang.String r7 = com.wickr.enterprise.api.APIUtilsKt.getClassName(r5)
            java.lang.StringBuilder r8 = new java.lang.StringBuilder
            java.lang.String r9 = "Forwarding event "
            r8.<init>(r9)
            java.lang.StringBuilder r8 = r8.append(r11)
            java.lang.String r9 = " to module "
            java.lang.StringBuilder r8 = r8.append(r9)
            java.lang.StringBuilder r7 = r8.append(r7)
            java.lang.String r7 = r7.toString()
            java.lang.Object[] r8 = new java.lang.Object[r3]
            r6.i(r7, r8)
            r0.L$0 = r12
            r0.L$1 = r11
            r0.L$2 = r10
            java.lang.Object r6 = kotlin.coroutines.jvm.internal.SpillingKt.nullOutSpilledVariable(r5)
            r0.L$3 = r6
            r0.I$0 = r2
            r0.label = r4
            java.lang.Object r2 = r5.processEvent(r12, r0)
            if (r2 != r1) goto Lbf
            return r1
        Lbf:
            r2 = r4
            goto L69
        Lc1:
            java.lang.Boolean r10 = kotlin.coroutines.jvm.internal.Boxing.boxBoolean(r2)
            return r10
        */
        throw new UnsupportedOperationException("Method not decompiled: com.wickr.enterprise.api.modules.WickrAPIModuleManager.processEvent(java.lang.Object, kotlin.coroutines.Continuation):java.lang.Object");
    }
}
