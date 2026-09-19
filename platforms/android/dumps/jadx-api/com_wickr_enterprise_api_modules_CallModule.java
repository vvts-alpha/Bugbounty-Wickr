package com.wickr.enterprise.api.modules;

import android.content.Context;
import com.mywickr.interfaces.WickrConvoInterface;
import com.mywickr.repository.ConvoRepository;
import com.wickr.android.api.WickrAPIObjects;
import com.wickr.android.api.WickrAPIRequests;
import com.wickr.enterprise.api.WickrAPIContext;
import com.wickr.enterprise.api.connections.WickrAPIConnection;
import com.wickr.enterprise.calling.CallActivity;
import com.wickr.session.Session;
import io.sentry.SentryBaseEvent;
import io.sentry.cache.EnvelopeCache;
import io.sentry.protocol.App;
import java.util.List;
import kotlin.Metadata;
import kotlin.collections.CollectionsKt;
import kotlin.coroutines.Continuation;
import kotlin.jvm.internal.Intrinsics;
import kotlin.text.StringsKt;
import timber.log.Timber;

/* JADX INFO: compiled from: CallModule.kt */
/* JADX INFO: loaded from: classes4.dex */
@Metadata(d1 = {"\u0000@\n\u0002\u0018\u0002\n\u0002\u0018\u0002\n\u0000\n\u0002\u0018\u0002\n\u0000\n\u0002\u0018\u0002\n\u0002\b\u0003\n\u0002\u0010 \n\u0002\u0010\u000e\n\u0002\b\u0003\n\u0002\u0018\u0002\n\u0000\n\u0002\u0018\u0002\n\u0000\n\u0002\u0018\u0002\n\u0002\b\u0002\n\u0002\u0018\u0002\n\u0002\b\u0003\b\u0007\u0018\u00002\u00020\u0001B\u0017\u0012\u0006\u0010\u0002\u001a\u00020\u0003\u0012\u0006\u0010\u0004\u001a\u00020\u0005¢\u0006\u0004\b\u0006\u0010\u0007J \u0010\r\u001a\u0004\u0018\u00010\u000e2\u0006\u0010\u000f\u001a\u00020\u00102\u0006\u0010\u0011\u001a\u00020\u0012H\u0096@¢\u0006\u0002\u0010\u0013J\u0012\u0010\u0014\u001a\u0004\u0018\u00010\u000e2\u0006\u0010\u0011\u001a\u00020\u0015H\u0002J\u0012\u0010\u0016\u001a\u0004\u0018\u00010\u000e2\u0006\u0010\u0011\u001a\u00020\u0015H\u0002J\u0012\u0010\u0017\u001a\u0004\u0018\u00010\u000e2\u0006\u0010\u0011\u001a\u00020\u0015H\u0002R\u001a\u0010\b\u001a\b\u0012\u0004\u0012\u00020\n0\tX\u0096\u0004¢\u0006\b\n\u0000\u001a\u0004\b\u000b\u0010\f¨\u0006\u0018"}, d2 = {"Lcom/wickr/enterprise/api/modules/CallModule;", "Lcom/wickr/enterprise/api/modules/WickrAPIModule;", "apiContext", "Lcom/wickr/enterprise/api/WickrAPIContext;", EnvelopeCache.PREFIX_CURRENT_SESSION_FILE, "Lcom/wickr/session/Session;", "<init>", "(Lcom/wickr/enterprise/api/WickrAPIContext;Lcom/wickr/session/Session;)V", "requests", "", "", "getRequests", "()Ljava/util/List;", "processRequest", "Lcom/wickr/android/api/WickrAPIObjects$APIError;", App.TYPE, "Lcom/wickr/enterprise/api/connections/WickrAPIConnection;", SentryBaseEvent.JsonKeys.REQUEST, "Lcom/wickr/android/api/WickrAPIRequests$WickrAPIRequest;", "(Lcom/wickr/enterprise/api/connections/WickrAPIConnection;Lcom/wickr/android/api/WickrAPIRequests$WickrAPIRequest;Lkotlin/coroutines/Continuation;)Ljava/lang/Object;", "processCallStartAction", "Lcom/wickr/android/api/WickrAPIRequests$CallRequest;", "processCallJoinAction", "processCallLeaveAction", "app_awsRelease"}, k = 1, mv = {2, 2, 0}, xi = 48)
public final class CallModule extends WickrAPIModule {
    public static final int $stable = 8;
    private final List<String> requests;

    /* JADX INFO: compiled from: CallModule.kt */
    @Metadata(k = 3, mv = {2, 2, 0}, xi = 48)
    public static final /* synthetic */ class WhenMappings {
        public static final /* synthetic */ int[] $EnumSwitchMapping$0;

        static {
            int[] iArr = new int[WickrAPIRequests.CallRequest.CallAction.values().length];
            try {
                iArr[WickrAPIRequests.CallRequest.CallAction.START.ordinal()] = 1;
            } catch (NoSuchFieldError unused) {
            }
            try {
                iArr[WickrAPIRequests.CallRequest.CallAction.JOIN.ordinal()] = 2;
            } catch (NoSuchFieldError unused2) {
            }
            try {
                iArr[WickrAPIRequests.CallRequest.CallAction.LEAVE.ordinal()] = 3;
            } catch (NoSuchFieldError unused3) {
            }
            $EnumSwitchMapping$0 = iArr;
        }
    }

    /* JADX WARN: 'super' call moved to the top of the method (can break code semantics) */
    public CallModule(WickrAPIContext apiContext, Session session) {
        super(apiContext, session);
        Intrinsics.checkNotNullParameter(apiContext, "apiContext");
        Intrinsics.checkNotNullParameter(session, "session");
        this.requests = CollectionsKt.listOf("CALLREQUEST");
    }

    @Override // com.wickr.enterprise.api.modules.WickrAPIModule
    public List<String> getRequests() {
        return this.requests;
    }

    @Override // com.wickr.enterprise.api.modules.WickrAPIModule
    public Object processRequest(WickrAPIConnection wickrAPIConnection, WickrAPIRequests.WickrAPIRequest wickrAPIRequest, Continuation<? super WickrAPIObjects.APIError> continuation) {
        Timber.INSTANCE.i("Processing request " + wickrAPIRequest.getRequestCase().name(), new Object[0]);
        if (wickrAPIRequest.hasCallRequest()) {
            WickrAPIRequests.CallRequest callRequest = wickrAPIRequest.getCallRequest();
            WickrAPIRequests.CallRequest.CallAction action = callRequest.getAction();
            int i = action == null ? -1 : WhenMappings.$EnumSwitchMapping$0[action.ordinal()];
            if (i == 1) {
                Intrinsics.checkNotNull(callRequest);
                return processCallStartAction(callRequest);
            }
            if (i == 2) {
                Intrinsics.checkNotNull(callRequest);
                return processCallJoinAction(callRequest);
            }
            if (i == 3) {
                Intrinsics.checkNotNull(callRequest);
                return processCallLeaveAction(callRequest);
            }
            return WickrAPIObjects.APIError.INTERNAL_ERROR;
        }
        return WickrAPIObjects.APIError.INTERNAL_ERROR;
    }

    private final WickrAPIObjects.APIError processCallStartAction(WickrAPIRequests.CallRequest request) {
        Timber.INSTANCE.i("Processing call start action", new Object[0]);
        if (request.hasConvoID()) {
            String convoID = request.getConvoID();
            Intrinsics.checkNotNullExpressionValue(convoID, "getConvoID(...)");
            if (!StringsKt.isBlank(convoID)) {
                WickrConvoInterface wickrConvoInterface = getSession().getConvoRepository().get(request.getConvoID());
                if (wickrConvoInterface == null) {
                    Timber.INSTANCE.e("Convo does not exist", new Object[0]);
                    return WickrAPIObjects.APIError.INVALID_REQUEST;
                }
                if (wickrConvoInterface.hasOngoingCall()) {
                    Timber.INSTANCE.e("Convo already has an ongoing call", new Object[0]);
                    return WickrAPIObjects.APIError.INVALID_REQUEST;
                }
                Timber.INSTANCE.i("Starting new call for " + wickrConvoInterface.getVGroupID(), new Object[0]);
                CallActivity.Companion companion = CallActivity.INSTANCE;
                Context context = getApiContext().getContext();
                String vGroupID = wickrConvoInterface.getVGroupID();
                Intrinsics.checkNotNullExpressionValue(vGroupID, "getVGroupID(...)");
                getApiContext().getContext().startActivity(companion.intentForNewCall(context, vGroupID));
                return null;
            }
        }
        Timber.INSTANCE.e("Missing convoID", new Object[0]);
        return WickrAPIObjects.APIError.INVALID_REQUEST;
    }

    private final WickrAPIObjects.APIError processCallJoinAction(WickrAPIRequests.CallRequest request) {
        Timber.INSTANCE.i("Processing call join action", new Object[0]);
        String convoID = request.getConvoID();
        if (convoID == null || StringsKt.isBlank(convoID)) {
            Timber.INSTANCE.e("Missing convo ID", new Object[0]);
            return WickrAPIObjects.APIError.INVALID_REQUEST;
        }
        String callID = request.getCallID();
        String str = callID;
        if (str == null || StringsKt.isBlank(str)) {
            Timber.INSTANCE.e("Missing call ID", new Object[0]);
            return WickrAPIObjects.APIError.INVALID_REQUEST;
        }
        ConvoRepository convoRepository = getSession().getConvoRepository();
        String convoID2 = request.getConvoID();
        Intrinsics.checkNotNull(convoID2);
        WickrConvoInterface wickrConvoInterface = convoRepository.get(convoID2);
        if (wickrConvoInterface == null) {
            Timber.INSTANCE.e("Invalid convo ID", new Object[0]);
            return WickrAPIObjects.APIError.INVALID_REQUEST;
        }
        Timber.INSTANCE.i("Joining call " + request.getCallID() + " in " + request.getConvoID(), new Object[0]);
        CallActivity.Companion companion = CallActivity.INSTANCE;
        Context context = getApiContext().getContext();
        String vGroupID = wickrConvoInterface.getVGroupID();
        Intrinsics.checkNotNullExpressionValue(vGroupID, "getVGroupID(...)");
        getApiContext().getContext().startActivity(companion.intentForJoinCall(context, vGroupID, callID));
        return null;
    }

    private final WickrAPIObjects.APIError processCallLeaveAction(WickrAPIRequests.CallRequest request) {
        Timber.INSTANCE.i("Processing call leave/end action", new Object[0]);
        getSession().getCallManager().disconnectFromActiveCall(true);
        return null;
    }
}
