package com.wickr.enterprise.api.modules;

import com.google.protobuf.ProtocolStringList;
import com.mywickr.interfaces.WickrConvoInterface;
import com.mywickr.interfaces.WickrMessageInterface;
import com.mywickr.messaging.SecureRoomManager;
import com.mywickr.wickr.WickrMessage;
import com.mywickr.wickr.WickrMsgClass;
import com.mywickr.wickr.WickrMsgType;
import com.wickr.android.api.WickrAPIObjects;
import com.wickr.android.api.WickrAPIRequests;
import com.wickr.android.api.WickrAPIResponses;
import com.wickr.enterprise.api.APIUtilsKt;
import com.wickr.enterprise.api.WickrAPIContext;
import com.wickr.enterprise.api.connections.WickrAPIConnection;
import com.wickr.repository.MessageRepository;
import com.wickr.session.Session;
import io.sentry.SentryBaseEvent;
import io.sentry.cache.EnvelopeCache;
import io.sentry.protocol.App;
import io.sentry.protocol.ViewHierarchyNode;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collection;
import java.util.Comparator;
import java.util.Iterator;
import java.util.List;
import kotlin.Metadata;
import kotlin.collections.CollectionsKt;
import kotlin.comparisons.ComparisonsKt;
import kotlin.coroutines.Continuation;
import kotlin.jvm.internal.DefaultConstructorMarker;
import kotlin.jvm.internal.Intrinsics;
import kotlin.text.StringsKt;
import timber.log.Timber;

/* JADX INFO: compiled from: GetMessagesModule.kt */
/* JADX INFO: loaded from: classes4.dex */
@Metadata(d1 = {"\u0000Z\n\u0002\u0018\u0002\n\u0002\u0018\u0002\n\u0000\n\u0002\u0018\u0002\n\u0000\n\u0002\u0018\u0002\n\u0002\b\u0003\n\u0002\u0010 \n\u0002\u0010\u000e\n\u0002\b\u0003\n\u0002\u0018\u0002\n\u0002\u0018\u0002\n\u0002\u0018\u0002\n\u0000\n\u0002\u0018\u0002\n\u0000\n\u0002\u0018\u0002\n\u0000\n\u0002\u0018\u0002\n\u0002\b\u0003\n\u0002\u0018\u0002\n\u0000\n\u0002\u0018\u0002\n\u0000\n\u0002\u0018\u0002\n\u0002\b\u0002\b\u0007\u0018\u0000 \u001f2\u00020\u0001:\u0001\u001fB\u0017\u0012\u0006\u0010\u0002\u001a\u00020\u0003\u0012\u0006\u0010\u0004\u001a\u00020\u0005¢\u0006\u0004\b\u0006\u0010\u0007J \u0010\u0011\u001a\u0004\u0018\u00010\u00122\u0006\u0010\u0013\u001a\u00020\u00142\u0006\u0010\u0015\u001a\u00020\u0016H\u0096@¢\u0006\u0002\u0010\u0017J\"\u0010\u0018\u001a\u0004\u0018\u00010\u00122\u0006\u0010\u0013\u001a\u00020\u00142\u0006\u0010\u0019\u001a\u00020\n2\u0006\u0010\u0015\u001a\u00020\u001aH\u0002J\"\u0010\u001b\u001a\u0004\u0018\u00010\u00122\u0006\u0010\u0013\u001a\u00020\u00142\u0006\u0010\u0019\u001a\u00020\n2\u0006\u0010\u0015\u001a\u00020\u001cH\u0002J\"\u0010\u001d\u001a\u0004\u0018\u00010\u00122\u0006\u0010\u0013\u001a\u00020\u00142\u0006\u0010\u0019\u001a\u00020\n2\u0006\u0010\u0015\u001a\u00020\u001eH\u0002R\u001a\u0010\b\u001a\b\u0012\u0004\u0012\u00020\n0\tX\u0096\u0004¢\u0006\b\n\u0000\u001a\u0004\b\u000b\u0010\fR\u001e\u0010\r\u001a\u0012\u0012\u0004\u0012\u00020\u000f0\u000ej\b\u0012\u0004\u0012\u00020\u000f`\u0010X\u0082\u0004¢\u0006\u0002\n\u0000¨\u0006 "}, d2 = {"Lcom/wickr/enterprise/api/modules/GetMessagesModule;", "Lcom/wickr/enterprise/api/modules/WickrAPIModule;", "apiContext", "Lcom/wickr/enterprise/api/WickrAPIContext;", EnvelopeCache.PREFIX_CURRENT_SESSION_FILE, "Lcom/wickr/session/Session;", "<init>", "(Lcom/wickr/enterprise/api/WickrAPIContext;Lcom/wickr/session/Session;)V", "requests", "", "", "getRequests", "()Ljava/util/List;", "messageComparator", "Ljava/util/Comparator;", "Lcom/mywickr/interfaces/WickrMessageInterface;", "Lkotlin/Comparator;", "processRequest", "Lcom/wickr/android/api/WickrAPIObjects$APIError;", App.TYPE, "Lcom/wickr/enterprise/api/connections/WickrAPIConnection;", SentryBaseEvent.JsonKeys.REQUEST, "Lcom/wickr/android/api/WickrAPIRequests$WickrAPIRequest;", "(Lcom/wickr/enterprise/api/connections/WickrAPIConnection;Lcom/wickr/android/api/WickrAPIRequests$WickrAPIRequest;Lkotlin/coroutines/Continuation;)Ljava/lang/Object;", "processGetMessagesAction", ViewHierarchyNode.JsonKeys.IDENTIFIER, "Lcom/wickr/android/api/WickrAPIRequests$GetMessagesRequest;", "processUnlockMessageAction", "Lcom/wickr/android/api/WickrAPIRequests$UnlockMessageRequest;", "processDeleteMessageAction", "Lcom/wickr/android/api/WickrAPIRequests$DeleteMessageRequest;", "Companion", "app_awsRelease"}, k = 1, mv = {2, 2, 0}, xi = 48)
public final class GetMessagesModule extends WickrAPIModule {
    private final Comparator<WickrMessageInterface> messageComparator;
    private final List<String> requests;

    /* JADX INFO: renamed from: Companion, reason: from kotlin metadata */
    public static final Companion INSTANCE = new Companion(null);
    public static final int $stable = 8;
    private static final List<WickrMsgClass> DELETABLE_MESSAGE_CLASSES = CollectionsKt.listOf((Object[]) new WickrMsgClass[]{WickrMsgClass.WICKR_MSGCLASS_TXT, WickrMsgClass.WICKR_MSGCLASS_FILE, WickrMsgClass.WICKR_MSGCLASS_LOCATION});
    private static final List<WickrMessage.SentState> DELETABLE_SENT_STATES = CollectionsKt.listOf((Object[]) new WickrMessage.SentState[]{WickrMessage.SentState.SENT, WickrMessage.SentState.UNSENT, WickrMessage.SentState.SAVED});

    /* JADX INFO: compiled from: GetMessagesModule.kt */
    @Metadata(k = 3, mv = {2, 2, 0}, xi = 48)
    public static final /* synthetic */ class WhenMappings {
        public static final /* synthetic */ int[] $EnumSwitchMapping$0;

        static {
            int[] iArr = new int[WickrAPIObjects.WickrMessage.MessageType.values().length];
            try {
                iArr[WickrAPIObjects.WickrMessage.MessageType.TEXT.ordinal()] = 1;
            } catch (NoSuchFieldError unused) {
            }
            try {
                iArr[WickrAPIObjects.WickrMessage.MessageType.FILE.ordinal()] = 2;
            } catch (NoSuchFieldError unused2) {
            }
            try {
                iArr[WickrAPIObjects.WickrMessage.MessageType.CALL.ordinal()] = 3;
            } catch (NoSuchFieldError unused3) {
            }
            try {
                iArr[WickrAPIObjects.WickrMessage.MessageType.LOCATION.ordinal()] = 4;
            } catch (NoSuchFieldError unused4) {
            }
            try {
                iArr[WickrAPIObjects.WickrMessage.MessageType.CONTROL.ordinal()] = 5;
            } catch (NoSuchFieldError unused5) {
            }
            $EnumSwitchMapping$0 = iArr;
        }
    }

    /* JADX WARN: 'super' call moved to the top of the method (can break code semantics) */
    public GetMessagesModule(WickrAPIContext apiContext, Session session) {
        super(apiContext, session);
        Intrinsics.checkNotNullParameter(apiContext, "apiContext");
        Intrinsics.checkNotNullParameter(session, "session");
        this.requests = CollectionsKt.listOf((Object[]) new String[]{"GETMESSAGESREQUEST", "UNLOCKMESSAGEREQUEST", "DELETEMESSAGEREQUEST"});
        this.messageComparator = new Comparator() { // from class: com.wickr.enterprise.api.modules.GetMessagesModule$$ExternalSyntheticLambda0
            @Override // java.util.Comparator
            public final int compare(Object obj, Object obj2) {
                return GetMessagesModule.messageComparator$lambda$0((WickrMessageInterface) obj, (WickrMessageInterface) obj2);
            }
        };
    }

    /* JADX INFO: compiled from: GetMessagesModule.kt */
    @Metadata(d1 = {"\u0000 \n\u0002\u0018\u0002\n\u0002\u0010\u0000\n\u0002\b\u0003\n\u0002\u0010 \n\u0002\u0018\u0002\n\u0002\b\u0003\n\u0002\u0018\u0002\n\u0002\b\u0002\b\u0086\u0003\u0018\u00002\u00020\u0001B\t\b\u0002¢\u0006\u0004\b\u0002\u0010\u0003R\u0017\u0010\u0004\u001a\b\u0012\u0004\u0012\u00020\u00060\u0005¢\u0006\b\n\u0000\u001a\u0004\b\u0007\u0010\bR\u0017\u0010\t\u001a\b\u0012\u0004\u0012\u00020\n0\u0005¢\u0006\b\n\u0000\u001a\u0004\b\u000b\u0010\b¨\u0006\f"}, d2 = {"Lcom/wickr/enterprise/api/modules/GetMessagesModule$Companion;", "", "<init>", "()V", "DELETABLE_MESSAGE_CLASSES", "", "Lcom/mywickr/wickr/WickrMsgClass;", "getDELETABLE_MESSAGE_CLASSES", "()Ljava/util/List;", "DELETABLE_SENT_STATES", "Lcom/mywickr/wickr/WickrMessage$SentState;", "getDELETABLE_SENT_STATES", "app_awsRelease"}, k = 1, mv = {2, 2, 0}, xi = 48)
    public static final class Companion {
        public /* synthetic */ Companion(DefaultConstructorMarker defaultConstructorMarker) {
            this();
        }

        private Companion() {
        }

        public final List<WickrMsgClass> getDELETABLE_MESSAGE_CLASSES() {
            return GetMessagesModule.DELETABLE_MESSAGE_CLASSES;
        }

        public final List<WickrMessage.SentState> getDELETABLE_SENT_STATES() {
            return GetMessagesModule.DELETABLE_SENT_STATES;
        }
    }

    @Override // com.wickr.enterprise.api.modules.WickrAPIModule
    public List<String> getRequests() {
        return this.requests;
    }

    /* JADX INFO: Access modifiers changed from: private */
    public static final int messageComparator$lambda$0(WickrMessageInterface wickrMessageInterface, WickrMessageInterface wickrMessageInterface2) {
        return ComparisonsKt.compareValues(Long.valueOf(wickrMessageInterface.fullTimestampMicros()), Long.valueOf(wickrMessageInterface2.fullTimestampMicros()));
    }

    @Override // com.wickr.enterprise.api.modules.WickrAPIModule
    public Object processRequest(WickrAPIConnection wickrAPIConnection, WickrAPIRequests.WickrAPIRequest wickrAPIRequest, Continuation<? super WickrAPIObjects.APIError> continuation) {
        Timber.INSTANCE.i("Processing request " + wickrAPIRequest.getRequestCase().name(), new Object[0]);
        if (wickrAPIRequest.hasGetMessagesRequest()) {
            String identifier = wickrAPIRequest.getIdentifier();
            Intrinsics.checkNotNullExpressionValue(identifier, "getIdentifier(...)");
            WickrAPIRequests.GetMessagesRequest getMessagesRequest = wickrAPIRequest.getGetMessagesRequest();
            Intrinsics.checkNotNullExpressionValue(getMessagesRequest, "getGetMessagesRequest(...)");
            return processGetMessagesAction(wickrAPIConnection, identifier, getMessagesRequest);
        }
        if (wickrAPIRequest.hasUnlockMessageRequest()) {
            String identifier2 = wickrAPIRequest.getIdentifier();
            Intrinsics.checkNotNullExpressionValue(identifier2, "getIdentifier(...)");
            WickrAPIRequests.UnlockMessageRequest unlockMessageRequest = wickrAPIRequest.getUnlockMessageRequest();
            Intrinsics.checkNotNullExpressionValue(unlockMessageRequest, "getUnlockMessageRequest(...)");
            return processUnlockMessageAction(wickrAPIConnection, identifier2, unlockMessageRequest);
        }
        if (!wickrAPIRequest.hasDeleteMessageRequest()) {
            return WickrAPIObjects.APIError.INTERNAL_ERROR;
        }
        String identifier3 = wickrAPIRequest.getIdentifier();
        Intrinsics.checkNotNullExpressionValue(identifier3, "getIdentifier(...)");
        WickrAPIRequests.DeleteMessageRequest deleteMessageRequest = wickrAPIRequest.getDeleteMessageRequest();
        Intrinsics.checkNotNullExpressionValue(deleteMessageRequest, "getDeleteMessageRequest(...)");
        return processDeleteMessageAction(wickrAPIConnection, identifier3, deleteMessageRequest);
    }

    /* JADX WARN: Code duplicated, block: B:71:0x0289  */
    /* JADX WARN: Code duplicated, block: B:74:0x02a0 A[LOOP:3: B:72:0x029a->B:74:0x02a0, LOOP_END] */
    private final WickrAPIObjects.APIError processGetMessagesAction(WickrAPIConnection app, String identifier, WickrAPIRequests.GetMessagesRequest request) {
        List listFlatten;
        List listListOf;
        List<WickrMessageInterface> listEmptyList;
        ArrayList arrayList;
        Iterator it;
        ArrayList arrayList2;
        if (request.getCount() <= 0 || request.getOffset() < 0) {
            Timber.INSTANCE.e("Invalid page or count in message request", new Object[0]);
            return WickrAPIObjects.APIError.INVALID_REQUEST;
        }
        String convoID = request.getConvoID();
        if (convoID == null || convoID.length() == 0) {
            Timber.INSTANCE.e("Invalid convo id in message request", new Object[0]);
            return WickrAPIObjects.APIError.INVALID_REQUEST;
        }
        if (request.getTypesList().isEmpty()) {
            listFlatten = CollectionsKt.listOf((Object[]) new WickrMsgType[]{WickrMsgType.WICKR_MSGTYPE_TXT, WickrMsgType.WICKR_MSGTYPE_FILESHAREMESSAGE, WickrMsgType.WICKR_MSGTYPE_CALL_MESSAGE, WickrMsgType.WICKR_MSGTYPE_LOCATION_MESSAGE, WickrMsgType.WICKR_MSGTYPE_CTRL_CREATEROOM, WickrMsgType.WICKR_MSGTYPE_CTRL_MODIFYROOMPARAMS, WickrMsgType.WICKR_MSGTYPE_CTRL_MODIFYROOMMEMBERS, WickrMsgType.WICKR_MSGTYPE_CTRL_LEAVEROOM, WickrMsgType.WICKR_MSGTYPE_CTRL_DELETEROOM});
        } else {
            List<WickrAPIObjects.WickrMessage.MessageType> typesList = request.getTypesList();
            Intrinsics.checkNotNullExpressionValue(typesList, "getTypesList(...)");
            List<WickrAPIObjects.WickrMessage.MessageType> listDistinct = CollectionsKt.distinct(typesList);
            ArrayList arrayList3 = new ArrayList(CollectionsKt.collectionSizeOrDefault(listDistinct, 10));
            for (WickrAPIObjects.WickrMessage.MessageType messageType : listDistinct) {
                int i = messageType == null ? -1 : WhenMappings.$EnumSwitchMapping$0[messageType.ordinal()];
                if (i == 1) {
                    listListOf = CollectionsKt.listOf(WickrMsgType.WICKR_MSGTYPE_TXT);
                } else if (i == 2) {
                    listListOf = CollectionsKt.listOf(WickrMsgType.WICKR_MSGTYPE_FILESHAREMESSAGE);
                } else if (i == 3) {
                    listListOf = CollectionsKt.listOf(WickrMsgType.WICKR_MSGTYPE_CALL_MESSAGE);
                } else if (i == 4) {
                    listListOf = CollectionsKt.listOf(WickrMsgType.WICKR_MSGTYPE_LOCATION_MESSAGE);
                } else if (i == 5) {
                    listListOf = CollectionsKt.listOf((Object[]) new WickrMsgType[]{WickrMsgType.WICKR_MSGTYPE_CTRL_CREATEROOM, WickrMsgType.WICKR_MSGTYPE_CTRL_MODIFYROOMPARAMS, WickrMsgType.WICKR_MSGTYPE_CTRL_MODIFYROOMMEMBERS, WickrMsgType.WICKR_MSGTYPE_CTRL_LEAVEROOM, WickrMsgType.WICKR_MSGTYPE_CTRL_DELETEROOM});
                } else {
                    listListOf = CollectionsKt.listOf(WickrMsgType.WICKR_MSGTYPE_UNSUPPORTED);
                }
                arrayList3.add(listListOf);
            }
            listFlatten = CollectionsKt.flatten(arrayList3);
        }
        List listDistinct2 = CollectionsKt.distinct(listFlatten);
        ArrayList arrayList4 = new ArrayList();
        for (Object obj : listDistinct2) {
            if (((WickrMsgType) obj) != WickrMsgType.WICKR_MSGTYPE_UNSUPPORTED) {
                arrayList4.add(obj);
            }
        }
        ArrayList arrayList5 = arrayList4;
        if (arrayList5.isEmpty() || request.getCount() == 0) {
            listEmptyList = CollectionsKt.emptyList();
        } else {
            MessageRepository messageRepository = getSession().getMessageRepository();
            String convoID2 = request.getConvoID();
            Intrinsics.checkNotNullExpressionValue(convoID2, "getConvoID(...)");
            WickrMsgType[] wickrMsgTypeArr = (WickrMsgType[]) arrayList5.toArray(new WickrMsgType[0]);
            List<WickrMessageInterface> listBlockingGet = messageRepository.getMessagesByType(convoID2, (WickrMsgType[]) Arrays.copyOf(wickrMsgTypeArr, wickrMsgTypeArr.length), request.getCount(), request.getOffset()).toList().blockingGet();
            Intrinsics.checkNotNull(listBlockingGet);
            listEmptyList = listBlockingGet;
        }
        List listReversed = CollectionsKt.reversed(CollectionsKt.sortedWith(listEmptyList, this.messageComparator));
        if (listReversed.isEmpty()) {
            List list = listReversed;
            arrayList = new ArrayList(CollectionsKt.collectionSizeOrDefault(list, 10));
            it = list.iterator();
            while (it.hasNext()) {
                arrayList.add(APIUtilsKt.toWickrAPIMessage((WickrMessageInterface) it.next(), getApiContext().getContext(), getSession().getAppClock(), getSession().getFileManager()));
            }
            arrayList2 = arrayList;
        } else {
            List list2 = listReversed;
            if ((list2 instanceof Collection) && list2.isEmpty()) {
                List list3 = listReversed;
                arrayList = new ArrayList(CollectionsKt.collectionSizeOrDefault(list3, 10));
                it = list3.iterator();
                while (it.hasNext()) {
                    arrayList.add(APIUtilsKt.toWickrAPIMessage((WickrMessageInterface) it.next(), getApiContext().getContext(), getSession().getAppClock(), getSession().getFileManager()));
                }
                arrayList2 = arrayList;
            } else {
                Iterator it2 = list2.iterator();
                while (true) {
                    if (it2.hasNext()) {
                        if (!((WickrMessageInterface) it2.next()).isRead()) {
                            if (getSession().getSettings().isUnlockMessagesEnabled()) {
                                Timber.INSTANCE.d("Marked " + MessageRepository.markMessageRead$default(getSession().getMessageRepository(), (WickrMessageInterface) CollectionsKt.first(listReversed), getSession().getAppClock().getCurrentTime(), request.getOffset() == 0, false, 8, null) + " messages as read", new Object[0]);
                                MessageRepository messageRepository2 = getSession().getMessageRepository();
                                String convoID3 = request.getConvoID();
                                Intrinsics.checkNotNullExpressionValue(convoID3, "getConvoID(...)");
                                WickrMsgType[] wickrMsgTypeArr2 = (WickrMsgType[]) arrayList5.toArray(new WickrMsgType[0]);
                                List<WickrMessageInterface> listBlockingGet2 = messageRepository2.getMessagesByType(convoID3, (WickrMsgType[]) Arrays.copyOf(wickrMsgTypeArr2, wickrMsgTypeArr2.length), request.getCount(), request.getOffset()).toList().blockingGet();
                                Intrinsics.checkNotNullExpressionValue(listBlockingGet2, "blockingGet(...)");
                                List listReversed2 = CollectionsKt.reversed(CollectionsKt.sortedWith(listBlockingGet2, this.messageComparator));
                                ArrayList arrayList6 = new ArrayList(CollectionsKt.collectionSizeOrDefault(listReversed2, 10));
                                Iterator it3 = listReversed2.iterator();
                                while (it3.hasNext()) {
                                    arrayList6.add(APIUtilsKt.toWickrAPIMessage((WickrMessageInterface) it3.next(), getApiContext().getContext(), getSession().getAppClock(), getSession().getFileManager()));
                                }
                                arrayList2 = arrayList6;
                            }
                        }
                    }
                    List list4 = listReversed;
                    arrayList = new ArrayList(CollectionsKt.collectionSizeOrDefault(list4, 10));
                    it = list4.iterator();
                    while (it.hasNext()) {
                        arrayList.add(APIUtilsKt.toWickrAPIMessage((WickrMessageInterface) it.next(), getApiContext().getContext(), getSession().getAppClock(), getSession().getFileManager()));
                    }
                    arrayList2 = arrayList;
                }
            }
        }
        if (request.hasOffset() && request.getOffset() == 0) {
            WickrConvoInterface wickrConvoInterface = getSession().getConvoRepository().get(request.getConvoID());
            if (wickrConvoInterface == null) {
                Timber.INSTANCE.e("Convo " + request.getConvoID() + " does not exist", new Object[0]);
                return WickrAPIObjects.APIError.INVALID_REQUEST;
            }
            Timber.INSTANCE.i("Sending convo update response before messages result", new Object[0]);
            WickrAPIResponses.WickrAPIResponse wickrAPIResponseBuild = WickrAPIResponses.WickrAPIResponse.newBuilder().setIdentifier(identifier).setConvoUpdateResponse(WickrAPIResponses.ConvoUpdateResponse.newBuilder().setConvo(APIUtilsKt.toWickrAPIConvo(wickrConvoInterface, getApiContext().getContext(), getSession().getAppClock(), getSession().getCallManager(), getSession().getFileManager())).build()).build();
            WickrAPIContext apiContext = getApiContext();
            Intrinsics.checkNotNull(wickrAPIResponseBuild);
            apiContext.sendResponse(app, wickrAPIResponseBuild);
        }
        Timber.INSTANCE.i("Sending get messages result to " + app.getAppInfo().getPackageName(), new Object[0]);
        WickrAPIResponses.WickrAPIResponse wickrAPIResponseBuild2 = WickrAPIResponses.WickrAPIResponse.newBuilder().setIdentifier(identifier).setGetMessagesResponse(WickrAPIResponses.GetMessagesResponse.newBuilder().setConvoID(request.getConvoID()).addAllMessages(arrayList2).build()).build();
        WickrAPIContext apiContext2 = getApiContext();
        Intrinsics.checkNotNull(wickrAPIResponseBuild2);
        apiContext2.sendResponse(app, wickrAPIResponseBuild2);
        return null;
    }

    private final WickrAPIObjects.APIError processUnlockMessageAction(WickrAPIConnection app, String identifier, WickrAPIRequests.UnlockMessageRequest request) {
        if (request.hasMessageID()) {
            String messageID = request.getMessageID();
            Intrinsics.checkNotNullExpressionValue(messageID, "getMessageID(...)");
            if (!StringsKt.isBlank(messageID)) {
                String messageID2 = request.getMessageID();
                Intrinsics.checkNotNullExpressionValue(messageID2, "getMessageID(...)");
                if (StringsKt.toIntOrNull(messageID2) != null) {
                    MessageRepository messageRepository = getSession().getMessageRepository();
                    String messageID3 = request.getMessageID();
                    Intrinsics.checkNotNullExpressionValue(messageID3, "getMessageID(...)");
                    WickrMessageInterface value = messageRepository.getMessage(Integer.parseInt(messageID3)).blockingGet().getValue();
                    if (value != null && !value.isRead()) {
                        Timber.INSTANCE.d("Marked " + MessageRepository.markMessageRead$default(getSession().getMessageRepository(), value, getSession().getAppClock().getCurrentTime(), false, false, 8, null) + " messages as read", new Object[0]);
                        ProtocolStringList lockedMessageIDsList = request.getLockedMessageIDsList();
                        Intrinsics.checkNotNullExpressionValue(lockedMessageIDsList, "getLockedMessageIDsList(...)");
                        ArrayList arrayList = new ArrayList();
                        for (String str : lockedMessageIDsList) {
                            Intrinsics.checkNotNull(str);
                            Integer intOrNull = StringsKt.toIntOrNull(str);
                            if (intOrNull != null) {
                                arrayList.add(intOrNull);
                            }
                        }
                        List mutableList = CollectionsKt.toMutableList((Collection) arrayList);
                        String messageID4 = request.getMessageID();
                        Intrinsics.checkNotNullExpressionValue(messageID4, "getMessageID(...)");
                        mutableList.add(0, Integer.valueOf(Integer.parseInt(messageID4)));
                        Iterator it = mutableList.iterator();
                        while (it.hasNext()) {
                            WickrMessageInterface value2 = getSession().getMessageRepository().getMessage(((Number) it.next()).intValue()).blockingGet().getValue();
                            if (value2 != null) {
                                Timber.INSTANCE.i("Sending message update to " + app.getAppInfo().getPackageName() + " for " + value2.getID() + " in convo " + value2.getVGroupId(), new Object[0]);
                                WickrAPIResponses.WickrAPIResponse wickrAPIResponseBuild = WickrAPIResponses.WickrAPIResponse.newBuilder().setIdentifier(identifier).setMessageUpdateResponse(WickrAPIResponses.MessageUpdateResponse.newBuilder().setConvoID(value2.getVGroupId()).setMessage(APIUtilsKt.toWickrAPIMessage(value2, getApiContext().getContext(), getSession().getAppClock(), getSession().getFileManager())).build()).build();
                                WickrAPIContext apiContext = getApiContext();
                                Intrinsics.checkNotNull(wickrAPIResponseBuild);
                                apiContext.sendResponse(app, wickrAPIResponseBuild);
                            } else {
                                Timber.INSTANCE.e("Could not find updated message", new Object[0]);
                                return WickrAPIObjects.APIError.INTERNAL_ERROR;
                            }
                        }
                        return null;
                    }
                    Timber.INSTANCE.e("Message is null or already read", new Object[0]);
                    return WickrAPIObjects.APIError.INVALID_REQUEST;
                }
            }
        }
        Timber.INSTANCE.e("Missing or invalid messageID in unlock request", new Object[0]);
        return WickrAPIObjects.APIError.INVALID_REQUEST;
    }

    private final WickrAPIObjects.APIError processDeleteMessageAction(WickrAPIConnection app, String identifier, WickrAPIRequests.DeleteMessageRequest request) {
        if (request.hasMessageID()) {
            String messageID = request.getMessageID();
            Intrinsics.checkNotNullExpressionValue(messageID, "getMessageID(...)");
            if (!StringsKt.isBlank(messageID)) {
                String messageID2 = request.getMessageID();
                Intrinsics.checkNotNullExpressionValue(messageID2, "getMessageID(...)");
                if (StringsKt.toIntOrNull(messageID2) != null) {
                    MessageRepository messageRepository = getSession().getMessageRepository();
                    String messageID3 = request.getMessageID();
                    Intrinsics.checkNotNullExpressionValue(messageID3, "getMessageID(...)");
                    WickrMessageInterface value = messageRepository.getMessage(Integer.parseInt(messageID3)).blockingGet().getValue();
                    if (value == null) {
                        Timber.INSTANCE.e("Message is already deleted or does not exist", new Object[0]);
                        return WickrAPIObjects.APIError.INVALID_REQUEST;
                    }
                    if (!DELETABLE_MESSAGE_CLASSES.contains(value.getMsgClass())) {
                        Timber.INSTANCE.e("Unsupported message class: " + value.getMsgClass(), new Object[0]);
                        return WickrAPIObjects.APIError.INVALID_REQUEST;
                    }
                    if (!DELETABLE_SENT_STATES.contains(value.getSentState())) {
                        Timber.INSTANCE.e("Unable to delete message with state: " + value.getSentState().name(), new Object[0]);
                        return WickrAPIObjects.APIError.INVALID_REQUEST;
                    }
                    if (value.getSentState() != WickrMessage.SentState.SENT) {
                        Timber.INSTANCE.i("Deleting message " + value.getID() + " locally", new Object[0]);
                        if (value.delete()) {
                            return null;
                        }
                        return WickrAPIObjects.APIError.INTERNAL_ERROR;
                    }
                    SecureRoomManager.RoomOperation.Builder builder = new SecureRoomManager.RoomOperation.Builder().setMessageServerID(value.getSrvMsgID()).setvGroupID(value.getVGroupId());
                    if (value.isInbox()) {
                        Timber.INSTANCE.i("Deleting message " + value.getID() + " from your own devices", new Object[0]);
                        builder.setOperation(SecureRoomManager.Operation.DELETE_MESSAGE);
                    } else {
                        Timber.INSTANCE.i("Recalling message " + value.getID() + " from all users devices", new Object[0]);
                        builder.setOperation(SecureRoomManager.Operation.RECALL_MESSAGE);
                    }
                    if (getSession().getRoomStateManager().processRoomOperationEvent(builder.build())) {
                        return null;
                    }
                    return WickrAPIObjects.APIError.INTERNAL_ERROR;
                }
            }
        }
        Timber.INSTANCE.e("Invalid messageID in unlock request", new Object[0]);
        return WickrAPIObjects.APIError.INVALID_REQUEST;
    }
}
