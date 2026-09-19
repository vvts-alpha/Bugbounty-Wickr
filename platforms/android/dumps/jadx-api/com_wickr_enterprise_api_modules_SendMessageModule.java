package com.wickr.enterprise.api.modules;

import android.net.Uri;
import androidx.core.app.NotificationCompat;
import com.mywickr.config.WickrConfig;
import com.mywickr.interfaces.WickrConvoInterface;
import com.mywickr.interfaces.WickrMessageInterface;
import com.mywickr.messaging.upload.UploadMessageParams;
import com.mywickr.messaging.upload.UploadMessageService;
import com.mywickr.messaging.upload.UploadState;
import com.mywickr.wickr.FileParams;
import com.mywickr.wickr.WickrConvoUser;
import com.mywickr.wickr.WickrMsgClass;
import com.wickr.android.api.WickrAPI;
import com.wickr.android.api.WickrAPIObjects;
import com.wickr.android.api.WickrAPIRequests;
import com.wickr.android.api.WickrAPIResponses;
import com.wickr.enterprise.api.APIUtilsKt;
import com.wickr.enterprise.api.WickrAPIContext;
import com.wickr.enterprise.api.connections.ApprovedAPIConnection;
import com.wickr.enterprise.api.connections.WickrAPIConnection;
import com.wickr.enterprise.settings.PreferenceUtil;
import com.wickr.files.FileImportRequest;
import com.wickr.files.FileImportResult;
import com.wickr.messaging.MessageUploadManager;
import com.wickr.session.Session;
import io.sentry.SentryBaseEvent;
import io.sentry.cache.EnvelopeCache;
import io.sentry.protocol.App;
import io.sentry.protocol.Request;
import io.sentry.protocol.ViewHierarchyNode;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import kotlin.Metadata;
import kotlin.collections.CollectionsKt;
import kotlin.coroutines.Continuation;
import kotlin.coroutines.jvm.internal.Boxing;
import kotlin.jvm.internal.Intrinsics;
import kotlin.text.Regex;
import kotlin.text.StringsKt;
import ly.count.android.sdk.Countly;
import timber.log.Timber;

/* JADX INFO: compiled from: SendMessageModule.kt */
/* JADX INFO: loaded from: classes4.dex */
@Metadata(d1 = {"\u0000|\n\u0002\u0018\u0002\n\u0002\u0018\u0002\n\u0000\n\u0002\u0018\u0002\n\u0000\n\u0002\u0018\u0002\n\u0002\b\u0003\n\u0002\u0010 \n\u0002\u0010\u000e\n\u0002\b\u0005\n\u0002\u0018\u0002\n\u0002\u0018\u0002\n\u0000\n\u0002\u0018\u0002\n\u0000\n\u0002\u0018\u0002\n\u0000\n\u0002\u0018\u0002\n\u0002\b\u0003\n\u0002\u0018\u0002\n\u0002\b\u0002\n\u0002\u0018\u0002\n\u0000\n\u0002\u0018\u0002\n\u0002\b\u0002\n\u0002\u0018\u0002\n\u0002\b\u0002\n\u0002\u0018\u0002\n\u0000\n\u0002\u0010\u000b\n\u0000\n\u0002\u0010\u0000\n\u0002\b\u0002\n\u0002\u0018\u0002\n\u0002\b\b\b\u0007\u0018\u00002\u00020\u0001:\u00014B\u0017\u0012\u0006\u0010\u0002\u001a\u00020\u0003\u0012\u0006\u0010\u0004\u001a\u00020\u0005¢\u0006\u0004\b\u0006\u0010\u0007J \u0010\u0012\u001a\u0004\u0018\u00010\u00132\u0006\u0010\u0014\u001a\u00020\u00152\u0006\u0010\u0016\u001a\u00020\u0017H\u0096@¢\u0006\u0002\u0010\u0018J\"\u0010\u0019\u001a\u0004\u0018\u00010\u00132\u0006\u0010\u0014\u001a\u00020\u00152\u0006\u0010\u001a\u001a\u00020\n2\u0006\u0010\u0016\u001a\u00020\u001bH\u0002J*\u0010\u001c\u001a\u0004\u0018\u00010\u00132\u0006\u0010\u0014\u001a\u00020\u00152\u0006\u0010\u001a\u001a\u00020\n2\u0006\u0010\u001d\u001a\u00020\u001e2\u0006\u0010\u001f\u001a\u00020 H\u0002J*\u0010!\u001a\u0004\u0018\u00010\u00132\u0006\u0010\u0014\u001a\u00020\u00152\u0006\u0010\u001a\u001a\u00020\n2\u0006\u0010\u001d\u001a\u00020\u001e2\u0006\u0010\"\u001a\u00020#H\u0002J*\u0010$\u001a\u0004\u0018\u00010\u00132\u0006\u0010\u0014\u001a\u00020\u00152\u0006\u0010\u001a\u001a\u00020\n2\u0006\u0010\u001d\u001a\u00020\u001e2\u0006\u0010%\u001a\u00020&H\u0002J\u0016\u0010'\u001a\u00020(2\u0006\u0010)\u001a\u00020*H\u0096@¢\u0006\u0002\u0010+J\u0010\u0010,\u001a\u00020(2\u0006\u0010)\u001a\u00020-H\u0002J \u0010.\u001a\u00020\n2\u0006\u0010/\u001a\u00020\u00152\u0006\u0010\u001a\u001a\u00020\n2\u0006\u00100\u001a\u00020\nH\u0002J\u001c\u00101\u001a\u0004\u0018\u00010\u00112\b\u00102\u001a\u0004\u0018\u00010\n2\u0006\u00103\u001a\u00020(H\u0002R\u001a\u0010\b\u001a\b\u0012\u0004\u0012\u00020\n0\tX\u0096\u0004¢\u0006\b\n\u0000\u001a\u0004\b\u000b\u0010\fR\u001a\u0010\r\u001a\b\u0012\u0004\u0012\u00020\n0\tX\u0096\u0004¢\u0006\b\n\u0000\u001a\u0004\b\u000e\u0010\fR\u001a\u0010\u000f\u001a\u000e\u0012\u0004\u0012\u00020\n\u0012\u0004\u0012\u00020\u00110\u0010X\u0082\u0004¢\u0006\u0002\n\u0000¨\u00065"}, d2 = {"Lcom/wickr/enterprise/api/modules/SendMessageModule;", "Lcom/wickr/enterprise/api/modules/WickrAPIModule;", "apiContext", "Lcom/wickr/enterprise/api/WickrAPIContext;", EnvelopeCache.PREFIX_CURRENT_SESSION_FILE, "Lcom/wickr/session/Session;", "<init>", "(Lcom/wickr/enterprise/api/WickrAPIContext;Lcom/wickr/session/Session;)V", "requests", "", "", "getRequests", "()Ljava/util/List;", Countly.CountlyFeatureNames.events, "getEvents", "requestsInProgress", "Ljava/util/concurrent/ConcurrentHashMap;", "Lcom/wickr/enterprise/api/modules/SendMessageModule$RequestInfo;", "processRequest", "Lcom/wickr/android/api/WickrAPIObjects$APIError;", App.TYPE, "Lcom/wickr/enterprise/api/connections/WickrAPIConnection;", SentryBaseEvent.JsonKeys.REQUEST, "Lcom/wickr/android/api/WickrAPIRequests$WickrAPIRequest;", "(Lcom/wickr/enterprise/api/connections/WickrAPIConnection;Lcom/wickr/android/api/WickrAPIRequests$WickrAPIRequest;Lkotlin/coroutines/Continuation;)Ljava/lang/Object;", "processSendMessageRequest", ViewHierarchyNode.JsonKeys.IDENTIFIER, "Lcom/wickr/android/api/WickrAPIRequests$SendMessageRequest;", "processSendTextMessageRequest", "convo", "Lcom/mywickr/interfaces/WickrConvoInterface;", "textMessage", "Lcom/wickr/android/api/WickrAPIObjects$WickrMessage$TextMessage;", "processSendFileMessageRequest", "fileMessage", "Lcom/wickr/android/api/WickrAPIObjects$WickrMessage$FileMessage;", "processSendLocationMessageRequest", "locationMessage", "Lcom/wickr/android/api/WickrAPIObjects$WickrMessage$LocationMessage;", "processEvent", "", NotificationCompat.CATEGORY_EVENT, "", "(Ljava/lang/Object;Lkotlin/coroutines/Continuation;)Ljava/lang/Object;", "processUploadMessageEvent", "Lcom/mywickr/messaging/upload/UploadMessageService$Event;", "appendRequest", "connection", WickrConvoUser.Schema.KEY_convoID, "retrieveRequest", "requestTagId", "removeRequest", "RequestInfo", "app_awsRelease"}, k = 1, mv = {2, 2, 0}, xi = 48)
public final class SendMessageModule extends WickrAPIModule {
    public static final int $stable = 8;
    private final List<String> events;
    private final List<String> requests;
    private final ConcurrentHashMap<String, RequestInfo> requestsInProgress;

    /* JADX WARN: 'super' call moved to the top of the method (can break code semantics) */
    public SendMessageModule(WickrAPIContext apiContext, Session session) {
        super(apiContext, session);
        Intrinsics.checkNotNullParameter(apiContext, "apiContext");
        Intrinsics.checkNotNullParameter(session, "session");
        this.requests = CollectionsKt.listOf("SENDMESSAGEREQUEST");
        this.events = CollectionsKt.listOf(UploadMessageService.Event.class.getName());
        this.requestsInProgress = new ConcurrentHashMap<>();
    }

    /* JADX INFO: compiled from: SendMessageModule.kt */
    @Metadata(d1 = {"\u0000\"\n\u0002\u0018\u0002\n\u0002\u0010\u0000\n\u0000\n\u0002\u0010\u000e\n\u0002\b\r\n\u0002\u0010\u000b\n\u0002\b\u0002\n\u0002\u0010\b\n\u0002\b\u0002\b\u0082\b\u0018\u00002\u00020\u0001B\u001f\u0012\u0006\u0010\u0002\u001a\u00020\u0003\u0012\u0006\u0010\u0004\u001a\u00020\u0003\u0012\u0006\u0010\u0005\u001a\u00020\u0003¢\u0006\u0004\b\u0006\u0010\u0007J\t\u0010\f\u001a\u00020\u0003HÆ\u0003J\t\u0010\r\u001a\u00020\u0003HÆ\u0003J\t\u0010\u000e\u001a\u00020\u0003HÆ\u0003J'\u0010\u000f\u001a\u00020\u00002\b\b\u0002\u0010\u0002\u001a\u00020\u00032\b\b\u0002\u0010\u0004\u001a\u00020\u00032\b\b\u0002\u0010\u0005\u001a\u00020\u0003HÆ\u0001J\u0013\u0010\u0010\u001a\u00020\u00112\b\u0010\u0012\u001a\u0004\u0018\u00010\u0001HÖ\u0003J\t\u0010\u0013\u001a\u00020\u0014HÖ\u0001J\t\u0010\u0015\u001a\u00020\u0003HÖ\u0001R\u0011\u0010\u0002\u001a\u00020\u0003¢\u0006\b\n\u0000\u001a\u0004\b\b\u0010\tR\u0011\u0010\u0004\u001a\u00020\u0003¢\u0006\b\n\u0000\u001a\u0004\b\n\u0010\tR\u0011\u0010\u0005\u001a\u00020\u0003¢\u0006\b\n\u0000\u001a\u0004\b\u000b\u0010\t¨\u0006\u0016"}, d2 = {"Lcom/wickr/enterprise/api/modules/SendMessageModule$RequestInfo;", "", WickrAPI.EXTRA_PACKAGE_NAME, "", ViewHierarchyNode.JsonKeys.IDENTIFIER, WickrConvoUser.Schema.KEY_convoID, "<init>", "(Ljava/lang/String;Ljava/lang/String;Ljava/lang/String;)V", "getPackageName", "()Ljava/lang/String;", "getIdentifier", "getConvoID", "component1", "component2", "component3", "copy", "equals", "", Request.JsonKeys.OTHER, "hashCode", "", "toString", "app_awsRelease"}, k = 1, mv = {2, 2, 0}, xi = 48)
    private static final /* data */ class RequestInfo {
        private final String convoID;
        private final String identifier;
        private final String packageName;

        public static /* synthetic */ RequestInfo copy$default(RequestInfo requestInfo, String str, String str2, String str3, int i, Object obj) {
            if ((i & 1) != 0) {
                str = requestInfo.packageName;
            }
            if ((i & 2) != 0) {
                str2 = requestInfo.identifier;
            }
            if ((i & 4) != 0) {
                str3 = requestInfo.convoID;
            }
            return requestInfo.copy(str, str2, str3);
        }

        /* JADX INFO: renamed from: component1, reason: from getter */
        public final String getPackageName() {
            return this.packageName;
        }

        /* JADX INFO: renamed from: component2, reason: from getter */
        public final String getIdentifier() {
            return this.identifier;
        }

        /* JADX INFO: renamed from: component3, reason: from getter */
        public final String getConvoID() {
            return this.convoID;
        }

        public final RequestInfo copy(String packageName, String identifier, String convoID) {
            Intrinsics.checkNotNullParameter(packageName, "packageName");
            Intrinsics.checkNotNullParameter(identifier, "identifier");
            Intrinsics.checkNotNullParameter(convoID, "convoID");
            return new RequestInfo(packageName, identifier, convoID);
        }

        public boolean equals(Object other) {
            if (this == other) {
                return true;
            }
            if (!(other instanceof RequestInfo)) {
                return false;
            }
            RequestInfo requestInfo = (RequestInfo) other;
            return Intrinsics.areEqual(this.packageName, requestInfo.packageName) && Intrinsics.areEqual(this.identifier, requestInfo.identifier) && Intrinsics.areEqual(this.convoID, requestInfo.convoID);
        }

        public int hashCode() {
            return (((this.packageName.hashCode() * 31) + this.identifier.hashCode()) * 31) + this.convoID.hashCode();
        }

        public String toString() {
            return "RequestInfo(packageName=" + this.packageName + ", identifier=" + this.identifier + ", convoID=" + this.convoID + ")";
        }

        public RequestInfo(String packageName, String identifier, String convoID) {
            Intrinsics.checkNotNullParameter(packageName, "packageName");
            Intrinsics.checkNotNullParameter(identifier, "identifier");
            Intrinsics.checkNotNullParameter(convoID, "convoID");
            this.packageName = packageName;
            this.identifier = identifier;
            this.convoID = convoID;
        }

        public final String getPackageName() {
            return this.packageName;
        }

        public final String getIdentifier() {
            return this.identifier;
        }

        public final String getConvoID() {
            return this.convoID;
        }
    }

    @Override // com.wickr.enterprise.api.modules.WickrAPIModule
    public List<String> getRequests() {
        return this.requests;
    }

    @Override // com.wickr.enterprise.api.modules.WickrAPIModule
    public List<String> getEvents() {
        return this.events;
    }

    @Override // com.wickr.enterprise.api.modules.WickrAPIModule
    public Object processRequest(WickrAPIConnection wickrAPIConnection, WickrAPIRequests.WickrAPIRequest wickrAPIRequest, Continuation<? super WickrAPIObjects.APIError> continuation) {
        Timber.INSTANCE.i("Processing request " + wickrAPIRequest.getRequestCase().name(), new Object[0]);
        if (!wickrAPIRequest.hasSendMessageRequest()) {
            return WickrAPIObjects.APIError.INTERNAL_ERROR;
        }
        String identifier = wickrAPIRequest.getIdentifier();
        Intrinsics.checkNotNullExpressionValue(identifier, "getIdentifier(...)");
        WickrAPIRequests.SendMessageRequest sendMessageRequest = wickrAPIRequest.getSendMessageRequest();
        Intrinsics.checkNotNullExpressionValue(sendMessageRequest, "getSendMessageRequest(...)");
        return processSendMessageRequest(wickrAPIConnection, identifier, sendMessageRequest);
    }

    private final WickrAPIObjects.APIError processSendMessageRequest(WickrAPIConnection app, String identifier, WickrAPIRequests.SendMessageRequest request) {
        WickrConvoInterface wickrConvoInterface = getSession().getConvoRepository().get(request.getConvoID());
        if (wickrConvoInterface == null) {
            Timber.INSTANCE.e("Invalid convo ID", new Object[0]);
            return WickrAPIObjects.APIError.INVALID_REQUEST;
        }
        if (request.hasTextMessage()) {
            WickrAPIObjects.WickrMessage.TextMessage textMessage = request.getTextMessage();
            Intrinsics.checkNotNullExpressionValue(textMessage, "getTextMessage(...)");
            return processSendTextMessageRequest(app, identifier, wickrConvoInterface, textMessage);
        }
        if (request.hasFileMessage()) {
            WickrAPIObjects.WickrMessage.FileMessage fileMessage = request.getFileMessage();
            Intrinsics.checkNotNullExpressionValue(fileMessage, "getFileMessage(...)");
            return processSendFileMessageRequest(app, identifier, wickrConvoInterface, fileMessage);
        }
        if (!request.hasLocationMessage()) {
            return WickrAPIObjects.APIError.INTERNAL_ERROR;
        }
        WickrAPIObjects.WickrMessage.LocationMessage locationMessage = request.getLocationMessage();
        Intrinsics.checkNotNullExpressionValue(locationMessage, "getLocationMessage(...)");
        return processSendLocationMessageRequest(app, identifier, wickrConvoInterface, locationMessage);
    }

    private final WickrAPIObjects.APIError processSendTextMessageRequest(WickrAPIConnection app, String identifier, WickrConvoInterface convo, WickrAPIObjects.WickrMessage.TextMessage textMessage) {
        if (!textMessage.hasText()) {
            return WickrAPIObjects.APIError.INVALID_REQUEST;
        }
        String text = textMessage.getText();
        Intrinsics.checkNotNullExpressionValue(text, "getText(...)");
        String string = StringsKt.trim((CharSequence) new Regex("\\s++$").replaceFirst(text, "")).toString();
        if (string.length() == 0) {
            Timber.INSTANCE.e("Invalid message text", new Object[0]);
            return WickrAPIObjects.APIError.INVALID_REQUEST;
        }
        UploadMessageParams.Builder bor = new UploadMessageParams.Builder().setvGroupID(convo.getVGroupID()).setRecipients(convo.getAllUsers()).setTtl(convo.getTTL()).setBor(convo.getBurnOnRead());
        String vGroupID = convo.getVGroupID();
        Intrinsics.checkNotNullExpressionValue(vGroupID, "getVGroupID(...)");
        UploadMessageService.sendTextMessage(getApiContext().getContext(), bor.setTagID(appendRequest(app, identifier, vGroupID)).build(), string, CollectionsKt.emptyList(), PreferenceUtil.getMarkdownVersion(getApiContext().getContext()));
        return null;
    }

    private final WickrAPIObjects.APIError processSendFileMessageRequest(WickrAPIConnection app, String identifier, WickrConvoInterface convo, WickrAPIObjects.WickrMessage.FileMessage fileMessage) {
        if (!fileMessage.hasUri() || !fileMessage.hasFileName() || !fileMessage.hasFileSize() || !fileMessage.hasMimeType()) {
            Timber.INSTANCE.e("Missing file meta data", new Object[0]);
            return WickrAPIObjects.APIError.INVALID_REQUEST;
        }
        Timber.INSTANCE.i("Importing file", new Object[0]);
        Uri uri = Uri.parse(fileMessage.getUri());
        Intrinsics.checkNotNullExpressionValue(uri, "parse(...)");
        FileImportResult fileImportResultImportFile = getSession().getFileManager().importFile(new FileImportRequest(uri, fileMessage.getFileName(), fileMessage.getMimeType(), WickrConfig.INSTANCE.getMaxUploadSize(), null, 0L, false, 112, null));
        if (!fileImportResultImportFile.getSuccess()) {
            Timber.INSTANCE.e("Unable to import file", new Object[0]);
            fileImportResultImportFile.getSizeTooLarge();
            return WickrAPIObjects.APIError.INVALID_REQUEST;
        }
        Timber.INSTANCE.i("Sending file message in " + convo.getVGroupID(), new Object[0]);
        FileParams.Builder uploadedTimestamp = new FileParams.Builder().setGuid(fileImportResultImportFile.getGuid()).setFileName(fileImportResultImportFile.getFileName()).setMimeType(fileImportResultImportFile.getMimeType()).setUploadedByUser(getSession().getUsernameHash()).setUploadedTimestamp(getSession().getAppClock().getCurrentTime());
        if (fileMessage.hasVoiceMemo()) {
            uploadedTimestamp.setAudioDuration(fileMessage.getVoiceMemo().getDuration());
        }
        UploadMessageParams.Builder fileEncryptionParams = new UploadMessageParams.Builder().setvGroupID(convo.getVGroupID()).setRecipients(convo.getAllUsers()).setTtl(convo.getTTL()).setBor(convo.getBurnOnRead()).setFileEncryptionParams(uploadedTimestamp.build());
        String vGroupID = convo.getVGroupID();
        Intrinsics.checkNotNullExpressionValue(vGroupID, "getVGroupID(...)");
        UploadMessageParams uploadMessageParamsBuild = fileEncryptionParams.setTagID(appendRequest(app, identifier, vGroupID)).build();
        MessageUploadManager messageUploadManager = getSession().getMessageUploadManager();
        Intrinsics.checkNotNull(uploadMessageParamsBuild);
        messageUploadManager.sendFileMessage(uploadMessageParamsBuild);
        return null;
    }

    private final WickrAPIObjects.APIError processSendLocationMessageRequest(WickrAPIConnection app, String identifier, WickrConvoInterface convo, WickrAPIObjects.WickrMessage.LocationMessage locationMessage) {
        if (!locationMessage.hasLatitude() || !locationMessage.hasLongitude()) {
            Timber.INSTANCE.e("Missing location data", new Object[0]);
            return WickrAPIObjects.APIError.INVALID_REQUEST;
        }
        UploadMessageParams.Builder bor = new UploadMessageParams.Builder().setvGroupID(convo.getVGroupID()).setRecipients(convo.getAllUsers()).setTtl(convo.getTTL()).setBor(convo.getBurnOnRead());
        String vGroupID = convo.getVGroupID();
        Intrinsics.checkNotNullExpressionValue(vGroupID, "getVGroupID(...)");
        UploadMessageService.sendLocationMessage(getApiContext().getContext(), bor.setTagID(appendRequest(app, identifier, vGroupID)).build(), locationMessage.getLatitude(), locationMessage.getLongitude(), 0L);
        return null;
    }

    @Override // com.wickr.enterprise.api.modules.WickrAPIModule
    public Object processEvent(Object obj, Continuation<? super Boolean> continuation) {
        return Boxing.boxBoolean(obj instanceof UploadMessageService.Event ? processUploadMessageEvent((UploadMessageService.Event) obj) : false);
    }

    private final boolean processUploadMessageEvent(UploadMessageService.Event event) {
        ApprovedAPIConnection connection;
        if (event.state != UploadState.SAVE && event.state != UploadState.UPLOAD) {
            return false;
        }
        RequestInfo requestInfoRetrieveRequest = retrieveRequest(event.tagID, event.state == UploadState.UPLOAD);
        if (requestInfoRetrieveRequest == null || (connection = getApiContext().getConnectionManager().getConnection(requestInfoRetrieveRequest.getPackageName())) == null) {
            return false;
        }
        WickrMessageInterface wickrMessageInterface = event.outbox;
        Timber.Companion companion = Timber.INSTANCE;
        UploadState uploadState = event.state;
        WickrMessageInterface wickrMessageInterface2 = event.outbox;
        companion.d("Received upload event with state " + uploadState + " for message " + (wickrMessageInterface2 != null ? Integer.valueOf(wickrMessageInterface2.getID()) : null), new Object[0]);
        if (event.state == UploadState.SAVE) {
            if ((wickrMessageInterface != null ? wickrMessageInterface.getMsgClass() : null) == WickrMsgClass.WICKR_MSGCLASS_FILE) {
                String identifier = requestInfoRetrieveRequest.getIdentifier();
                String fileGUID = wickrMessageInterface.getFileGUID();
                Intrinsics.checkNotNullExpressionValue(fileGUID, "getFileGUID(...)");
                FileManagerModule.INSTANCE.trackFile(connection, identifier, fileGUID, wickrMessageInterface.getID());
            }
            return true;
        }
        WickrAPIObjects.WickrMessage wickrAPIMessage = wickrMessageInterface != null ? APIUtilsKt.toWickrAPIMessage(wickrMessageInterface, getApiContext().getContext(), getSession().getAppClock(), getSession().getFileManager()) : null;
        WickrAPIResponses.SendMessageResponse.Builder convoID = WickrAPIResponses.SendMessageResponse.newBuilder().setConvoID(requestInfoRetrieveRequest.getConvoID());
        if (!event.success || wickrAPIMessage == null) {
            Timber.INSTANCE.i("Sending message send failed response to " + connection.getAppInfo().getPackageName(), new Object[0]);
            convoID.setError(WickrAPIResponses.SendMessageResponse.SendError.UNKNOWN);
            if (wickrAPIMessage != null) {
                convoID.setMessage(wickrAPIMessage);
            }
        } else {
            Timber.INSTANCE.i("Sending message send success response to " + connection.getAppInfo().getPackageName(), new Object[0]);
            convoID.setMessage(wickrAPIMessage);
        }
        WickrAPIResponses.WickrAPIResponse wickrAPIResponseBuild = WickrAPIResponses.WickrAPIResponse.newBuilder().setIdentifier(requestInfoRetrieveRequest.getIdentifier()).setSendMessageResponse(convoID).build();
        Intrinsics.checkNotNull(wickrAPIResponseBuild);
        getApiContext().sendResponse(connection, wickrAPIResponseBuild);
        return true;
    }

    private final String appendRequest(WickrAPIConnection connection, String identifier, String convoID) {
        String string = UUID.randomUUID().toString();
        Intrinsics.checkNotNullExpressionValue(string, "toString(...)");
        ConcurrentHashMap<String, RequestInfo> concurrentHashMap = this.requestsInProgress;
        String packageName = connection.getAppInfo().getPackageName();
        Intrinsics.checkNotNullExpressionValue(packageName, "getPackageName(...)");
        concurrentHashMap.put(string, new RequestInfo(packageName, identifier, convoID));
        Timber.INSTANCE.d("New send message request tagged and queued: " + string, new Object[0]);
        return string;
    }

    private final RequestInfo retrieveRequest(String requestTagId, boolean removeRequest) {
        RequestInfo requestInfo;
        String str = requestTagId;
        if (str == null || StringsKt.isBlank(str) || (requestInfo = this.requestsInProgress.get(requestTagId)) == null) {
            return null;
        }
        if (removeRequest) {
            Timber.INSTANCE.d("Removing pending request tagged: " + requestTagId, new Object[0]);
            this.requestsInProgress.remove(requestTagId);
            return requestInfo;
        }
        Timber.INSTANCE.d("Retrieved pending request tagged: " + requestTagId, new Object[0]);
        return requestInfo;
    }
}
