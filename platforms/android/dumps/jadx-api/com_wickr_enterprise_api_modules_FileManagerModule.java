package com.wickr.enterprise.api.modules;

import android.net.Uri;
import com.mywickr.interfaces.WickrMessageInterface;
import com.mywickr.wickr.WickrMsgClass;
import com.mywickr.wickr.WickrUser;
import com.wickr.android.api.WickrAPI;
import com.wickr.android.api.WickrAPIObjects;
import com.wickr.android.api.WickrAPIRequests;
import com.wickr.android.api.WickrAPIResponses;
import com.wickr.enterprise.api.APIUtilsKt;
import com.wickr.enterprise.api.WickrAPIContext;
import com.wickr.enterprise.api.connections.ApprovedAPIConnection;
import com.wickr.enterprise.api.connections.WickrAPIConnection;
import com.wickr.enterprise.util.WickrMessageExtensionsKt;
import com.wickr.files.FileDecryptionRequest;
import com.wickr.files.FileManager;
import com.wickr.files.FileState;
import com.wickr.proto.MessageProto;
import com.wickr.repository.MessageRepository;
import com.wickr.session.Session;
import com.wickr.util.FileUtilsKt;
import io.reactivex.rxjava3.functions.Consumer;
import io.reactivex.rxjava3.schedulers.Schedulers;
import io.sentry.SentryBaseEvent;
import io.sentry.cache.EnvelopeCache;
import io.sentry.protocol.App;
import io.sentry.protocol.Request;
import io.sentry.protocol.ViewHierarchyNode;
import java.io.File;
import java.util.List;
import java.util.concurrent.ConcurrentHashMap;
import kotlin.Metadata;
import kotlin.NoWhenBranchMatchedException;
import kotlin.Pair;
import kotlin.collections.CollectionsKt;
import kotlin.coroutines.Continuation;
import kotlin.jvm.internal.DefaultConstructorMarker;
import kotlin.jvm.internal.Intrinsics;
import kotlin.text.StringsKt;
import timber.log.Timber;

/* JADX INFO: compiled from: FileManagerModule.kt */
/* JADX INFO: loaded from: classes4.dex */
@Metadata(d1 = {"\u0000V\n\u0002\u0018\u0002\n\u0002\u0018\u0002\n\u0000\n\u0002\u0018\u0002\n\u0000\n\u0002\u0018\u0002\n\u0002\b\u0003\n\u0002\u0010 \n\u0002\u0010\u000e\n\u0002\b\u0003\n\u0002\u0018\u0002\n\u0002\u0018\u0002\n\u0000\n\u0002\u0010\t\n\u0000\n\u0002\u0018\u0002\n\u0000\n\u0002\u0018\u0002\n\u0000\n\u0002\u0018\u0002\n\u0002\b\u0003\n\u0002\u0018\u0002\n\u0000\n\u0002\u0010\u0002\n\u0002\b\u0004\b\u0007\u0018\u0000 \u001f2\u00020\u0001:\u0002\u001f B\u0017\u0012\u0006\u0010\u0002\u001a\u00020\u0003\u0012\u0006\u0010\u0004\u001a\u00020\u0005¢\u0006\u0004\b\u0006\u0010\u0007J \u0010\u0012\u001a\u0004\u0018\u00010\u00132\u0006\u0010\u0014\u001a\u00020\u00152\u0006\u0010\u0016\u001a\u00020\u0017H\u0096@¢\u0006\u0002\u0010\u0018J\"\u0010\u0019\u001a\u0004\u0018\u00010\u00132\u0006\u0010\u0014\u001a\u00020\u00152\u0006\u0010\u001a\u001a\u00020\n2\u0006\u0010\u0016\u001a\u00020\u001bH\u0002J\u0010\u0010\u001c\u001a\u00020\u001d2\u0006\u0010\u001e\u001a\u00020\nH\u0002R\u001a\u0010\b\u001a\b\u0012\u0004\u0012\u00020\n0\tX\u0096\u0004¢\u0006\b\n\u0000\u001a\u0004\b\u000b\u0010\fR\u001a\u0010\r\u001a\u000e\u0012\u0004\u0012\u00020\n\u0012\u0004\u0012\u00020\u000f0\u000eX\u0082\u0004¢\u0006\u0002\n\u0000R\u001a\u0010\u0010\u001a\u000e\u0012\u0004\u0012\u00020\n\u0012\u0004\u0012\u00020\u00110\u000eX\u0082\u0004¢\u0006\u0002\n\u0000¨\u0006!"}, d2 = {"Lcom/wickr/enterprise/api/modules/FileManagerModule;", "Lcom/wickr/enterprise/api/modules/WickrAPIModule;", "apiContext", "Lcom/wickr/enterprise/api/WickrAPIContext;", EnvelopeCache.PREFIX_CURRENT_SESSION_FILE, "Lcom/wickr/session/Session;", "<init>", "(Lcom/wickr/enterprise/api/WickrAPIContext;Lcom/wickr/session/Session;)V", "requests", "", "", "getRequests", "()Ljava/util/List;", "trackedFiles", "Ljava/util/concurrent/ConcurrentHashMap;", "Lcom/wickr/enterprise/api/modules/FileManagerModule$FileRequest;", "progressEvents", "", "processRequest", "Lcom/wickr/android/api/WickrAPIObjects$APIError;", App.TYPE, "Lcom/wickr/enterprise/api/connections/WickrAPIConnection;", SentryBaseEvent.JsonKeys.REQUEST, "Lcom/wickr/android/api/WickrAPIRequests$WickrAPIRequest;", "(Lcom/wickr/enterprise/api/connections/WickrAPIConnection;Lcom/wickr/android/api/WickrAPIRequests$WickrAPIRequest;Lkotlin/coroutines/Continuation;)Ljava/lang/Object;", "processFileDownloadRequest", ViewHierarchyNode.JsonKeys.IDENTIFIER, "Lcom/wickr/android/api/WickrAPIRequests$FileDownloadRequest;", "sendFileUpdate", "", "guid", "Companion", "FileRequest", "app_awsRelease"}, k = 1, mv = {2, 2, 0}, xi = 48)
public final class FileManagerModule extends WickrAPIModule {
    private static final long FILE_PROGRESS_TIMEOUT = 1000;
    private static FileManagerModule module;
    private final ConcurrentHashMap<String, Long> progressEvents;
    private final List<String> requests;
    private final ConcurrentHashMap<String, FileRequest> trackedFiles;

    /* JADX INFO: renamed from: Companion, reason: from kotlin metadata */
    public static final Companion INSTANCE = new Companion(null);
    public static final int $stable = 8;

    /* JADX INFO: compiled from: FileManagerModule.kt */
    @Metadata(k = 3, mv = {2, 2, 0}, xi = 48)
    public static final /* synthetic */ class WhenMappings {
        public static final /* synthetic */ int[] $EnumSwitchMapping$0;

        static {
            int[] iArr = new int[FileState.values().length];
            try {
                iArr[FileState.Decrypted.ordinal()] = 1;
            } catch (NoSuchFieldError unused) {
            }
            try {
                iArr[FileState.NeedsDownload.ordinal()] = 2;
            } catch (NoSuchFieldError unused2) {
            }
            try {
                iArr[FileState.FailedDownload.ordinal()] = 3;
            } catch (NoSuchFieldError unused3) {
            }
            try {
                iArr[FileState.Encrypted.ordinal()] = 4;
            } catch (NoSuchFieldError unused4) {
            }
            try {
                iArr[FileState.FailedDecrypting.ordinal()] = 5;
            } catch (NoSuchFieldError unused5) {
            }
            try {
                iArr[FileState.Downloading.ordinal()] = 6;
            } catch (NoSuchFieldError unused6) {
            }
            try {
                iArr[FileState.Decrypting.ordinal()] = 7;
            } catch (NoSuchFieldError unused7) {
            }
            try {
                iArr[FileState.Encrypting.ordinal()] = 8;
            } catch (NoSuchFieldError unused8) {
            }
            try {
                iArr[FileState.Uploading.ordinal()] = 9;
            } catch (NoSuchFieldError unused9) {
            }
            try {
                iArr[FileState.FailedEncrypting.ordinal()] = 10;
            } catch (NoSuchFieldError unused10) {
            }
            try {
                iArr[FileState.FailedUpload.ordinal()] = 11;
            } catch (NoSuchFieldError unused11) {
            }
            $EnumSwitchMapping$0 = iArr;
        }
    }

    /* JADX WARN: 'super' call moved to the top of the method (can break code semantics) */
    public FileManagerModule(WickrAPIContext apiContext, final Session session) {
        super(apiContext, session);
        Intrinsics.checkNotNullParameter(apiContext, "apiContext");
        Intrinsics.checkNotNullParameter(session, "session");
        this.requests = CollectionsKt.listOf("FILEDOWNLOADREQUEST");
        this.trackedFiles = new ConcurrentHashMap<>();
        this.progressEvents = new ConcurrentHashMap<>();
        module = this;
        session.getFileManager().stateEvents().subscribeOn(Schedulers.io()).observeOn(Schedulers.io()).subscribe(new Consumer() { // from class: com.wickr.enterprise.api.modules.FileManagerModule.1
            @Override // io.reactivex.rxjava3.functions.Consumer
            public final void accept(Pair<String, ? extends FileState> it) {
                Intrinsics.checkNotNullParameter(it, "it");
                if (FileManagerModule.this.trackedFiles.keySet().contains(it.getFirst())) {
                    Timber.INSTANCE.d("Received file event: " + it.getSecond().name() + " for " + ((Object) it.getFirst()), new Object[0]);
                    FileManagerModule.this.sendFileUpdate(it.getFirst());
                }
            }
        });
        session.getFileManager().progressEvents().subscribeOn(Schedulers.io()).observeOn(Schedulers.io()).subscribe(new Consumer() { // from class: com.wickr.enterprise.api.modules.FileManagerModule.2
            @Override // io.reactivex.rxjava3.functions.Consumer
            public final void accept(Pair<String, Long> it) {
                Intrinsics.checkNotNullParameter(it, "it");
                FileState fileState = session.getFileManager().getFileState(it.getFirst());
                if (fileState == FileState.Downloading || fileState == FileState.Uploading) {
                    Long l = (Long) this.progressEvents.get(it.getFirst());
                    if (System.currentTimeMillis() - (l != null ? l.longValue() : 0L) > 1000) {
                        Timber.INSTANCE.d("Received file progress event: " + it.getSecond() + " for " + ((Object) it.getFirst()), new Object[0]);
                        if (this.trackedFiles.keySet().contains(it.getFirst())) {
                            this.sendFileUpdate(it.getFirst());
                        }
                        this.progressEvents.put(it.getFirst(), Long.valueOf(System.currentTimeMillis()));
                    }
                }
            }
        });
    }

    /* JADX INFO: compiled from: FileManagerModule.kt */
    @Metadata(d1 = {"\u00002\n\u0002\u0018\u0002\n\u0002\u0010\u0000\n\u0002\b\u0003\n\u0002\u0010\t\n\u0000\n\u0002\u0018\u0002\n\u0000\n\u0002\u0010\u0002\n\u0000\n\u0002\u0018\u0002\n\u0000\n\u0002\u0010\u000e\n\u0002\b\u0002\n\u0002\u0010\b\n\u0000\b\u0086\u0003\u0018\u00002\u00020\u0001B\t\b\u0002¢\u0006\u0004\b\u0002\u0010\u0003J&\u0010\b\u001a\u00020\t2\u0006\u0010\n\u001a\u00020\u000b2\u0006\u0010\f\u001a\u00020\r2\u0006\u0010\u000e\u001a\u00020\r2\u0006\u0010\u000f\u001a\u00020\u0010R\u000e\u0010\u0004\u001a\u00020\u0005X\u0082T¢\u0006\u0002\n\u0000R\u000e\u0010\u0006\u001a\u00020\u0007X\u0082.¢\u0006\u0002\n\u0000¨\u0006\u0011"}, d2 = {"Lcom/wickr/enterprise/api/modules/FileManagerModule$Companion;", "", "<init>", "()V", "FILE_PROGRESS_TIMEOUT", "", "module", "Lcom/wickr/enterprise/api/modules/FileManagerModule;", "trackFile", "", App.TYPE, "Lcom/wickr/enterprise/api/connections/WickrAPIConnection;", ViewHierarchyNode.JsonKeys.IDENTIFIER, "", "guid", "messageID", "", "app_awsRelease"}, k = 1, mv = {2, 2, 0}, xi = 48)
    public static final class Companion {
        public /* synthetic */ Companion(DefaultConstructorMarker defaultConstructorMarker) {
            this();
        }

        private Companion() {
        }

        public final void trackFile(WickrAPIConnection app, String identifier, String guid, int messageID) {
            Intrinsics.checkNotNullParameter(app, "app");
            Intrinsics.checkNotNullParameter(identifier, "identifier");
            Intrinsics.checkNotNullParameter(guid, "guid");
            FileManagerModule fileManagerModule = FileManagerModule.module;
            if (fileManagerModule == null) {
                Intrinsics.throwUninitializedPropertyAccessException("module");
                fileManagerModule = null;
            }
            ConcurrentHashMap concurrentHashMap = fileManagerModule.trackedFiles;
            String packageName = app.getAppInfo().getPackageName();
            Intrinsics.checkNotNullExpressionValue(packageName, "getPackageName(...)");
            concurrentHashMap.put(guid, new FileRequest(packageName, identifier, messageID));
            Timber.INSTANCE.d("Tracking file " + guid + " for package " + app.getAppInfo().getPackageName(), new Object[0]);
        }
    }

    /* JADX INFO: compiled from: FileManagerModule.kt */
    @Metadata(d1 = {"\u0000\"\n\u0002\u0018\u0002\n\u0002\u0010\u0000\n\u0000\n\u0002\u0010\u000e\n\u0002\b\u0002\n\u0002\u0010\b\n\u0002\b\f\n\u0002\u0010\u000b\n\u0002\b\u0004\b\u0082\b\u0018\u00002\u00020\u0001B\u001f\u0012\u0006\u0010\u0002\u001a\u00020\u0003\u0012\u0006\u0010\u0004\u001a\u00020\u0003\u0012\u0006\u0010\u0005\u001a\u00020\u0006¢\u0006\u0004\b\u0007\u0010\bJ\t\u0010\u000e\u001a\u00020\u0003HÆ\u0003J\t\u0010\u000f\u001a\u00020\u0003HÆ\u0003J\t\u0010\u0010\u001a\u00020\u0006HÆ\u0003J'\u0010\u0011\u001a\u00020\u00002\b\b\u0002\u0010\u0002\u001a\u00020\u00032\b\b\u0002\u0010\u0004\u001a\u00020\u00032\b\b\u0002\u0010\u0005\u001a\u00020\u0006HÆ\u0001J\u0013\u0010\u0012\u001a\u00020\u00132\b\u0010\u0014\u001a\u0004\u0018\u00010\u0001HÖ\u0003J\t\u0010\u0015\u001a\u00020\u0006HÖ\u0001J\t\u0010\u0016\u001a\u00020\u0003HÖ\u0001R\u0011\u0010\u0002\u001a\u00020\u0003¢\u0006\b\n\u0000\u001a\u0004\b\t\u0010\nR\u0011\u0010\u0004\u001a\u00020\u0003¢\u0006\b\n\u0000\u001a\u0004\b\u000b\u0010\nR\u0011\u0010\u0005\u001a\u00020\u0006¢\u0006\b\n\u0000\u001a\u0004\b\f\u0010\r¨\u0006\u0017"}, d2 = {"Lcom/wickr/enterprise/api/modules/FileManagerModule$FileRequest;", "", WickrAPI.EXTRA_PACKAGE_NAME, "", ViewHierarchyNode.JsonKeys.IDENTIFIER, "messageID", "", "<init>", "(Ljava/lang/String;Ljava/lang/String;I)V", "getPackageName", "()Ljava/lang/String;", "getIdentifier", "getMessageID", "()I", "component1", "component2", "component3", "copy", "equals", "", Request.JsonKeys.OTHER, "hashCode", "toString", "app_awsRelease"}, k = 1, mv = {2, 2, 0}, xi = 48)
    private static final /* data */ class FileRequest {
        private final String identifier;
        private final int messageID;
        private final String packageName;

        public static /* synthetic */ FileRequest copy$default(FileRequest fileRequest, String str, String str2, int i, int i2, Object obj) {
            if ((i2 & 1) != 0) {
                str = fileRequest.packageName;
            }
            if ((i2 & 2) != 0) {
                str2 = fileRequest.identifier;
            }
            if ((i2 & 4) != 0) {
                i = fileRequest.messageID;
            }
            return fileRequest.copy(str, str2, i);
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
        public final int getMessageID() {
            return this.messageID;
        }

        public final FileRequest copy(String packageName, String identifier, int messageID) {
            Intrinsics.checkNotNullParameter(packageName, "packageName");
            Intrinsics.checkNotNullParameter(identifier, "identifier");
            return new FileRequest(packageName, identifier, messageID);
        }

        public boolean equals(Object other) {
            if (this == other) {
                return true;
            }
            if (!(other instanceof FileRequest)) {
                return false;
            }
            FileRequest fileRequest = (FileRequest) other;
            return Intrinsics.areEqual(this.packageName, fileRequest.packageName) && Intrinsics.areEqual(this.identifier, fileRequest.identifier) && this.messageID == fileRequest.messageID;
        }

        public int hashCode() {
            return (((this.packageName.hashCode() * 31) + this.identifier.hashCode()) * 31) + Integer.hashCode(this.messageID);
        }

        public String toString() {
            return "FileRequest(packageName=" + this.packageName + ", identifier=" + this.identifier + ", messageID=" + this.messageID + ")";
        }

        public FileRequest(String packageName, String identifier, int i) {
            Intrinsics.checkNotNullParameter(packageName, "packageName");
            Intrinsics.checkNotNullParameter(identifier, "identifier");
            this.packageName = packageName;
            this.identifier = identifier;
            this.messageID = i;
        }

        public final String getPackageName() {
            return this.packageName;
        }

        public final String getIdentifier() {
            return this.identifier;
        }

        public final int getMessageID() {
            return this.messageID;
        }
    }

    @Override // com.wickr.enterprise.api.modules.WickrAPIModule
    public List<String> getRequests() {
        return this.requests;
    }

    @Override // com.wickr.enterprise.api.modules.WickrAPIModule
    public Object processRequest(WickrAPIConnection wickrAPIConnection, WickrAPIRequests.WickrAPIRequest wickrAPIRequest, Continuation<? super WickrAPIObjects.APIError> continuation) {
        Timber.INSTANCE.i("Processing request " + wickrAPIRequest.getRequestCase().name(), new Object[0]);
        if (!wickrAPIRequest.hasFileDownloadRequest()) {
            return WickrAPIObjects.APIError.INTERNAL_ERROR;
        }
        String identifier = wickrAPIRequest.getIdentifier();
        Intrinsics.checkNotNullExpressionValue(identifier, "getIdentifier(...)");
        WickrAPIRequests.FileDownloadRequest fileDownloadRequest = wickrAPIRequest.getFileDownloadRequest();
        Intrinsics.checkNotNullExpressionValue(fileDownloadRequest, "getFileDownloadRequest(...)");
        return processFileDownloadRequest(wickrAPIConnection, identifier, fileDownloadRequest);
    }

    private final WickrAPIObjects.APIError processFileDownloadRequest(WickrAPIConnection app, String identifier, WickrAPIRequests.FileDownloadRequest request) {
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
                        Timber.INSTANCE.e("Message " + request.getMessageID() + " does not exist", new Object[0]);
                        return WickrAPIObjects.APIError.INVALID_REQUEST;
                    }
                    if (value.getMsgClass() != WickrMsgClass.WICKR_MSGCLASS_FILE) {
                        Timber.INSTANCE.e("Message " + value.getSrvMsgID() + " is not a file message", new Object[0]);
                        return WickrAPIObjects.APIError.INVALID_REQUEST;
                    }
                    MessageProto.MessageBody.File.Metadata fileMeta = WickrMessageExtensionsKt.getFileMeta(value);
                    Companion companion = INSTANCE;
                    String guid = fileMeta.getGuid();
                    Intrinsics.checkNotNullExpressionValue(guid, "getGuid(...)");
                    companion.trackFile(app, identifier, guid, value.getID());
                    FileManager fileManager = getSession().getFileManager();
                    String guid2 = fileMeta.getGuid();
                    Intrinsics.checkNotNullExpressionValue(guid2, "getGuid(...)");
                    FileState fileState = fileManager.getFileState(guid2);
                    switch (WhenMappings.$EnumSwitchMapping$0[fileState.ordinal()]) {
                        case 1:
                            Timber.INSTANCE.i("Sending immediate update for " + fileMeta.getGuid(), new Object[0]);
                            String guid3 = fileMeta.getGuid();
                            Intrinsics.checkNotNullExpressionValue(guid3, "getGuid(...)");
                            sendFileUpdate(guid3);
                            return null;
                        case 2:
                        case 3:
                            Timber.INSTANCE.i("Attempting to download " + fileMeta.getGuid(), new Object[0]);
                            WickrUser userWithServerIDHash = fileMeta.hasUploadedByUser() ? WickrUser.getUserWithServerIDHash(fileMeta.getUploadedByUser()) : null;
                            String guid4 = fileMeta.getGuid();
                            Intrinsics.checkNotNullExpressionValue(guid4, "getGuid(...)");
                            boolean zDownloadFile = getSession().getFileManager().downloadFile(userWithServerIDHash, guid4, fileMeta.getFileHash(), fileMeta.getDomain(), Long.valueOf(fileMeta.getSize()));
                            Timber.INSTANCE.i("Downloaded file " + fileMeta.getGuid() + ": " + zDownloadFile, new Object[0]);
                            if (zDownloadFile) {
                                Timber.INSTANCE.i("Attempting to decrypt " + fileMeta.getGuid(), new Object[0]);
                                File decryptedFile = FileUtilsKt.getDecryptedFile(getApiContext().getContext(), fileMeta);
                                FileManager fileManager2 = getSession().getFileManager();
                                String guid5 = fileMeta.getGuid();
                                Intrinsics.checkNotNullExpressionValue(guid5, "getGuid(...)");
                                byte[] byteArray = fileMeta.getKey().toByteArray();
                                Intrinsics.checkNotNullExpressionValue(byteArray, "toByteArray(...)");
                                String absolutePath = FileUtilsKt.getDecryptedFileDirectory(getApiContext().getContext()).getAbsolutePath();
                                Intrinsics.checkNotNullExpressionValue(absolutePath, "getAbsolutePath(...)");
                                String name = decryptedFile.getName();
                                Intrinsics.checkNotNullExpressionValue(name, "getName(...)");
                                Timber.INSTANCE.i("Decrypted file " + fileMeta.getGuid() + ": " + fileManager2.decryptFile(new FileDecryptionRequest(guid5, byteArray, absolutePath, name, true)).getSuccess(), new Object[0]);
                            }
                            return null;
                        case 4:
                        case 5:
                            Timber.INSTANCE.i("Attempting to decrypt " + fileMeta.getGuid(), new Object[0]);
                            File decryptedFile2 = FileUtilsKt.getDecryptedFile(getApiContext().getContext(), fileMeta);
                            FileManager fileManager3 = getSession().getFileManager();
                            String guid6 = fileMeta.getGuid();
                            Intrinsics.checkNotNullExpressionValue(guid6, "getGuid(...)");
                            byte[] byteArray2 = fileMeta.getKey().toByteArray();
                            Intrinsics.checkNotNullExpressionValue(byteArray2, "toByteArray(...)");
                            String absolutePath2 = FileUtilsKt.getDecryptedFileDirectory(getApiContext().getContext()).getAbsolutePath();
                            Intrinsics.checkNotNullExpressionValue(absolutePath2, "getAbsolutePath(...)");
                            String name2 = decryptedFile2.getName();
                            Intrinsics.checkNotNullExpressionValue(name2, "getName(...)");
                            Timber.INSTANCE.i("Decrypted file " + fileMeta.getGuid() + ": " + fileManager3.decryptFile(new FileDecryptionRequest(guid6, byteArray2, absolutePath2, name2, true)).getSuccess(), new Object[0]);
                            return null;
                        case 6:
                        case 7:
                        case 8:
                        case 9:
                        case 10:
                        case 11:
                            Timber.INSTANCE.i("File state for " + fileMeta.getGuid() + " is " + fileState + ", ignoring", new Object[0]);
                            return null;
                        default:
                            throw new NoWhenBranchMatchedException();
                    }
                }
            }
        }
        Timber.INSTANCE.e("Missing message ID", new Object[0]);
        return WickrAPIObjects.APIError.INVALID_REQUEST;
    }

    /* JADX INFO: Access modifiers changed from: private */
    public final void sendFileUpdate(String guid) {
        ApprovedAPIConnection connection;
        WickrMessageInterface value;
        FileRequest fileRequest = this.trackedFiles.get(guid);
        if (fileRequest == null || (connection = getApiContext().getConnectionManager().getConnection(fileRequest.getPackageName())) == null || (value = getSession().getMessageRepository().getMessage(fileRequest.getMessageID()).blockingGet().getValue()) == null) {
            return;
        }
        Timber.INSTANCE.i("Sending file update for guid " + guid + " to " + fileRequest.getPackageName(), new Object[0]);
        WickrAPIObjects.WickrMessage wickrAPIMessage = APIUtilsKt.toWickrAPIMessage(value, getApiContext().getContext(), getSession().getAppClock(), getSession().getFileManager());
        if (wickrAPIMessage.getFileMessage().hasUri()) {
            Timber.INSTANCE.i("Granting file read permission to " + connection.getAppInfo().getPackageName(), new Object[0]);
            getApiContext().getContext().grantUriPermission(connection.getAppInfo().getPackageName(), Uri.parse(wickrAPIMessage.getFileMessage().getUri()), 1);
        }
        WickrAPIResponses.WickrAPIResponse wickrAPIResponseBuild = WickrAPIResponses.WickrAPIResponse.newBuilder().setIdentifier(fileRequest.getIdentifier()).setMessageUpdateResponse(WickrAPIResponses.MessageUpdateResponse.newBuilder().setConvoID(value.getVGroupId()).setMessage(wickrAPIMessage).build()).build();
        Intrinsics.checkNotNull(wickrAPIResponseBuild);
        getApiContext().sendResponse(connection, wickrAPIResponseBuild);
    }
}
