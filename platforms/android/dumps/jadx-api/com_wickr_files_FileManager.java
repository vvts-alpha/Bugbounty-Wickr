package com.wickr.files;

import android.app.DownloadManager;
import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Context;
import android.content.res.AssetFileDescriptor;
import android.database.Cursor;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.media.MediaMetadataRetriever;
import android.net.Uri;
import android.os.StatFs;
import android.os.storage.StorageManager;
import android.provider.BaseColumns;
import androidx.core.content.FileProvider;
import androidx.core.view.PointerIconCompat;
import com.mywickr.WickrCore;
import com.mywickr.interfaces.WickrUserInterface;
import com.mywickr.wickr.WickrDBAdapter;
import com.mywickr.wickr.WickrS3AccessInfo;
import com.mywickr.wickr.WickrUserValidator;
import com.mywickr.wickr.WickrUserValidatorResult;
import com.wickr.android.metrics.eventData.FileCacheCleanupEventData;
import com.wickr.bugreporter.WickrBugReporter;
import com.wickr.networking.NetworkClient;
import com.wickr.networking.NetworkStatusMonitor;
import com.wickr.networking.WickrAmazonS3FileAPI;
import com.wickr.networking.WickrFileAPI;
import com.wickr.networking.WickrFileProxyAPI;
import com.wickr.networking.model.FileProxyUploadResponse;
import com.wickr.networking.model.WickrResult;
import com.wickr.networking.proxy.Vendor1Proxy;
import com.wickr.session.Session;
import com.wickr.util.ExtensionsKt;
import com.wickr.util.FileType;
import com.wickr.util.FileUtilsKt;
import dev.zacsweers.metro.AppScope;
import dev.zacsweers.metro.Binds;
import dev.zacsweers.metro.ContributesBinding;
import dev.zacsweers.metro.Inject;
import dev.zacsweers.metro.Provider;
import dev.zacsweers.metro.SingleIn;
import dev.zacsweers.metro.internal.CallableMetadata;
import dev.zacsweers.metro.internal.Factory;
import dev.zacsweers.metro.internal.MetroContribution;
import io.reactivex.rxjava3.core.Notification;
import io.reactivex.rxjava3.core.Observable;
import io.reactivex.rxjava3.functions.Consumer;
import io.reactivex.rxjava3.schedulers.Schedulers;
import io.reactivex.rxjava3.subjects.BehaviorSubject;
import io.reactivex.rxjava3.subjects.PublishSubject;
import io.sentry.SentryBaseEvent;
import io.sentry.protocol.SentryThread;
import io.sentry.rrweb.RRWebVideoEvent;
import java.io.File;
import java.io.FileFilter;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.Date;
import java.util.HashMap;
import java.util.Iterator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.TimeUnit;
import kotlin.Deprecated;
import kotlin.DeprecationLevel;
import kotlin.Metadata;
import kotlin.NoWhenBranchMatchedException;
import kotlin.Pair;
import kotlin.TuplesKt;
import kotlin.Unit;
import kotlin.collections.ArraysKt;
import kotlin.collections.CollectionsKt;
import kotlin.collections.MapsKt;
import kotlin.comparisons.ComparisonsKt;
import kotlin.io.CloseableKt;
import kotlin.io.FilesKt;
import kotlin.jvm.functions.Function0;
import kotlin.jvm.functions.Function2;
import kotlin.jvm.internal.DefaultConstructorMarker;
import kotlin.jvm.internal.Intrinsics;
import kotlin.jvm.internal.Ref;
import kotlin.jvm.internal.StringCompanionObject;
import kotlin.ranges.RangesKt;
import kotlin.text.StringsKt;
import okhttp3.OkHttpClient;
import timber.log.Timber;

/* JADX INFO: compiled from: FileManager.kt */
/* JADX INFO: loaded from: classes5.dex */
@SingleIn(scope = AppScope.class)
@Inject
@Metadata(d1 = {"\u0000\u008a\u0002\n\u0002\u0018\u0002\n\u0002\u0018\u0002\n\u0000\n\u0002\u0018\u0002\n\u0000\n\u0002\u0018\u0002\n\u0000\n\u0002\u0018\u0002\n\u0000\n\u0002\u0018\u0002\n\u0000\n\u0002\u0018\u0002\n\u0000\n\u0002\u0018\u0002\n\u0000\n\u0002\u0018\u0002\n\u0002\b\u0003\n\u0002\u0018\u0002\n\u0000\n\u0002\u0018\u0002\n\u0000\n\u0002\u0018\u0002\n\u0000\n\u0002\u0010\u000b\n\u0002\b\u0002\n\u0002\u0010\u000e\n\u0000\n\u0002\u0018\u0002\n\u0002\u0018\u0002\n\u0000\n\u0002\u0018\u0002\n\u0002\u0018\u0002\n\u0000\n\u0002\u0018\u0002\n\u0000\n\u0002\u0018\u0002\n\u0002\u0018\u0002\n\u0000\n\u0002\u0018\u0002\n\u0002\u0010\t\n\u0000\n\u0002\u0018\u0002\n\u0002\b\u0002\n\u0002\u0018\u0002\n\u0002\b\u0006\n\u0002\u0010\u0002\n\u0002\b\u0002\n\u0002\u0018\u0002\n\u0002\b\u0004\n\u0002\u0018\u0002\n\u0000\n\u0002\u0018\u0002\n\u0002\b\u0006\n\u0002\u0018\u0002\n\u0000\n\u0002\u0018\u0002\n\u0000\n\u0002\u0018\u0002\n\u0002\u0018\u0002\n\u0002\b\u0003\n\u0002\u0018\u0002\n\u0000\n\u0002\u0018\u0002\n\u0002\u0018\u0002\n\u0002\b\u0007\n\u0002\u0018\u0002\n\u0002\b\u0005\n\u0002\u0018\u0002\n\u0002\u0018\u0002\n\u0000\n\u0002\u0018\u0002\n\u0000\n\u0002\u0018\u0002\n\u0000\n\u0002\u0018\u0002\n\u0002\b\u0005\n\u0002\u0018\u0002\n\u0002\b\"\b\u0007\u0018\u00002\u00020\u0001:\u0006\u008c\u0001\u008d\u0001\u008e\u0001BA\u0012\u0006\u0010\u0002\u001a\u00020\u0003\u0012\u0006\u0010\u0004\u001a\u00020\u0005\u0012\u0006\u0010\u0006\u001a\u00020\u0007\u0012\u0006\u0010\b\u001a\u00020\t\u0012\u0006\u0010\n\u001a\u00020\u000b\u0012\b\u0010\f\u001a\u0004\u0018\u00010\r\u0012\u0006\u0010\u000e\u001a\u00020\u000f¢\u0006\u0004\b\u0010\u0010\u0011J-\u00101\u001a\u00020\u00192\u0006\u00102\u001a\u00020\u00172\n\b\u0002\u00103\u001a\u0004\u0018\u00010\u00192\n\b\u0002\u0010\u001b\u001a\u0004\u0018\u00010\u001cH\u0007¢\u0006\u0002\u00104J\b\u00105\u001a\u000206H\u0002J\b\u00107\u001a\u00020*H\u0002J\u0010\u00108\u001a\u0002092\u0006\u0010:\u001a\u00020*H\u0016J\u0010\u0010;\u001a\u00020*2\u0006\u0010<\u001a\u00020*H\u0016J\u0018\u0010 \u001a\u0014\u0012\u0010\u0012\u000e\u0012\u0004\u0012\u00020\u001c\u0012\u0004\u0012\u00020\u001f0\"0&J\u0018\u0010+\u001a\u0014\u0012\u0010\u0012\u000e\u0012\u0004\u0012\u00020\u001c\u0012\u0004\u0012\u00020*0\"0&J\u000e\u0010=\u001a\u00020>2\u0006\u0010?\u001a\u00020@J\u0012\u0010A\u001a\u00020/2\n\b\u0002\u0010B\u001a\u0004\u0018\u00010\u001cJ\u000e\u0010A\u001a\u00020/2\u0006\u0010?\u001a\u00020@J\u0006\u0010C\u001a\u000206J\u000e\u0010D\u001a\u00020>2\u0006\u0010E\u001a\u00020/J\u000e\u0010F\u001a\u00020G2\u0006\u0010H\u001a\u00020IJ\u000e\u0010J\u001a\u00020K2\u0006\u0010H\u001a\u00020LJ\u000e\u0010M\u001a\u00020\u00192\u0006\u0010N\u001a\u00020\u001cJ\u000e\u0010O\u001a\u00020P2\u0006\u0010N\u001a\u00020\u001cJ \u0010Q\u001a\n\u0012\u0004\u0012\u00020S\u0018\u00010R2\u0006\u0010N\u001a\u00020\u001c2\b\u0010T\u001a\u0004\u0018\u00010\u001cJ\u001a\u0010U\u001a\u0004\u0018\u00010S2\u0006\u0010N\u001a\u00020\u001c2\b\u0010T\u001a\u0004\u0018\u00010\u001cJ\u0018\u0010V\u001a\u0002062\u0006\u0010W\u001a\u00020\u001c2\u0006\u0010X\u001a\u00020\u001cH\u0002J?\u0010Y\u001a\u00020\u00192\b\u0010Z\u001a\u0004\u0018\u00010[2\u0006\u0010N\u001a\u00020\u001c2\b\u0010\\\u001a\u0004\u0018\u00010\u001c2\n\b\u0002\u0010]\u001a\u0004\u0018\u00010\u001c2\n\b\u0002\u0010^\u001a\u0004\u0018\u00010*¢\u0006\u0002\u0010_J\u000e\u0010`\u001a\u00020a2\u0006\u0010H\u001a\u00020bJ\u000e\u0010c\u001a\u00020\u00192\u0006\u0010H\u001a\u00020dJ0\u0010e\u001a\u00020f2\u0006\u0010E\u001a\u00020/2\u0006\u0010g\u001a\u00020h2\u0006\u0010i\u001a\u00020*2\u0006\u0010j\u001a\u00020\u00192\u0006\u0010k\u001a\u00020\u0019H\u0002J\u0018\u0010l\u001a\u0002062\u0006\u0010m\u001a\u00020n2\u0006\u0010E\u001a\u00020/H\u0002J\u0010\u0010o\u001a\u00020n2\u0006\u0010E\u001a\u00020/H\u0002J\u001a\u0010p\u001a\u00020n2\u0006\u0010q\u001a\u00020n2\b\b\u0002\u0010r\u001a\u00020\u0019H\u0002J\u0018\u0010s\u001a\u00020f2\u0006\u0010t\u001a\u00020n2\u0006\u0010u\u001a\u00020/H\u0002J\u0010\u0010v\u001a\u0002062\u0006\u0010w\u001a\u00020\u0019H\u0016J\b\u0010x\u001a\u000206H\u0016J\u000e\u0010y\u001a\u0002062\u0006\u0010N\u001a\u00020\u001cJ\u001a\u0010z\u001a\u0002062\u0006\u0010N\u001a\u00020\u001c2\b\b\u0002\u0010{\u001a\u00020\u0019H\u0007J\u0006\u0010|\u001a\u000206J\u000e\u0010}\u001a\u00020\u001f2\u0006\u0010N\u001a\u00020\u001cJ\u000e\u0010~\u001a\u00020*2\u0006\u0010N\u001a\u00020\u001cJ\u0019\u0010\u007f\u001a\u0002062\u0006\u0010N\u001a\u00020\u001c2\u0007\u0010\u0080\u0001\u001a\u00020\u001fH\u0002J\t\u0010\u0081\u0001\u001a\u000206H\u0002J\t\u0010\u0082\u0001\u001a\u000206H\u0002J\u0011\u0010\u0083\u0001\u001a\u00020\u00192\u0006\u0010E\u001a\u00020/H\u0002J\t\u0010\u0084\u0001\u001a\u000206H\u0016J\u0011\u0010\u0085\u0001\u001a\u0002062\u0006\u0010E\u001a\u00020/H\u0002J\u0011\u0010\u0086\u0001\u001a\u0002062\u0006\u0010E\u001a\u00020/H\u0002J\r\u0010\u0087\u0001\u001a\u00020/*\u00020/H\u0002J\u0019\u0010\u0088\u0001\u001a\u00020\u00192\u0006\u0010N\u001a\u00020\u001c2\u0006\u0010^\u001a\u00020*H\u0002J\u0011\u0010\u0089\u0001\u001a\u00020\u00192\u0006\u0010N\u001a\u00020\u001cH\u0002J\u0019\u0010\u008a\u0001\u001a\u0004\u0018\u00010*2\u0006\u0010N\u001a\u00020\u001cH\u0002¢\u0006\u0003\u0010\u008b\u0001R\u000e\u0010\u0002\u001a\u00020\u0003X\u0082\u0004¢\u0006\u0002\n\u0000R\u000e\u0010\u0004\u001a\u00020\u0005X\u0082\u0004¢\u0006\u0002\n\u0000R\u000e\u0010\u0006\u001a\u00020\u0007X\u0082\u0004¢\u0006\u0002\n\u0000R\u000e\u0010\b\u001a\u00020\tX\u0082\u0004¢\u0006\u0002\n\u0000R\u000e\u0010\n\u001a\u00020\u000bX\u0082\u0004¢\u0006\u0002\n\u0000R\u0010\u0010\f\u001a\u0004\u0018\u00010\rX\u0082\u000e¢\u0006\u0002\n\u0000R\u000e\u0010\u000e\u001a\u00020\u000fX\u0082\u0004¢\u0006\u0002\n\u0000R\u000e\u0010\u0012\u001a\u00020\u0013X\u0082.¢\u0006\u0002\n\u0000R\u000e\u0010\u0014\u001a\u00020\u0015X\u0082.¢\u0006\u0002\n\u0000R\u0010\u0010\u0016\u001a\u0004\u0018\u00010\u0017X\u0082\u000e¢\u0006\u0002\n\u0000R\u0012\u0010\u0018\u001a\u0004\u0018\u00010\u0019X\u0082\u000e¢\u0006\u0004\n\u0002\u0010\u001aR\u0010\u0010\u001b\u001a\u0004\u0018\u00010\u001cX\u0082\u000e¢\u0006\u0002\n\u0000R\u001a\u0010\u001d\u001a\u000e\u0012\u0004\u0012\u00020\u001c\u0012\u0004\u0012\u00020\u001f0\u001eX\u0082\u0004¢\u0006\u0002\n\u0000R9\u0010 \u001a-\u0012$\u0012\"\u0012\u0004\u0012\u00020\u001c\u0012\u0004\u0012\u00020\u001f #*\u0010\u0012\u0004\u0012\u00020\u001c\u0012\u0004\u0012\u00020\u001f\u0018\u00010\"0\"0!¢\u0006\u0002\b$X\u0082\u0004¢\u0006\u0002\n\u0000RC\u0010%\u001a7\u0012.\u0012,\u0012\u0004\u0012\u00020\u001c\u0012\u0004\u0012\u00020\u001f #*\u0015\u0012\u0004\u0012\u00020\u001c\u0012\u0004\u0012\u00020\u001f\u0018\u00010\"¢\u0006\u0002\b'0\"¢\u0006\u0002\b'0&¢\u0006\u0002\b$X\u0082\u0004¢\u0006\u0002\n\u0000R\u001a\u0010(\u001a\u000e\u0012\u0004\u0012\u00020\u001c\u0012\u0004\u0012\u00020*0)X\u0082\u0004¢\u0006\u0002\n\u0000R9\u0010+\u001a-\u0012$\u0012\"\u0012\u0004\u0012\u00020\u001c\u0012\u0004\u0012\u00020* #*\u0010\u0012\u0004\u0012\u00020\u001c\u0012\u0004\u0012\u00020*\u0018\u00010\"0\"0,¢\u0006\u0002\b$X\u0082\u0004¢\u0006\u0002\n\u0000RC\u0010-\u001a7\u0012.\u0012,\u0012\u0004\u0012\u00020\u001c\u0012\u0004\u0012\u00020* #*\u0015\u0012\u0004\u0012\u00020\u001c\u0012\u0004\u0012\u00020*\u0018\u00010\"¢\u0006\u0002\b'0\"¢\u0006\u0002\b'0&¢\u0006\u0002\b$X\u0082\u0004¢\u0006\u0002\n\u0000R\u0010\u0010.\u001a\u0004\u0018\u00010/X\u0082\u000e¢\u0006\u0002\n\u0000R\u000e\u00100\u001a\u00020*X\u0082\u0004¢\u0006\u0002\n\u0000\u008a\u0002\u0017\b\u0090\u0001\u0012\u0012\b\u0001\u001a\u000e\n\fMetroFactory¨\u0006\u008f\u0001"}, d2 = {"Lcom/wickr/files/FileManager;", "Lcom/wickr/files/IFileManager;", "context", "Landroid/content/Context;", "networkClient", "Lcom/wickr/networking/NetworkClient;", "networkStatusMonitor", "Lcom/wickr/networking/NetworkStatusMonitor;", "fileEncryptor", "Lcom/wickr/files/FileEncryptor;", "databaseAdapter", "Lcom/mywickr/wickr/WickrDBAdapter;", "storageManager", "Landroid/os/storage/StorageManager;", "fileCleanupMetrics", "Lcom/wickr/files/FileCleanupMetrics;", "<init>", "(Landroid/content/Context;Lcom/wickr/networking/NetworkClient;Lcom/wickr/networking/NetworkStatusMonitor;Lcom/wickr/files/FileEncryptor;Lcom/mywickr/wickr/WickrDBAdapter;Landroid/os/storage/StorageManager;Lcom/wickr/files/FileCleanupMetrics;)V", "httpClient", "Lokhttp3/OkHttpClient;", "wickrFileAPI", "Lcom/wickr/networking/WickrFileAPI;", "config", "Lcom/mywickr/wickr/WickrS3AccessInfo;", "forceUseCertPinning", "", "Ljava/lang/Boolean;", "fileServerRegion", "", "states", "Ljava/util/HashMap;", "Lcom/wickr/files/FileState;", "stateEvents", "Lio/reactivex/rxjava3/subjects/BehaviorSubject;", "Lkotlin/Pair;", "kotlin.jvm.PlatformType", "Lio/reactivex/rxjava3/annotations/NonNull;", "stateObservable", "Lio/reactivex/rxjava3/core/Observable;", "Lkotlin/jvm/internal/EnhancedNullability;", "lastSeenProgressValues", "Ljava/util/concurrent/ConcurrentHashMap;", "", "progressEvents", "Lio/reactivex/rxjava3/subjects/PublishSubject;", "progressObservable", "tmpFile", "Ljava/io/File;", "MIN_REQUIRED_STORAGE_BYTES", "initialize", "s3Info", "useCertPinning", "(Lcom/mywickr/wickr/WickrS3AccessInfo;Ljava/lang/Boolean;Ljava/lang/String;)Z", "ensureEnoughStorage", "", "getAvailableBytes", "hasEnoughStorage", "Lcom/wickr/files/StorageCheckResult;", "storageThreshold", "cleanupEncryptedFiles", "requiredSpaceBytes", "createTemporarySharedFile", "Landroid/net/Uri;", "fileType", "Lcom/wickr/util/FileType;", "createTemporaryFile", "fileName", "deleteTemporarySharedFile", "getFileShareUri", "file", "encryptFile", "Lcom/wickr/files/FileEncryptionResult;", SentryBaseEvent.JsonKeys.REQUEST, "Lcom/wickr/files/FileEncryptionRequest;", "decryptFile", "Lcom/wickr/files/FileDecryptionResult;", "Lcom/wickr/files/FileDecryptionRequest;", "isFileUploaded", "guid", "uploadFile", "Lcom/wickr/files/FileUploadResponse;", "uploadFileWithProxyWithResponse", "Lcom/wickr/networking/model/WickrResult;", "Lcom/wickr/networking/model/FileProxyUploadResponse;", "vGroupID", "uploadFileWithProxy", "updateGuid", "oldGuid", "newGuid", "downloadFile", "uploader", "Lcom/mywickr/interfaces/WickrUserInterface;", WickrFileVaultManager.Schema.KEY_fileHash, "domain", "size", "(Lcom/mywickr/interfaces/WickrUserInterface;Ljava/lang/String;Ljava/lang/String;Ljava/lang/String;Ljava/lang/Long;)Z", "importFile", "Lcom/wickr/files/FileImportResult;", "Lcom/wickr/files/FileImportRequest;", "exportFile", "Lcom/wickr/files/FileExportRequest;", "generateFilePreviewData", "Lcom/wickr/files/FilePreviewData;", "largeImageAttachmentsMode", "Lcom/wickr/files/LargeImageAttachmentsMode;", "maxAutoDownloadSize", "isVideoFile", "isLargeFileImprovementsEnabled", "compressLargeImageFile", "selectedBitmap", "Landroid/graphics/Bitmap;", "decodeBitmapFromFile", "scaleFilePreviewImage", "bitmap", "forThumbnail", "generatePreviewDataForThumbnail", "thumbnailBitmap", "originalFile", "cleanupDecryptedFiles", "includeLockedFiles", "cleanupInProgressFileDownloads", "cancelFileRequest", "deleteFiles", "deleteEncrypted", "deleteAllFiles", "getFileState", "getFileProgress", "updateFileState", SentryThread.JsonKeys.STATE, "regenerateFileStates", "clearTempFiles", "validateFile", "removeDecryptedFileLocks", "addFileLock", "removeFileLock", "lockFile", "setFileDownloadSize", "removeFileDownloadSize", "getFileDownloadSize", "(Ljava/lang/String;)Ljava/lang/Long;", "Schema", "MetroContributionToAppScope", "MetroFactory", "wickrcoreandroid_release", "dev.zacsweers.metro.compiler"}, k = 1, mv = {2, 2, 0}, xi = 48)
@ContributesBinding(scope = AppScope.class)
public final class FileManager implements IFileManager {
    private final long MIN_REQUIRED_STORAGE_BYTES;
    private WickrS3AccessInfo config;
    private final Context context;
    private final WickrDBAdapter databaseAdapter;
    private final FileCleanupMetrics fileCleanupMetrics;
    private final FileEncryptor fileEncryptor;
    private String fileServerRegion;
    private Boolean forceUseCertPinning;
    private OkHttpClient httpClient;
    private final ConcurrentHashMap<String, Long> lastSeenProgressValues;
    private final NetworkClient networkClient;
    private final NetworkStatusMonitor networkStatusMonitor;
    private final PublishSubject<Pair<String, Long>> progressEvents;
    private final Observable<Pair<String, Long>> progressObservable;
    private final BehaviorSubject<Pair<String, FileState>> stateEvents;
    private final Observable<Pair<String, FileState>> stateObservable;
    private final HashMap<String, FileState> states;
    private StorageManager storageManager;
    private File tmpFile;
    private WickrFileAPI wickrFileAPI;

    /* JADX INFO: compiled from: FileManager.kt */
    @Metadata(k = 3, mv = {2, 2, 0}, xi = 48)
    public static final /* synthetic */ class WhenMappings {
        public static final /* synthetic */ int[] $EnumSwitchMapping$0;

        static {
            int[] iArr = new int[FileType.values().length];
            try {
                iArr[FileType.IMAGE.ordinal()] = 1;
            } catch (NoSuchFieldError unused) {
            }
            try {
                iArr[FileType.VIDEO.ordinal()] = 2;
            } catch (NoSuchFieldError unused2) {
            }
            try {
                iArr[FileType.AUDIO.ordinal()] = 3;
            } catch (NoSuchFieldError unused3) {
            }
            $EnumSwitchMapping$0 = iArr;
        }
    }

    public final void deleteFiles(String guid) {
        Intrinsics.checkNotNullParameter(guid, "guid");
        deleteFiles$default(this, guid, false, 2, null);
    }

    public final boolean initialize(WickrS3AccessInfo s3Info) {
        Intrinsics.checkNotNullParameter(s3Info, "s3Info");
        return initialize$default(this, s3Info, null, null, 6, null);
    }

    public final boolean initialize(WickrS3AccessInfo s3Info, Boolean bool) {
        Intrinsics.checkNotNullParameter(s3Info, "s3Info");
        return initialize$default(this, s3Info, bool, null, 4, null);
    }

    /* JADX INFO: compiled from: FileManager.kt */
    @Metadata(d1 = {"\u0000\u0018\n\u0002\u0018\u0002\n\u0002\u0010\u0000\n\u0000\n\u0002\u0018\u0002\n\u0000\n\u0002\u0018\u0002\n\u0002\b\u0003\bg\u0018\u00002\u00020\u0001:\u0001\u0006J\u0010\u0010\u0002\u001a\u00020\u00032\u0006\u0010\u0004\u001a\u00020\u0005H'\u008a\u0002\b\b\b\u0012\u0004\b\u0001\u0012\u0000¨\u0006\u0007À\u0006\u0003"}, d2 = {"Lcom/wickr/files/FileManager$MetroContributionToAppScope;", "", "bindsAsIFileManager", "Lcom/wickr/files/IFileManager;", "instance", "Lcom/wickr/files/FileManager;", "BindsMirror", "wickrcoreandroid_release", "dev.zacsweers.metro.compiler"}, k = 1, mv = {2, 2, 0}, xi = 48)
    @MetroContribution(scope = AppScope.class)
    @Deprecated(level = DeprecationLevel.HIDDEN, message = "This synthesized declaration should not be used directly")
    public interface MetroContributionToAppScope {
        @Binds
        IFileManager bindsAsIFileManager(FileManager instance);

        /* JADX INFO: compiled from: FileManager.kt */
        @Deprecated(level = DeprecationLevel.HIDDEN, message = "This synthesized declaration should not be used directly")
        @Metadata(d1 = {"\u0000\u0018\n\u0002\u0018\u0002\n\u0002\u0010\u0000\n\u0002\b\u0003\n\u0002\u0018\u0002\n\u0000\n\u0002\u0018\u0002\n\u0000\b'\u0018\u00002\u00020\u0001B\t\b\u0002¢\u0006\u0004\b\u0002\u0010\u0003J\u0010\u0010\u0004\u001a\u00020\u00052\u0006\u0010\u0006\u001a\u00020\u0007H'¨\u0006\b"}, d2 = {"Lcom/wickr/files/FileManager$MetroContributionToAppScope$BindsMirror;", "", "<init>", "()V", "bindsAsIFileManager", "Lcom/wickr/files/IFileManager;", "instance", "Lcom/wickr/files/FileManager;", "wickrcoreandroid_release"}, k = 1, mv = {2, 2, 0}, xi = 48)
        public static abstract class BindsMirror {
            @Binds
            @CallableMetadata(callableName = "bindsAsIFileManager", endOffset = -1, propertyName = "", startOffset = -1)
            public abstract IFileManager bindsAsIFileManager(FileManager instance);

            private BindsMirror() {
            }
        }
    }

    /* JADX INFO: compiled from: FileManager.kt */
    @Metadata(d1 = {"\u0000>\n\u0002\u0018\u0002\n\u0002\u0018\u0002\n\u0002\u0018\u0002\n\u0000\n\u0002\u0018\u0002\n\u0002\u0018\u0002\n\u0000\n\u0002\u0018\u0002\n\u0000\n\u0002\u0018\u0002\n\u0000\n\u0002\u0018\u0002\n\u0000\n\u0002\u0018\u0002\n\u0000\n\u0002\u0018\u0002\n\u0000\n\u0002\u0018\u0002\n\u0002\b\u0005\b\u0007\u0018\u00002\b\u0012\u0004\u0012\u00020\u00020\u0001:\u0001\u0015Bm\b\u0002\u0012\f\u0010\u0003\u001a\b\u0012\u0004\u0012\u00020\u00050\u0004\u0012\f\u0010\u0006\u001a\b\u0012\u0004\u0012\u00020\u00070\u0004\u0012\f\u0010\b\u001a\b\u0012\u0004\u0012\u00020\t0\u0004\u0012\f\u0010\n\u001a\b\u0012\u0004\u0012\u00020\u000b0\u0004\u0012\f\u0010\f\u001a\b\u0012\u0004\u0012\u00020\r0\u0004\u0012\u000e\u0010\u000e\u001a\n\u0012\u0006\u0012\u0004\u0018\u00010\u000f0\u0004\u0012\f\u0010\u0010\u001a\b\u0012\u0004\u0012\u00020\u00110\u0004¢\u0006\u0004\b\u0012\u0010\u0013JB\u0010\u0014\u001a\u00020\u00022\u0006\u0010\u0003\u001a\u00020\u00052\u0006\u0010\u0006\u001a\u00020\u00072\u0006\u0010\b\u001a\u00020\t2\u0006\u0010\n\u001a\u00020\u000b2\u0006\u0010\f\u001a\u00020\r2\b\u0010\u000e\u001a\u0004\u0018\u00010\u000f2\u0006\u0010\u0010\u001a\u00020\u0011H\u0007¨\u0006\u0016"}, d2 = {"Lcom/wickr/files/FileManager$MetroFactory;", "Ldev/zacsweers/metro/internal/Factory;", "Lcom/wickr/files/FileManager;", "context", "Ldev/zacsweers/metro/Provider;", "Landroid/content/Context;", "networkClient", "Lcom/wickr/networking/NetworkClient;", "networkStatusMonitor", "Lcom/wickr/networking/NetworkStatusMonitor;", "fileEncryptor", "Lcom/wickr/files/FileEncryptor;", "databaseAdapter", "Lcom/mywickr/wickr/WickrDBAdapter;", "storageManager", "Landroid/os/storage/StorageManager;", "fileCleanupMetrics", "Lcom/wickr/files/FileCleanupMetrics;", "<init>", "(Ldev/zacsweers/metro/Provider;Ldev/zacsweers/metro/Provider;Ldev/zacsweers/metro/Provider;Ldev/zacsweers/metro/Provider;Ldev/zacsweers/metro/Provider;Ldev/zacsweers/metro/Provider;Ldev/zacsweers/metro/Provider;)V", "mirrorFunction", "Companion", "wickrcoreandroid_release"}, k = 1, mv = {2, 2, 0}, xi = 48)
    @Deprecated(level = DeprecationLevel.HIDDEN, message = "This synthesized declaration should not be used directly")
    public static final class MetroFactory implements Factory<FileManager> {
        public static final Companion Companion = new Companion(null);
        private final Provider<Context> context;
        private final Provider<WickrDBAdapter> databaseAdapter;
        private final Provider<FileCleanupMetrics> fileCleanupMetrics;
        private final Provider<FileEncryptor> fileEncryptor;
        private final Provider<NetworkClient> networkClient;
        private final Provider<NetworkStatusMonitor> networkStatusMonitor;
        private final Provider<StorageManager> storageManager;

        public /* synthetic */ MetroFactory(Provider provider, Provider provider2, Provider provider3, Provider provider4, Provider provider5, Provider provider6, Provider provider7, DefaultConstructorMarker defaultConstructorMarker) {
            this(provider, provider2, provider3, provider4, provider5, provider6, provider7);
        }

        @SingleIn(scope = AppScope.class)
        public final FileManager mirrorFunction(Context context, NetworkClient networkClient, NetworkStatusMonitor networkStatusMonitor, FileEncryptor fileEncryptor, WickrDBAdapter databaseAdapter, StorageManager storageManager, FileCleanupMetrics fileCleanupMetrics) {
            Intrinsics.checkNotNullParameter(context, "context");
            Intrinsics.checkNotNullParameter(networkClient, "networkClient");
            Intrinsics.checkNotNullParameter(networkStatusMonitor, "networkStatusMonitor");
            Intrinsics.checkNotNullParameter(fileEncryptor, "fileEncryptor");
            Intrinsics.checkNotNullParameter(databaseAdapter, "databaseAdapter");
            Intrinsics.checkNotNullParameter(fileCleanupMetrics, "fileCleanupMetrics");
            throw new IllegalStateException("Never called".toString());
        }

        /* JADX INFO: compiled from: FileManager.kt */
        @Metadata(d1 = {"\u0000F\n\u0002\u0018\u0002\n\u0002\u0010\u0000\n\u0002\b\u0003\n\u0002\u0018\u0002\n\u0002\u0018\u0002\n\u0000\n\u0002\u0018\u0002\n\u0002\u0018\u0002\n\u0000\n\u0002\u0018\u0002\n\u0000\n\u0002\u0018\u0002\n\u0000\n\u0002\u0018\u0002\n\u0000\n\u0002\u0018\u0002\n\u0000\n\u0002\u0018\u0002\n\u0000\n\u0002\u0018\u0002\n\u0002\b\u0002\b\u0086\u0003\u0018\u00002\u00020\u0001B\t\b\u0002¢\u0006\u0004\b\u0002\u0010\u0003Jp\u0010\u0004\u001a\b\u0012\u0004\u0012\u00020\u00060\u00052\f\u0010\u0007\u001a\b\u0012\u0004\u0012\u00020\t0\b2\f\u0010\n\u001a\b\u0012\u0004\u0012\u00020\u000b0\b2\f\u0010\f\u001a\b\u0012\u0004\u0012\u00020\r0\b2\f\u0010\u000e\u001a\b\u0012\u0004\u0012\u00020\u000f0\b2\f\u0010\u0010\u001a\b\u0012\u0004\u0012\u00020\u00110\b2\u000e\u0010\u0012\u001a\n\u0012\u0006\u0012\u0004\u0018\u00010\u00130\b2\f\u0010\u0014\u001a\b\u0012\u0004\u0012\u00020\u00150\bJ@\u0010\u0016\u001a\u00020\u00062\u0006\u0010\u0007\u001a\u00020\t2\u0006\u0010\n\u001a\u00020\u000b2\u0006\u0010\f\u001a\u00020\r2\u0006\u0010\u000e\u001a\u00020\u000f2\u0006\u0010\u0010\u001a\u00020\u00112\b\u0010\u0012\u001a\u0004\u0018\u00010\u00132\u0006\u0010\u0014\u001a\u00020\u0015¨\u0006\u0017"}, d2 = {"Lcom/wickr/files/FileManager$MetroFactory$Companion;", "", "<init>", "()V", "create", "Ldev/zacsweers/metro/internal/Factory;", "Lcom/wickr/files/FileManager;", "context", "Ldev/zacsweers/metro/Provider;", "Landroid/content/Context;", "networkClient", "Lcom/wickr/networking/NetworkClient;", "networkStatusMonitor", "Lcom/wickr/networking/NetworkStatusMonitor;", "fileEncryptor", "Lcom/wickr/files/FileEncryptor;", "databaseAdapter", "Lcom/mywickr/wickr/WickrDBAdapter;", "storageManager", "Landroid/os/storage/StorageManager;", "fileCleanupMetrics", "Lcom/wickr/files/FileCleanupMetrics;", "newInstance", "wickrcoreandroid_release"}, k = 1, mv = {2, 2, 0}, xi = 48)
        public static final class Companion {
            public /* synthetic */ Companion(DefaultConstructorMarker defaultConstructorMarker) {
                this();
            }

            private Companion() {
            }

            public final Factory<FileManager> create(Provider<Context> context, Provider<NetworkClient> networkClient, Provider<NetworkStatusMonitor> networkStatusMonitor, Provider<FileEncryptor> fileEncryptor, Provider<WickrDBAdapter> databaseAdapter, Provider<StorageManager> storageManager, Provider<FileCleanupMetrics> fileCleanupMetrics) {
                Intrinsics.checkNotNullParameter(context, "context");
                Intrinsics.checkNotNullParameter(networkClient, "networkClient");
                Intrinsics.checkNotNullParameter(networkStatusMonitor, "networkStatusMonitor");
                Intrinsics.checkNotNullParameter(fileEncryptor, "fileEncryptor");
                Intrinsics.checkNotNullParameter(databaseAdapter, "databaseAdapter");
                Intrinsics.checkNotNullParameter(storageManager, "storageManager");
                Intrinsics.checkNotNullParameter(fileCleanupMetrics, "fileCleanupMetrics");
                return new MetroFactory(context, networkClient, networkStatusMonitor, fileEncryptor, databaseAdapter, storageManager, fileCleanupMetrics, null);
            }

            public final FileManager newInstance(Context context, NetworkClient networkClient, NetworkStatusMonitor networkStatusMonitor, FileEncryptor fileEncryptor, WickrDBAdapter databaseAdapter, StorageManager storageManager, FileCleanupMetrics fileCleanupMetrics) {
                Intrinsics.checkNotNullParameter(context, "context");
                Intrinsics.checkNotNullParameter(networkClient, "networkClient");
                Intrinsics.checkNotNullParameter(networkStatusMonitor, "networkStatusMonitor");
                Intrinsics.checkNotNullParameter(fileEncryptor, "fileEncryptor");
                Intrinsics.checkNotNullParameter(databaseAdapter, "databaseAdapter");
                Intrinsics.checkNotNullParameter(fileCleanupMetrics, "fileCleanupMetrics");
                return new FileManager(context, networkClient, networkStatusMonitor, fileEncryptor, databaseAdapter, storageManager, fileCleanupMetrics);
            }
        }

        private MetroFactory(Provider<Context> provider, Provider<NetworkClient> provider2, Provider<NetworkStatusMonitor> provider3, Provider<FileEncryptor> provider4, Provider<WickrDBAdapter> provider5, Provider<StorageManager> provider6, Provider<FileCleanupMetrics> provider7) {
            this.context = provider;
            this.networkClient = provider2;
            this.networkStatusMonitor = provider3;
            this.fileEncryptor = provider4;
            this.databaseAdapter = provider5;
            this.storageManager = provider6;
            this.fileCleanupMetrics = provider7;
        }

        @Override // dev.zacsweers.metro.Provider
        public final FileManager invoke() {
            return Companion.newInstance(this.context.invoke(), this.networkClient.invoke(), this.networkStatusMonitor.invoke(), this.fileEncryptor.invoke(), this.databaseAdapter.invoke(), this.storageManager.invoke(), this.fileCleanupMetrics.invoke());
        }
    }

    public FileManager(Context context, NetworkClient networkClient, NetworkStatusMonitor networkStatusMonitor, FileEncryptor fileEncryptor, WickrDBAdapter databaseAdapter, StorageManager storageManager, FileCleanupMetrics fileCleanupMetrics) {
        Intrinsics.checkNotNullParameter(context, "context");
        Intrinsics.checkNotNullParameter(networkClient, "networkClient");
        Intrinsics.checkNotNullParameter(networkStatusMonitor, "networkStatusMonitor");
        Intrinsics.checkNotNullParameter(fileEncryptor, "fileEncryptor");
        Intrinsics.checkNotNullParameter(databaseAdapter, "databaseAdapter");
        Intrinsics.checkNotNullParameter(fileCleanupMetrics, "fileCleanupMetrics");
        this.context = context;
        this.networkClient = networkClient;
        this.networkStatusMonitor = networkStatusMonitor;
        this.fileEncryptor = fileEncryptor;
        this.databaseAdapter = databaseAdapter;
        this.storageManager = storageManager;
        this.fileCleanupMetrics = fileCleanupMetrics;
        this.states = new HashMap<>();
        BehaviorSubject<Pair<String, FileState>> behaviorSubjectCreate = BehaviorSubject.create();
        Intrinsics.checkNotNullExpressionValue(behaviorSubjectCreate, "create(...)");
        this.stateEvents = behaviorSubjectCreate;
        Observable<Pair<String, FileState>> observableShare = behaviorSubjectCreate.share();
        Intrinsics.checkNotNullExpressionValue(observableShare, "share(...)");
        this.stateObservable = observableShare;
        this.lastSeenProgressValues = new ConcurrentHashMap<>();
        PublishSubject<Pair<String, Long>> publishSubjectCreate = PublishSubject.create();
        Intrinsics.checkNotNullExpressionValue(publishSubjectCreate, "create(...)");
        this.progressEvents = publishSubjectCreate;
        Observable<Pair<String, Long>> observableShare2 = publishSubjectCreate.share();
        Intrinsics.checkNotNullExpressionValue(observableShare2, "share(...)");
        this.progressObservable = observableShare2;
        this.MIN_REQUIRED_STORAGE_BYTES = ((long) FileUtilsKt.getONE_MB()) * 200;
        Timber.INSTANCE.i("Initializing FileManager", new Object[0]);
        ensureEnoughStorage();
        cleanupDecryptedFiles(true);
        clearTempFiles();
        regenerateFileStates();
        observableShare2.doOnEach(new Consumer() { // from class: com.wickr.files.FileManager.1
            @Override // io.reactivex.rxjava3.functions.Consumer
            public final void accept(Notification<Pair<String, Long>> it) {
                Intrinsics.checkNotNullParameter(it, "it");
                Pair<String, Long> value = it.getValue();
                if (value != null) {
                    FileManager.this.lastSeenProgressValues.put(value.getFirst(), value.getSecond());
                }
            }
        }).subscribeOn(Schedulers.io()).subscribe();
    }

    public static /* synthetic */ boolean initialize$default(FileManager fileManager, WickrS3AccessInfo wickrS3AccessInfo, Boolean bool, String str, int i, Object obj) {
        if ((i & 2) != 0) {
            bool = null;
        }
        if ((i & 4) != 0) {
            str = null;
        }
        return fileManager.initialize(wickrS3AccessInfo, bool, str);
    }

    public final boolean initialize(WickrS3AccessInfo s3Info, Boolean useCertPinning, String fileServerRegion) {
        boolean zBooleanValue;
        OkHttpClient okHttpClientNewHttpClient$default;
        WickrFileAPI wickrFileAPI;
        OkHttpClient okHttpClient;
        WickrFileAPI wickrFileAPI2;
        OkHttpClient okHttpClient2;
        Intrinsics.checkNotNullParameter(s3Info, "s3Info");
        if (useCertPinning != null) {
            Timber.INSTANCE.i("Updating FileManager to use certificate pinning: " + useCertPinning, new Object[0]);
            this.forceUseCertPinning = useCertPinning;
        }
        if (fileServerRegion != null) {
            Timber.INSTANCE.d("Updating FileManager to use region " + fileServerRegion, new Object[0]);
            this.fileServerRegion = fileServerRegion;
        }
        Session activeSession = WickrCore.getCoreContext().getSessionManager().getActiveSession();
        if (activeSession != null && activeSession.getFileApiVersion() >= 2) {
            OkHttpClient.Builder builderNewBuilder = this.networkClient.getHttpClient().newBuilder();
            if (this.networkClient.getProxy() != null && (this.networkClient.getProxy() instanceof Vendor1Proxy)) {
                builderNewBuilder.connectTimeout(60L, TimeUnit.SECONDS);
                builderNewBuilder.readTimeout(60L, TimeUnit.SECONDS);
                builderNewBuilder.writeTimeout(60L, TimeUnit.SECONDS);
            } else {
                builderNewBuilder.connectTimeout(30L, TimeUnit.SECONDS);
                builderNewBuilder.readTimeout(30L, TimeUnit.SECONDS);
                builderNewBuilder.writeTimeout(30L, TimeUnit.SECONDS);
            }
            OkHttpClient okHttpClientBuild = builderNewBuilder.build();
            Intrinsics.checkNotNullExpressionValue(okHttpClientBuild, "build(...)");
            this.httpClient = okHttpClientBuild;
            if (this.wickrFileAPI == null) {
                this.wickrFileAPI = WickrFileProxyAPI.INSTANCE.create();
            }
            WickrFileAPI wickrFileAPI3 = this.wickrFileAPI;
            if (wickrFileAPI3 == null) {
                Intrinsics.throwUninitializedPropertyAccessException("wickrFileAPI");
                wickrFileAPI2 = null;
            } else {
                wickrFileAPI2 = wickrFileAPI3;
            }
            NetworkClient networkClient = this.networkClient;
            OkHttpClient okHttpClient3 = this.httpClient;
            if (okHttpClient3 == null) {
                Intrinsics.throwUninitializedPropertyAccessException("httpClient");
                okHttpClient2 = null;
            } else {
                okHttpClient2 = okHttpClient3;
            }
            return wickrFileAPI2.initializeProxy(networkClient, okHttpClient2, this.networkClient.getConfig().getServer().getBaseURL(), this.networkClient.getConfig().getNetworkCipher(), this.forceUseCertPinning);
        }
        if (ExtensionsKt.isEmpty(s3Info.getUrl()) || ExtensionsKt.isEmpty(s3Info.getApiKey()) || ExtensionsKt.isEmpty(s3Info.getSecret())) {
            return false;
        }
        Boolean bool = this.forceUseCertPinning;
        if (bool != null) {
            zBooleanValue = bool.booleanValue();
        } else {
            String url = s3Info.getUrl();
            Intrinsics.checkNotNullExpressionValue(url, "getUrl(...)");
            zBooleanValue = !StringsKt.endsWith(url, WickrFileProxyAPI.AMAZON_S3, true);
        }
        if (zBooleanValue) {
            Timber.INSTANCE.i("Using existing http client", new Object[0]);
            okHttpClientNewHttpClient$default = this.networkClient.getHttpClient();
        } else {
            if (zBooleanValue) {
                throw new NoWhenBranchMatchedException();
            }
            Timber.INSTANCE.i("Creating new http client without cert pinning", new Object[0]);
            okHttpClientNewHttpClient$default = NetworkClient.newHttpClient$default(this.networkClient, false, null, 2, null);
        }
        OkHttpClient.Builder builderNewBuilder2 = okHttpClientNewHttpClient$default.newBuilder();
        if (this.networkClient.getProxy() != null && (this.networkClient.getProxy() instanceof Vendor1Proxy)) {
            builderNewBuilder2.connectTimeout(60L, TimeUnit.SECONDS);
            builderNewBuilder2.readTimeout(60L, TimeUnit.SECONDS);
            builderNewBuilder2.writeTimeout(60L, TimeUnit.SECONDS);
        } else {
            builderNewBuilder2.connectTimeout(30L, TimeUnit.SECONDS);
            builderNewBuilder2.readTimeout(30L, TimeUnit.SECONDS);
            builderNewBuilder2.writeTimeout(30L, TimeUnit.SECONDS);
        }
        OkHttpClient okHttpClientBuild2 = builderNewBuilder2.build();
        Intrinsics.checkNotNullExpressionValue(okHttpClientBuild2, "build(...)");
        this.httpClient = okHttpClientBuild2;
        if (this.wickrFileAPI == null) {
            this.wickrFileAPI = WickrAmazonS3FileAPI.INSTANCE.create();
        }
        this.config = s3Info;
        WickrFileAPI wickrFileAPI4 = this.wickrFileAPI;
        if (wickrFileAPI4 == null) {
            Intrinsics.throwUninitializedPropertyAccessException("wickrFileAPI");
            wickrFileAPI = null;
        } else {
            wickrFileAPI = wickrFileAPI4;
        }
        OkHttpClient okHttpClient4 = this.httpClient;
        if (okHttpClient4 == null) {
            Intrinsics.throwUninitializedPropertyAccessException("httpClient");
            okHttpClient = null;
        } else {
            okHttpClient = okHttpClient4;
        }
        String url2 = s3Info.getUrl();
        Intrinsics.checkNotNullExpressionValue(url2, "getUrl(...)");
        String apiKey = s3Info.getApiKey();
        Intrinsics.checkNotNullExpressionValue(apiKey, "getApiKey(...)");
        String secret = s3Info.getSecret();
        Intrinsics.checkNotNullExpressionValue(secret, "getSecret(...)");
        String bucketID = s3Info.getBucketID();
        Intrinsics.checkNotNullExpressionValue(bucketID, "getBucketID(...)");
        return wickrFileAPI.initialize(okHttpClient, url2, apiKey, secret, bucketID, this.fileServerRegion);
    }

    private final void ensureEnoughStorage() {
        if (!WickrCore.INSTANCE.getEnableFileCleanup()) {
            Timber.INSTANCE.i("File cleanup is disabled, not checking space available", new Object[0]);
            return;
        }
        StorageCheckResult storageCheckResultHasEnoughStorage = hasEnoughStorage(this.MIN_REQUIRED_STORAGE_BYTES);
        if (storageCheckResultHasEnoughStorage instanceof StorageCheckResult.Success) {
            StorageCheckResult.Success success = (StorageCheckResult.Success) storageCheckResultHasEnoughStorage;
            if (!success.getHasEnough()) {
                Timber.INSTANCE.i("Need to free " + FileUtilsKt.toMb(success.getNeededSpace()) + "MB", new Object[0]);
                cleanupEncryptedFiles(success.getNeededSpace());
                return;
            }
            Timber.INSTANCE.i("Sufficient storage available", new Object[0]);
            return;
        }
        if (!(storageCheckResultHasEnoughStorage instanceof StorageCheckResult.Failed)) {
            throw new NoWhenBranchMatchedException();
        }
        Timber.INSTANCE.e("Storage check failed: " + ((StorageCheckResult.Failed) storageCheckResultHasEnoughStorage).getError().getMessage(), new Object[0]);
    }

    private final long getAvailableBytes() {
        StorageManager storageManager = this.storageManager;
        UUID uuidForPath = storageManager != null ? storageManager.getUuidForPath(this.context.getDataDir()) : null;
        if (uuidForPath == null) {
            return -1L;
        }
        StorageManager storageManager2 = this.storageManager;
        Long lValueOf = storageManager2 != null ? Long.valueOf(storageManager2.getAllocatableBytes(uuidForPath)) : null;
        if (lValueOf != null) {
            return lValueOf.longValue();
        }
        return -1L;
    }

    @Override // com.wickr.files.IFileManager
    public StorageCheckResult hasEnoughStorage(long storageThreshold) {
        try {
            long availableBytes = getAvailableBytes();
            if (availableBytes == -1) {
                return new StorageCheckResult.Failed(new IllegalStateException("Unable to determine storage"));
            }
            String mb = FileUtilsKt.toMb(availableBytes);
            Timber.INSTANCE.d("Storage Available: " + mb + "MB", new Object[0]);
            boolean z = availableBytes >= storageThreshold;
            long j = !z ? storageThreshold - availableBytes : 0L;
            if (!z) {
                Timber.INSTANCE.w("Low storage: " + mb + " MB available, need " + FileUtilsKt.toMb(storageThreshold) + " MB", new Object[0]);
            }
            return new StorageCheckResult.Success(z, j);
        } catch (Exception e) {
            Exception exc = e;
            Timber.INSTANCE.e(exc, "Failed to check storage", new Object[0]);
            WickrBugReporter.report$default(exc, null, null, 6, null);
            return new StorageCheckResult.Failed(e);
        }
    }

    /* JADX WARN: Code duplicated, block: B:14:0x0081 A[Catch: Exception -> 0x02b3, TRY_LEAVE, TryCatch #2 {Exception -> 0x02b3, blocks: (B:3:0x004a, B:5:0x0056, B:7:0x0061, B:9:0x0069, B:10:0x006c, B:11:0x006f, B:14:0x0081), top: B:82:0x004a }] */
    @Override // com.wickr.files.IFileManager
    public long cleanupEncryptedFiles(long requiredSpaceBytes) {
        List listEmptyList;
        ArrayList arrayListEmptyList;
        Iterator it;
        Iterator it2;
        long j;
        String str;
        Object next;
        long jCurrentTimeMillis = System.currentTimeMillis();
        Timber.INSTANCE.d("Starting cleanup to free " + FileUtilsKt.toMb(requiredSpaceBytes) + "MB", new Object[0]);
        float totalBytes = new StatFs(this.context.getDataDir().getAbsolutePath()).getTotalBytes();
        float f = 100;
        float availableBytes = (getAvailableBytes() / totalBytes) * f;
        int i = 0;
        try {
            File[] fileArrListFiles = FileUtilsKt.getEncryptedFileDirectory(this.context).listFiles();
            if (fileArrListFiles == null) {
                listEmptyList = CollectionsKt.emptyList();
            } else {
                ArrayList arrayList = new ArrayList();
                for (File file : fileArrListFiles) {
                    if (!file.isDirectory()) {
                        arrayList.add(file);
                    }
                }
                listEmptyList = CollectionsKt.sortedWith(arrayList, new Comparator() { // from class: com.wickr.files.FileManager$cleanupEncryptedFiles$$inlined$sortedBy$1
                    /* JADX WARN: Multi-variable type inference failed */
                    @Override // java.util.Comparator
                    public final int compare(T t, T t2) {
                        return ComparisonsKt.compareValues(Long.valueOf(((File) t).lastModified()), Long.valueOf(((File) t2).lastModified()));
                    }
                });
                if (listEmptyList == null) {
                    listEmptyList = CollectionsKt.emptyList();
                }
            }
            List list = listEmptyList;
            if (list.isEmpty()) {
                this.fileCleanupMetrics.recordCleanupCompleted(requiredSpaceBytes, 0L, (int) (System.currentTimeMillis() - jCurrentTimeMillis), availableBytes, availableBytes, 0);
                Timber.INSTANCE.i("No encrypted files to delete", new Object[0]);
                return 0L;
            }
            try {
                File[] fileArrListFiles2 = FileUtilsKt.getDecryptedFileDirectory(this.context).listFiles();
                if (fileArrListFiles2 == null) {
                    arrayListEmptyList = CollectionsKt.emptyList();
                } else {
                    ArrayList arrayList2 = new ArrayList();
                    for (File file2 : fileArrListFiles2) {
                        if (!file2.isDirectory()) {
                            arrayList2.add(file2);
                        }
                    }
                    arrayListEmptyList = arrayList2;
                }
            } catch (Exception e) {
                Timber.INSTANCE.e("Failed to list decrypted files: " + e, new Object[0]);
                arrayListEmptyList = CollectionsKt.emptyList();
            }
            List list2 = list;
            LinkedHashMap linkedHashMap = new LinkedHashMap(RangesKt.coerceAtLeast(MapsKt.mapCapacity(CollectionsKt.collectionSizeOrDefault(list2, 10)), 16));
            Iterator it3 = list2.iterator();
            while (it3.hasNext()) {
                File file3 = (File) it3.next();
                String name = file3.getName();
                Iterator it4 = arrayListEmptyList.iterator();
                while (true) {
                    if (!it4.hasNext()) {
                        it2 = it3;
                        j = jCurrentTimeMillis;
                        str = null;
                        next = null;
                        break;
                    }
                    next = it4.next();
                    String name2 = ((File) next).getName();
                    Intrinsics.checkNotNullExpressionValue(name2, "getName(...)");
                    it2 = it3;
                    String name3 = file3.getName();
                    Intrinsics.checkNotNullExpressionValue(name3, "getName(...)");
                    j = jCurrentTimeMillis;
                    str = null;
                    if (StringsKt.startsWith$default(name2, name3, false, 2, (Object) null)) {
                        break;
                    }
                    it3 = it2;
                    jCurrentTimeMillis = j;
                }
                File file4 = (File) next;
                Pair pair = TuplesKt.to(name, file4 != null ? file4.getName() : str);
                linkedHashMap.put(pair.getFirst(), pair.getSecond());
                it3 = it2;
                jCurrentTimeMillis = j;
            }
            long j2 = jCurrentTimeMillis;
            Iterator it5 = list.iterator();
            long j3 = 0;
            while (it5.hasNext()) {
                File file5 = (File) it5.next();
                if (j3 >= requiredSpaceBytes) {
                    break;
                }
                try {
                    long length = file5.length();
                    String name4 = file5.getName();
                    file5.delete();
                    if (!file5.exists()) {
                        it = it5;
                        try {
                            Timber.INSTANCE.i("Deleted encrypted file: " + name4 + " (" + FileUtilsKt.toMb(length) + "MB)", new Object[0]);
                            j3 += length;
                            i++;
                            if (linkedHashMap.get(file5.getName()) != null) {
                                Intrinsics.checkNotNull(file5);
                                updateFileState(FilesKt.getNameWithoutExtension(file5), FileState.Decrypted);
                            } else {
                                Intrinsics.checkNotNull(file5);
                                updateFileState(FilesKt.getNameWithoutExtension(file5), FileState.NeedsDownload);
                            }
                        } catch (Exception e2) {
                            e = e2;
                            Timber.INSTANCE.e("Error deleting encrypted file " + file5.getName() + ": " + e, new Object[0]);
                        }
                    } else {
                        it = it5;
                        Timber.INSTANCE.w("Failed to delete: " + name4, new Object[0]);
                    }
                } catch (Exception e3) {
                    e = e3;
                    it = it5;
                }
                it5 = it;
            }
            if (j3 >= requiredSpaceBytes) {
                Timber.INSTANCE.i("Successfully freed " + FileUtilsKt.toMb(j3) + "MB", new Object[0]);
            } else {
                Timber.INSTANCE.w("Only freed " + FileUtilsKt.toMb(j3) + "MB, needed " + FileUtilsKt.toMb(requiredSpaceBytes) + "MB", new Object[0]);
            }
            this.fileCleanupMetrics.recordCleanupCompleted(requiredSpaceBytes, j3, (int) (System.currentTimeMillis() - j2), availableBytes, (getAvailableBytes() / totalBytes) * f, i);
            return j3;
        } catch (Exception e4) {
            this.fileCleanupMetrics.recordCleanupFailed(requiredSpaceBytes, 0L, (int) (System.currentTimeMillis() - jCurrentTimeMillis), availableBytes, availableBytes, 0, FileCacheCleanupEventData.CleanupErrorCode.FAILED_TO_LIST_FILES);
            Timber.INSTANCE.e("Failed to list encrypted files: " + e4, new Object[0]);
            return 0L;
        }
    }

    public final Observable<Pair<String, FileState>> stateEvents() {
        return this.stateObservable;
    }

    public final Observable<Pair<String, Long>> progressEvents() {
        return this.progressObservable;
    }

    public final Uri createTemporarySharedFile(FileType fileType) {
        Intrinsics.checkNotNullParameter(fileType, "fileType");
        return getFileShareUri(createTemporaryFile(fileType));
    }

    public static /* synthetic */ File createTemporaryFile$default(FileManager fileManager, String str, int i, Object obj) {
        if ((i & 1) != 0) {
            str = null;
        }
        return fileManager.createTemporaryFile(str);
    }

    public final File createTemporaryFile(String fileName) {
        String str = new SimpleDateFormat("yyyyMMdd_HHmmss", Locale.US).format(new Date());
        File temporaryFileDirectory = FileUtilsKt.getTemporaryFileDirectory(this.context);
        if (fileName == null) {
            fileName = str;
        }
        File file = new File(temporaryFileDirectory, fileName);
        this.tmpFile = file;
        Intrinsics.checkNotNull(file);
        return file;
    }

    public final File createTemporaryFile(FileType fileType) {
        String str;
        String str2;
        Intrinsics.checkNotNullParameter(fileType, "fileType");
        int i = WhenMappings.$EnumSwitchMapping$0[fileType.ordinal()];
        if (i == 1) {
            str = "IMG";
        } else if (i == 2) {
            str = "MOV";
        } else {
            if (i != 3) {
                throw new NoWhenBranchMatchedException();
            }
            str = "AUDIO";
        }
        int i2 = WhenMappings.$EnumSwitchMapping$0[fileType.ordinal()];
        if (i2 == 1) {
            str2 = ".jpg";
        } else if (i2 == 2) {
            str2 = ".mp4";
        } else {
            if (i2 != 3) {
                throw new NoWhenBranchMatchedException();
            }
            str2 = ".wav";
        }
        File file = new File(FileUtilsKt.getTemporaryFileDirectory(this.context), str + "_" + new SimpleDateFormat("yyyyMMdd_HHmmss", Locale.US).format(new Date()) + str2);
        this.tmpFile = file;
        Intrinsics.checkNotNull(file);
        return file;
    }

    public final void deleteTemporarySharedFile() {
        File file = this.tmpFile;
        if (file != null) {
            file.delete();
        }
    }

    public final Uri getFileShareUri(File file) throws IOException {
        Intrinsics.checkNotNullParameter(file, "file");
        File parentFile = file.getParentFile();
        if (Intrinsics.areEqual(parentFile != null ? parentFile.getAbsolutePath() : null, FileUtilsKt.getDecryptedFileDirectory(this.context).getAbsolutePath())) {
            addFileLock(file);
        }
        Context context = this.context;
        Uri uriForFile = FileProvider.getUriForFile(context, context.getPackageName() + ".files.provider", file);
        Intrinsics.checkNotNullExpressionValue(uriForFile, "getUriForFile(...)");
        return uriForFile;
    }

    public final FileEncryptionResult encryptFile(FileEncryptionRequest request) {
        Intrinsics.checkNotNullParameter(request, "request");
        String guid = request.getGuid();
        String strGenerateGuid = (guid == null || guid.length() == 0) ? this.fileEncryptor.generateGuid() : request.getGuid();
        byte[] bArrGenerateDecryptionKey = this.fileEncryptor.generateDecryptionKey();
        File file = new File(request.getInputFile());
        File encryptedFile = FileUtilsKt.getEncryptedFile(this.context, strGenerateGuid);
        updateFileState(strGenerateGuid, FileState.Encrypting);
        try {
            if (this.fileEncryptor.encryptFile(file, encryptedFile, bArrGenerateDecryptionKey)) {
                String strHashFile = this.fileEncryptor.hashFile(encryptedFile);
                updateFileState(strGenerateGuid, FileState.Encrypted);
                String absolutePath = encryptedFile.getAbsolutePath();
                Intrinsics.checkNotNullExpressionValue(absolutePath, "getAbsolutePath(...)");
                return new FileEncryptionResult(true, absolutePath, strGenerateGuid, strHashFile, bArrGenerateDecryptionKey);
            }
            encryptedFile.delete();
            updateFileState(strGenerateGuid, FileState.FailedEncrypting);
            return new FileEncryptionResult(false, null, null, null, null, 30, null);
        } catch (Exception e) {
            Timber.INSTANCE.e(e);
        }
    }

    /* JADX WARN: Multi-variable type inference failed */
    public final FileDecryptionResult decryptFile(FileDecryptionRequest request) {
        Intrinsics.checkNotNullParameter(request, "request");
        int i = 2;
        File file = null;
        Object[] objArr = 0;
        Object[] objArr2 = 0;
        Object[] objArr3 = 0;
        boolean z = false;
        if (getFileState(request.getGuid()) == FileState.Decrypting) {
            Timber.INSTANCE.d("Avoiding trying to decrypt a file already being decrypting: " + request.getGuid(), new Object[0]);
            return new FileDecryptionResult(z, file, i, objArr3 == true ? 1 : 0);
        }
        Timber.INSTANCE.d("Decrypting file " + request.getGuid(), new Object[0]);
        updateFileState(request.getGuid(), FileState.Decrypting);
        try {
            File encryptedFile = FileUtilsKt.getEncryptedFile(this.context, request.getGuid());
            File file2 = new File(request.getOutputFolder(), request.getOutputFileName());
            if (encryptedFile.exists() && (!file2.exists() || request.getOverwrite())) {
                if (!this.fileEncryptor.decryptFile(encryptedFile, file2, request.getDecryptionKey())) {
                    Timber.INSTANCE.e("Unable to decrypt file " + request.getGuid(), new Object[0]);
                    file2.delete();
                } else {
                    Timber.INSTANCE.i("Decrypted file " + request.getGuid(), new Object[0]);
                    updateFileState(request.getGuid(), FileState.Decrypted);
                    return new FileDecryptionResult(true, file2);
                }
            }
        } catch (Exception e) {
            Timber.INSTANCE.e(e);
        }
        Timber.INSTANCE.e("Failed to decrypt file " + request.getGuid(), new Object[0]);
        updateFileState(request.getGuid(), FileState.FailedDecrypting);
        return new FileDecryptionResult(z, objArr2 == true ? 1 : 0, i, objArr == true ? 1 : 0);
    }

    public final boolean isFileUploaded(String guid) {
        Intrinsics.checkNotNullParameter(guid, "guid");
        if (this.wickrFileAPI == null) {
            return false;
        }
        try {
            Timber.INSTANCE.i("Checking if file is uploaded", new Object[0]);
            WickrFileAPI wickrFileAPI = this.wickrFileAPI;
            if (wickrFileAPI == null) {
                Intrinsics.throwUninitializedPropertyAccessException("wickrFileAPI");
                wickrFileAPI = null;
            }
            Boolean boolBlockingGet = wickrFileAPI.doesFileExist(guid).blockingGet();
            Intrinsics.checkNotNull(boolBlockingGet);
            return boolBlockingGet.booleanValue();
        } catch (Exception e) {
            ExtensionsKt.logNetworkError(e);
            return false;
        }
    }

    /* JADX WARN: Multi-variable type inference failed */
    public final FileUploadResponse uploadFile(final String guid) {
        FileState fileState;
        Intrinsics.checkNotNullParameter(guid, "guid");
        int i = 2;
        String str = null;
        Object[] objArr = 0;
        Object[] objArr2 = 0;
        Object[] objArr3 = 0;
        boolean z = false;
        if (this.wickrFileAPI == null) {
            return new FileUploadResponse(z, str, i, objArr3 == true ? 1 : 0);
        }
        Timber.INSTANCE.d("Checking if file is already uploaded before uploading", new Object[0]);
        String baseURL = this.networkClient.getConfig().getServer().getBaseURL();
        if (isFileUploaded(guid)) {
            return new FileUploadResponse(true, baseURL);
        }
        Timber.INSTANCE.d("Updating state to Uploading", new Object[0]);
        updateFileState(guid, FileState.Uploading);
        try {
            File encryptedFile = FileUtilsKt.getEncryptedFile(this.context, guid);
            Timber.INSTANCE.d("Uploading encrypted file: " + encryptedFile.getAbsolutePath(), new Object[0]);
            WickrFileAPI wickrFileAPI = this.wickrFileAPI;
            if (wickrFileAPI == null) {
                Intrinsics.throwUninitializedPropertyAccessException("wickrFileAPI");
                wickrFileAPI = null;
            }
            Boolean boolBlockingGet = wickrFileAPI.uploadFile(guid, encryptedFile, new Function2() { // from class: com.wickr.files.FileManager$$ExternalSyntheticLambda2
                @Override // kotlin.jvm.functions.Function2
                public final Object invoke(Object obj, Object obj2) {
                    return FileManager.uploadFile$lambda$0(this.f$0, guid, ((Long) obj).longValue(), ((Long) obj2).longValue());
                }
            }).blockingGet();
            Intrinsics.checkNotNullExpressionValue(boolBlockingGet, "blockingGet(...)");
            if (boolBlockingGet.booleanValue()) {
                File fileFindDecryptedFile = FileUtilsKt.findDecryptedFile(this.context, guid);
                Timber.INSTANCE.i("Checking if decrypted file " + (fileFindDecryptedFile != null ? fileFindDecryptedFile.getName() : null) + " exists", new Object[0]);
                if (fileFindDecryptedFile != null && fileFindDecryptedFile.exists()) {
                    fileState = FileState.Decrypted;
                } else {
                    fileState = FileState.Encrypted;
                }
                Timber.INSTANCE.i("Successfully uploaded file. Updating state to " + fileState.name(), new Object[0]);
                updateFileState(guid, fileState);
                return new FileUploadResponse(true, baseURL);
            }
        } catch (Exception e) {
            ExtensionsKt.logNetworkError(e);
        }
        Timber.INSTANCE.e("Failed to upload file. Updating state to FailedUpload", new Object[0]);
        updateFileState(guid, FileState.FailedUpload);
        return new FileUploadResponse(z, objArr2 == true ? 1 : 0, i, objArr == true ? 1 : 0);
    }

    /* JADX INFO: Access modifiers changed from: private */
    public static final Unit uploadFile$lambda$0(FileManager fileManager, String str, long j, long j2) {
        fileManager.progressEvents.onNext(new Pair<>(str, Long.valueOf(j)));
        return Unit.INSTANCE;
    }

    /* JADX WARN: Multi-variable type inference failed */
    public final WickrResult<FileProxyUploadResponse> uploadFileWithProxyWithResponse(final String guid, String vGroupID) {
        WickrResult<FileProxyUploadResponse> wickrResult;
        boolean z;
        FileProxyUploadResponse fileProxyUploadResponseBlockingGet;
        String guid2;
        FileState fileState;
        Intrinsics.checkNotNullParameter(guid, "guid");
        if (this.wickrFileAPI == null) {
            return null;
        }
        int i = 0;
        Timber.INSTANCE.d("Updating state to Uploading", new Object[0]);
        updateFileState(guid, FileState.Uploading);
        try {
            File encryptedFile = FileUtilsKt.getEncryptedFile(this.context, guid);
            Timber.INSTANCE.d("Uploading encrypted file: " + encryptedFile.getAbsolutePath(), new Object[0]);
            Session activeSession = WickrCore.getCoreContext().getSessionManager().getActiveSession();
            if (activeSession != null) {
                final Ref.LongRef longRef = new Ref.LongRef();
                WickrFileAPI wickrFileAPI = this.wickrFileAPI;
                if (wickrFileAPI == null) {
                    Intrinsics.throwUninitializedPropertyAccessException("wickrFileAPI");
                    wickrFileAPI = null;
                }
                wickrResult = null;
                try {
                    fileProxyUploadResponseBlockingGet = wickrFileAPI.uploadFile(activeSession.getUsernameHash(), activeSession.getAppID(), activeSession.getDeviceID(), activeSession.getSessionID(), encryptedFile, guid, vGroupID, new Function2() { // from class: com.wickr.files.FileManager$$ExternalSyntheticLambda4
                        @Override // kotlin.jvm.functions.Function2
                        public final Object invoke(Object obj, Object obj2) {
                            return FileManager.uploadFileWithProxyWithResponse$lambda$0(this.f$0, guid, longRef, ((Long) obj).longValue(), ((Long) obj2).longValue());
                        }
                    }).blockingGet();
                    if (fileProxyUploadResponseBlockingGet == null || fileProxyUploadResponseBlockingGet.getGuid().length() <= 0 || Intrinsics.areEqual(fileProxyUploadResponseBlockingGet.getGuid(), guid)) {
                        z = false;
                    } else {
                        updateGuid(guid, fileProxyUploadResponseBlockingGet.getGuid());
                        this.progressEvents.onNext(new Pair<>(fileProxyUploadResponseBlockingGet.getGuid(), Long.valueOf(longRef.element)));
                        z = true;
                    }
                } catch (Exception e) {
                    e = e;
                    Exception exc = e;
                    ExtensionsKt.logNetworkError(exc);
                    Timber.INSTANCE.e("Failed to upload file due to a network error. Updating state to FailedUpload", new Object[0]);
                    updateFileState(guid, FileState.FailedUpload);
                    return new WickrResult.Error(exc, i, 2, wickrResult);
                }
            } else {
                wickrResult = null;
                z = false;
                fileProxyUploadResponseBlockingGet = null;
            }
            if (z) {
                if (fileProxyUploadResponseBlockingGet == null || (guid2 = fileProxyUploadResponseBlockingGet.getGuid()) == null) {
                    guid2 = guid;
                }
                File fileFindDecryptedFile = FileUtilsKt.findDecryptedFile(this.context, guid2);
                Timber.INSTANCE.i("Checking if decrypted file " + (fileFindDecryptedFile != null ? fileFindDecryptedFile.getName() : wickrResult) + " exists", new Object[0]);
                if (fileFindDecryptedFile != null && fileFindDecryptedFile.exists()) {
                    fileState = FileState.Decrypted;
                } else {
                    fileState = FileState.Encrypted;
                }
                Timber.INSTANCE.i("Successfully uploaded file. Updating state to " + fileState.name(), new Object[0]);
                updateFileState(guid2, fileState);
                Intrinsics.checkNotNull(fileProxyUploadResponseBlockingGet);
                return new WickrResult.Success(fileProxyUploadResponseBlockingGet);
            }
            Timber.INSTANCE.e("Failed to upload file. Updating state to FailedUpload", new Object[0]);
            updateFileState(guid, FileState.FailedUpload);
            return wickrResult;
        } catch (Exception e2) {
            e = e2;
            wickrResult = null;
        }
    }

    /* JADX INFO: Access modifiers changed from: private */
    public static final Unit uploadFileWithProxyWithResponse$lambda$0(FileManager fileManager, String str, Ref.LongRef longRef, long j, long j2) {
        fileManager.progressEvents.onNext(new Pair<>(str, Long.valueOf(j)));
        longRef.element = j;
        return Unit.INSTANCE;
    }

    public final FileProxyUploadResponse uploadFileWithProxy(String guid, String vGroupID) {
        Intrinsics.checkNotNullParameter(guid, "guid");
        WickrResult<FileProxyUploadResponse> wickrResultUploadFileWithProxyWithResponse = uploadFileWithProxyWithResponse(guid, vGroupID);
        if (wickrResultUploadFileWithProxyWithResponse instanceof WickrResult.Success) {
            return (FileProxyUploadResponse) ((WickrResult.Success) wickrResultUploadFileWithProxyWithResponse).getValue();
        }
        return null;
    }

    private final void updateGuid(final String oldGuid, String newGuid) {
        File decryptedFile;
        if (this.states.containsKey(oldGuid)) {
            FileState fileState = this.states.get(oldGuid);
            if (fileState != null) {
                Timber.INSTANCE.i("Switching guid " + oldGuid + " to " + newGuid, new Object[0]);
                updateFileState(newGuid, fileState);
            }
            this.states.remove(oldGuid);
        }
        File[] fileArrListFiles = FileUtilsKt.getDecryptedFileDirectory(this.context).listFiles(new FileFilter() { // from class: com.wickr.files.FileManager$$ExternalSyntheticLambda7
            @Override // java.io.FileFilter
            public final boolean accept(File file) {
                return FileManager.updateGuid$lambda$0(oldGuid, file);
            }
        });
        if (fileArrListFiles != null) {
            for (File file : fileArrListFiles) {
                Intrinsics.checkNotNull(file);
                String extension = FilesKt.getExtension(file);
                if (extension.length() > 0) {
                    decryptedFile = FileUtilsKt.getDecryptedFile(this.context, newGuid + "." + extension);
                } else {
                    decryptedFile = FileUtilsKt.getDecryptedFile(this.context, newGuid);
                }
                file.renameTo(decryptedFile);
                Timber.INSTANCE.d("Renamed " + file.getName() + " to " + decryptedFile.getName(), new Object[0]);
            }
        }
        File encryptedFile = FileUtilsKt.getEncryptedFile(this.context, oldGuid);
        if (encryptedFile.exists()) {
            encryptedFile.renameTo(FileUtilsKt.getEncryptedFile(this.context, newGuid));
        }
    }

    /* JADX INFO: Access modifiers changed from: private */
    public static final boolean updateGuid$lambda$0(String str, File file) {
        Intrinsics.checkNotNull(file);
        return Intrinsics.areEqual(FilesKt.getNameWithoutExtension(file), str);
    }

    public static /* synthetic */ boolean downloadFile$default(FileManager fileManager, WickrUserInterface wickrUserInterface, String str, String str2, String str3, Long l, int i, Object obj) {
        if ((i & 8) != 0) {
            str3 = null;
        }
        if ((i & 16) != 0) {
            l = null;
        }
        return fileManager.downloadFile(wickrUserInterface, str, str2, str3, l);
    }

    public final boolean downloadFile(WickrUserInterface uploader, final String guid, String fileHash, String domain, Long size) {
        boolean zBooleanValue;
        boolean z;
        WickrFileAPI wickrFileAPI;
        Intrinsics.checkNotNullParameter(guid, "guid");
        if (this.wickrFileAPI == null) {
            return false;
        }
        WickrFileAPI wickrFileAPI2 = null;
        if (!FileUtilsKt.validateGuid(guid)) {
            Timber.INSTANCE.i("Invalid file guid, file download failed", new Object[0]);
            WickrBugReporter.report$default(new IllegalStateException("Invalid file guid"), null, null, 6, null);
            return false;
        }
        Timber.INSTANCE.d("Checking if file is currently downloading", new Object[0]);
        if (getFileState(guid) == FileState.Downloading) {
            return true;
        }
        Timber.INSTANCE.d("Updating state to Downloading", new Object[0]);
        updateFileState(guid, FileState.Downloading);
        if (size != null) {
            setFileDownloadSize(guid, size.longValue());
        }
        File encryptedFile = FileUtilsKt.getEncryptedFile(this.context, guid);
        try {
            Session activeSession = WickrCore.getCoreContext().getSessionManager().getActiveSession();
            if (activeSession != null && activeSession.getFileApiVersion() >= 2) {
                String str = domain;
                if ((str == null || StringsKt.isBlank(str)) && uploader != null) {
                    Timber.INSTANCE.i("Falling back to users domain because provided domain is null or blank", new Object[0]);
                    String domain2 = uploader.getDomain();
                    if (domain2 == null || StringsKt.isBlank(domain2)) {
                        Timber.INSTANCE.i("Refreshing users domain before downloading file", new Object[0]);
                        HashMap<String, WickrUserValidatorResult> mapRefreshUsers = WickrUserValidator.refreshUsers(activeSession, CollectionsKt.listOf(uploader));
                        Intrinsics.checkNotNull(mapRefreshUsers);
                        HashMap<String, WickrUserValidatorResult> map = mapRefreshUsers;
                        if (!map.isEmpty()) {
                            Iterator<Map.Entry<String, WickrUserValidatorResult>> it = map.entrySet().iterator();
                            while (true) {
                                if (!it.hasNext()) {
                                    z = true;
                                    break;
                                }
                                WickrUserValidatorResult value = it.next().getValue();
                                Intrinsics.checkNotNullExpressionValue(value, "<get-value>(...)");
                                if (!ExtensionsKt.getSuccess(value)) {
                                    z = false;
                                    break;
                                }
                            }
                        } else {
                            z = true;
                            break;
                        }
                        if (!z) {
                            Timber.INSTANCE.e("Unable to refresh user before downloading file, file may fail to download", new Object[0]);
                        }
                    }
                    Timber.INSTANCE.d("Adjusted file download domain to " + uploader.getDomain(), new Object[0]);
                }
                Timber.INSTANCE.i("Fetching file from file proxy: " + guid, new Object[0]);
                WickrFileAPI wickrFileAPI3 = this.wickrFileAPI;
                if (wickrFileAPI3 == null) {
                    Intrinsics.throwUninitializedPropertyAccessException("wickrFileAPI");
                    wickrFileAPI = null;
                } else {
                    wickrFileAPI = wickrFileAPI3;
                }
                Boolean boolBlockingGet = wickrFileAPI.downloadFile(activeSession.getUsernameHash(), activeSession.getAppID(), activeSession.getDeviceID(), activeSession.getSessionID(), guid, domain, encryptedFile, new Function2() { // from class: com.wickr.files.FileManager$$ExternalSyntheticLambda0
                    @Override // kotlin.jvm.functions.Function2
                    public final Object invoke(Object obj, Object obj2) {
                        return FileManager.downloadFile$lambda$1(this.f$0, guid, ((Long) obj).longValue(), ((Long) obj2).longValue());
                    }
                }).blockingGet();
                Intrinsics.checkNotNull(boolBlockingGet);
                zBooleanValue = boolBlockingGet.booleanValue();
            } else {
                Timber.INSTANCE.i("Fetching file from server: " + guid, new Object[0]);
                WickrFileAPI wickrFileAPI4 = this.wickrFileAPI;
                if (wickrFileAPI4 == null) {
                    Intrinsics.throwUninitializedPropertyAccessException("wickrFileAPI");
                } else {
                    wickrFileAPI2 = wickrFileAPI4;
                }
                Boolean boolBlockingGet2 = wickrFileAPI2.downloadFile(guid, encryptedFile, new Function2() { // from class: com.wickr.files.FileManager$$ExternalSyntheticLambda1
                    @Override // kotlin.jvm.functions.Function2
                    public final Object invoke(Object obj, Object obj2) {
                        return FileManager.downloadFile$lambda$2(this.f$0, guid, ((Long) obj).longValue(), ((Long) obj2).longValue());
                    }
                }).blockingGet();
                Intrinsics.checkNotNull(boolBlockingGet2);
                zBooleanValue = boolBlockingGet2.booleanValue();
            }
            if (zBooleanValue) {
                if (fileHash == null) {
                    Timber.INSTANCE.d("Updating state to Encrypted", new Object[0]);
                    updateFileState(guid, FileState.Encrypted);
                    removeFileDownloadSize(guid);
                    return true;
                }
                Timber.INSTANCE.d("Hashing downloaded encrypted file", new Object[0]);
                String strHashFile = this.fileEncryptor.hashFile(encryptedFile);
                if (Intrinsics.areEqual(fileHash, strHashFile)) {
                    Timber.INSTANCE.d("Updating state to Encrypted", new Object[0]);
                    updateFileState(guid, FileState.Encrypted);
                    removeFileDownloadSize(guid);
                    return true;
                }
                Timber.INSTANCE.e("File failed integrity check. given hash: %s, calculated hash: %s", fileHash, strHashFile);
            }
        } catch (Exception e) {
            ExtensionsKt.logNetworkError(e);
        }
        Timber.INSTANCE.e("Updating state to FailedDownload", new Object[0]);
        encryptedFile.delete();
        updateFileState(guid, FileState.FailedDownload);
        return false;
    }

    /* JADX INFO: Access modifiers changed from: private */
    public static final Unit downloadFile$lambda$1(FileManager fileManager, String str, long j, long j2) {
        fileManager.progressEvents.onNext(new Pair<>(str, Long.valueOf(j)));
        return Unit.INSTANCE;
    }

    /* JADX INFO: Access modifiers changed from: private */
    public static final Unit downloadFile$lambda$2(FileManager fileManager, String str, long j, long j2) {
        fileManager.progressEvents.onNext(new Pair<>(str, Long.valueOf(j)));
        return Unit.INSTANCE;
    }

    /* JADX WARN: Code duplicated, block: B:70:0x0246 A[Catch: Exception -> 0x0334, TryCatch #2 {Exception -> 0x0334, blocks: (B:3:0x0017, B:5:0x003e, B:8:0x0045, B:9:0x0049, B:11:0x005a, B:13:0x0062, B:16:0x0069, B:19:0x007b, B:21:0x0085, B:28:0x00c2, B:32:0x00cf, B:35:0x00d8, B:37:0x00e0, B:39:0x00e8, B:41:0x0110, B:44:0x0172, B:47:0x0179, B:49:0x0183, B:51:0x018b, B:53:0x0193, B:56:0x01c3, B:58:0x01f3, B:60:0x01f9, B:62:0x0224, B:65:0x0231, B:70:0x0246, B:72:0x0284, B:74:0x02e8, B:76:0x02f5, B:78:0x0310, B:73:0x02c7, B:68:0x0240, B:85:0x0330, B:86:0x0333, B:26:0x00b8, B:18:0x006f, B:10:0x004e, B:23:0x00ac, B:42:0x016a, B:83:0x032e), top: B:95:0x0017, inners: #0, #1, #3 }] */
    /* JADX WARN: Code duplicated, block: B:72:0x0284 A[Catch: Exception -> 0x0334, TryCatch #2 {Exception -> 0x0334, blocks: (B:3:0x0017, B:5:0x003e, B:8:0x0045, B:9:0x0049, B:11:0x005a, B:13:0x0062, B:16:0x0069, B:19:0x007b, B:21:0x0085, B:28:0x00c2, B:32:0x00cf, B:35:0x00d8, B:37:0x00e0, B:39:0x00e8, B:41:0x0110, B:44:0x0172, B:47:0x0179, B:49:0x0183, B:51:0x018b, B:53:0x0193, B:56:0x01c3, B:58:0x01f3, B:60:0x01f9, B:62:0x0224, B:65:0x0231, B:70:0x0246, B:72:0x0284, B:74:0x02e8, B:76:0x02f5, B:78:0x0310, B:73:0x02c7, B:68:0x0240, B:85:0x0330, B:86:0x0333, B:26:0x00b8, B:18:0x006f, B:10:0x004e, B:23:0x00ac, B:42:0x016a, B:83:0x032e), top: B:95:0x0017, inners: #0, #1, #3 }] */
    /* JADX WARN: Code duplicated, block: B:73:0x02c7 A[Catch: Exception -> 0x0334, TryCatch #2 {Exception -> 0x0334, blocks: (B:3:0x0017, B:5:0x003e, B:8:0x0045, B:9:0x0049, B:11:0x005a, B:13:0x0062, B:16:0x0069, B:19:0x007b, B:21:0x0085, B:28:0x00c2, B:32:0x00cf, B:35:0x00d8, B:37:0x00e0, B:39:0x00e8, B:41:0x0110, B:44:0x0172, B:47:0x0179, B:49:0x0183, B:51:0x018b, B:53:0x0193, B:56:0x01c3, B:58:0x01f3, B:60:0x01f9, B:62:0x0224, B:65:0x0231, B:70:0x0246, B:72:0x0284, B:74:0x02e8, B:76:0x02f5, B:78:0x0310, B:73:0x02c7, B:68:0x0240, B:85:0x0330, B:86:0x0333, B:26:0x00b8, B:18:0x006f, B:10:0x004e, B:23:0x00ac, B:42:0x016a, B:83:0x032e), top: B:95:0x0017, inners: #0, #1, #3 }] */
    /* JADX WARN: Code duplicated, block: B:75:0x02ed  */
    public final FileImportResult importFile(FileImportRequest request) {
        String fileName;
        String mimeType;
        AssetFileDescriptor assetFileDescriptorOpenAssetFileDescriptor;
        String str;
        String str2;
        String str3;
        FileImportResult fileImportResult;
        FilePreviewData filePreviewDataGenerateFilePreviewData;
        Intrinsics.checkNotNullParameter(request, "request");
        try {
            Timber.INSTANCE.i("Importing file from Uri " + request.getUri(), new Object[0]);
            ContentResolver contentResolver = this.context.getContentResolver();
            String fileName2 = request.getFileName();
            if (fileName2 == null || fileName2.length() == 0) {
                Uri uri = request.getUri();
                Intrinsics.checkNotNull(contentResolver);
                fileName = FileUtilsKt.getFileName(uri, contentResolver);
            } else {
                fileName = request.getFileName();
            }
            String strSanitize = FileUtilsKt.sanitize(fileName);
            String mimeType2 = request.getMimeType();
            if (mimeType2 == null || mimeType2.length() == 0) {
                Uri uri2 = request.getUri();
                Intrinsics.checkNotNull(contentResolver);
                mimeType = FileUtilsKt.getMimeType(uri2, contentResolver);
            } else {
                mimeType = request.getMimeType();
            }
            String str4 = mimeType;
            InputStream inputStreamOpenInputStream = contentResolver.openInputStream(request.getUri());
            if (inputStreamOpenInputStream == null) {
                Timber.INSTANCE.e("Unable to open input stream for file", new Object[0]);
                return new FileImportResult(false, request.getUri(), null, null, null, 0L, false, null, null, 0L, PointerIconCompat.TYPE_GRAB, null);
            }
            try {
                assetFileDescriptorOpenAssetFileDescriptor = contentResolver.openAssetFileDescriptor(request.getUri(), "r");
            } catch (Exception e) {
                Timber.INSTANCE.e(e);
                assetFileDescriptorOpenAssetFileDescriptor = null;
            }
            long length = assetFileDescriptorOpenAssetFileDescriptor != null ? assetFileDescriptorOpenAssetFileDescriptor.getLength() : -1L;
            if (assetFileDescriptorOpenAssetFileDescriptor != null) {
                assetFileDescriptorOpenAssetFileDescriptor.close();
            }
            if (length != -1 && request.getMaxFileSize() != -1 && length > request.getMaxFileSize()) {
                Timber.INSTANCE.e("Cannot upload file, size is too large", new Object[0]);
                inputStreamOpenInputStream.close();
                return new FileImportResult(false, request.getUri(), null, null, null, 0L, true, null, null, 0L, 956, null);
            }
            String strGenerateGuid = this.fileEncryptor.generateGuid();
            String strGeneratePlaintextFileName = FileUtilsKt.generatePlaintextFileName(strSanitize, str4);
            Timber.INSTANCE.d("FileName: " + strGeneratePlaintextFileName + " mimeType: " + str4 + " fileSize: " + length, new Object[0]);
            File decryptedFile = FileUtilsKt.getDecryptedFile(this.context, strGenerateGuid, strGeneratePlaintextFileName, str4);
            Timber.INSTANCE.d("Importing uri to file " + decryptedFile.getAbsolutePath(), new Object[0]);
            InputStream inputStream = inputStreamOpenInputStream;
            try {
                boolean file = FileUtilsKt.toFile(inputStream, decryptedFile);
                CloseableKt.closeFinally(inputStream, null);
                if (file) {
                    if (length == -1) {
                        long length2 = decryptedFile.length();
                        if (length2 != 0 && request.getMaxFileSize() != -1 && length2 > request.getMaxFileSize()) {
                            Timber.INSTANCE.e("Cannot upload file, size is too large", new Object[0]);
                            inputStreamOpenInputStream.close();
                            decryptedFile.delete();
                            return new FileImportResult(false, request.getUri(), null, null, null, 0L, true, null, null, 0L, 956, null);
                        }
                        if (length2 == 0) {
                            Timber.INSTANCE.e("Cannot upload file, unable to determine file size", new Object[0]);
                            inputStreamOpenInputStream.close();
                            decryptedFile.delete();
                            return new FileImportResult(false, request.getUri(), null, null, null, 0L, false, null, null, 0L, PointerIconCompat.TYPE_GRAB, null);
                        }
                    }
                    if (!validateFile(decryptedFile)) {
                        Timber.INSTANCE.e("Imported file failed internal validation", new Object[0]);
                        decryptedFile.delete();
                        return new FileImportResult(false, request.getUri(), null, null, null, 0L, false, null, null, 0L, PointerIconCompat.TYPE_GRAB, null);
                    }
                    Object obj = null;
                    boolean z = false;
                    if (StringsKt.startsWith$default(str4, "image", false, 2, (Object) null)) {
                        if (StringsKt.contains$default((CharSequence) str4, (CharSequence) "gif", false, 2, (Object) null)) {
                            obj = null;
                            z = false;
                            if (StringsKt.startsWith$default(str4, RRWebVideoEvent.EVENT_TAG, z, 2, obj)) {
                                Timber.INSTANCE.d("Before compression fileSize: " + decryptedFile.length(), new Object[0]);
                                fileImportResult = null;
                                str = strGeneratePlaintextFileName;
                                filePreviewDataGenerateFilePreviewData = generateFilePreviewData(decryptedFile, request.getLargeImageAttachmentsMode(), request.getMaxAutoDownloadSize(), StringsKt.startsWith$default(str4, RRWebVideoEvent.EVENT_TAG, false, 2, (Object) null), request.isLargeFileImprovementsEnabled());
                                if (!ExtensionsKt.isEmpty(filePreviewDataGenerateFilePreviewData.getGuid())) {
                                    str3 = str4;
                                    str2 = strGenerateGuid;
                                    FileImportResult fileImportResult2 = new FileImportResult(true, request.getUri(), str2, str, str3, filePreviewDataGenerateFilePreviewData.getOriginalFile().length(), false, filePreviewDataGenerateFilePreviewData.getFileName(), filePreviewDataGenerateFilePreviewData.getGuid(), filePreviewDataGenerateFilePreviewData.getFileSize(), 64, null);
                                    Timber.INSTANCE.d("After compression preview size: " + filePreviewDataGenerateFilePreviewData.getFileSize(), new Object[0]);
                                    fileImportResult = fileImportResult2;
                                } else {
                                    str2 = strGenerateGuid;
                                    str3 = str4;
                                    Timber.INSTANCE.d("After compression fileSize: " + filePreviewDataGenerateFilePreviewData.getOriginalFile().length(), new Object[0]);
                                }
                                decryptedFile = filePreviewDataGenerateFilePreviewData.getOriginalFile();
                            } else {
                                str = strGeneratePlaintextFileName;
                                str2 = strGenerateGuid;
                                str3 = str4;
                                fileImportResult = null;
                            }
                        } else {
                            Timber.INSTANCE.d("Before compression fileSize: " + decryptedFile.length(), new Object[0]);
                            fileImportResult = null;
                            str = strGeneratePlaintextFileName;
                            filePreviewDataGenerateFilePreviewData = generateFilePreviewData(decryptedFile, request.getLargeImageAttachmentsMode(), request.getMaxAutoDownloadSize(), StringsKt.startsWith$default(str4, RRWebVideoEvent.EVENT_TAG, false, 2, (Object) null), request.isLargeFileImprovementsEnabled());
                            if (!ExtensionsKt.isEmpty(filePreviewDataGenerateFilePreviewData.getGuid())) {
                                str3 = str4;
                                str2 = strGenerateGuid;
                                FileImportResult fileImportResult3 = new FileImportResult(true, request.getUri(), str2, str, str3, filePreviewDataGenerateFilePreviewData.getOriginalFile().length(), false, filePreviewDataGenerateFilePreviewData.getFileName(), filePreviewDataGenerateFilePreviewData.getGuid(), filePreviewDataGenerateFilePreviewData.getFileSize(), 64, null);
                                Timber.INSTANCE.d("After compression preview size: " + filePreviewDataGenerateFilePreviewData.getFileSize(), new Object[0]);
                                fileImportResult = fileImportResult3;
                            } else {
                                str2 = strGenerateGuid;
                                str3 = str4;
                                Timber.INSTANCE.d("After compression fileSize: " + filePreviewDataGenerateFilePreviewData.getOriginalFile().length(), new Object[0]);
                            }
                            decryptedFile = filePreviewDataGenerateFilePreviewData.getOriginalFile();
                        }
                    } else if (StringsKt.startsWith$default(str4, RRWebVideoEvent.EVENT_TAG, z, 2, obj)) {
                        Timber.INSTANCE.d("Before compression fileSize: " + decryptedFile.length(), new Object[0]);
                        fileImportResult = null;
                        str = strGeneratePlaintextFileName;
                        filePreviewDataGenerateFilePreviewData = generateFilePreviewData(decryptedFile, request.getLargeImageAttachmentsMode(), request.getMaxAutoDownloadSize(), StringsKt.startsWith$default(str4, RRWebVideoEvent.EVENT_TAG, false, 2, (Object) null), request.isLargeFileImprovementsEnabled());
                        if (!ExtensionsKt.isEmpty(filePreviewDataGenerateFilePreviewData.getGuid())) {
                            str3 = str4;
                            str2 = strGenerateGuid;
                            FileImportResult fileImportResult4 = new FileImportResult(true, request.getUri(), str2, str, str3, filePreviewDataGenerateFilePreviewData.getOriginalFile().length(), false, filePreviewDataGenerateFilePreviewData.getFileName(), filePreviewDataGenerateFilePreviewData.getGuid(), filePreviewDataGenerateFilePreviewData.getFileSize(), 64, null);
                            Timber.INSTANCE.d("After compression preview size: " + filePreviewDataGenerateFilePreviewData.getFileSize(), new Object[0]);
                            fileImportResult = fileImportResult4;
                        } else {
                            str2 = strGenerateGuid;
                            str3 = str4;
                            Timber.INSTANCE.d("After compression fileSize: " + filePreviewDataGenerateFilePreviewData.getOriginalFile().length(), new Object[0]);
                        }
                        decryptedFile = filePreviewDataGenerateFilePreviewData.getOriginalFile();
                    } else {
                        str = strGeneratePlaintextFileName;
                        str2 = strGenerateGuid;
                        str3 = str4;
                        fileImportResult = null;
                    }
                    Timber.INSTANCE.d("Successfully imported file " + decryptedFile.getAbsolutePath(), new Object[0]);
                    if (fileImportResult == null) {
                        return new FileImportResult(true, request.getUri(), str2, str, str3, decryptedFile.length(), false, null, null, 0L, 960, null);
                    }
                    return fileImportResult;
                }
            } catch (Throwable th) {
                try {
                    throw th;
                } catch (Throwable th2) {
                    CloseableKt.closeFinally(inputStream, th);
                    throw th2;
                }
            }
        } catch (Exception e2) {
            Timber.INSTANCE.e(e2);
        }
        return new FileImportResult(false, request.getUri(), null, null, null, 0L, false, null, null, 0L, PointerIconCompat.TYPE_GRAB, null);
    }

    public final boolean exportFile(FileExportRequest request) {
        Intrinsics.checkNotNullParameter(request, "request");
        boolean success = false;
        Timber.INSTANCE.d("Exporting file. Request: " + request, new Object[0]);
        File encryptedFile = FileUtilsKt.getEncryptedFile(this.context, request.getGuid());
        File decryptedFile = FileUtilsKt.getDecryptedFile(this.context, request.getGuid(), request.getFileName(), request.getMimeType());
        File file = new File(request.getOutputFolder(), request.getFileName());
        if (!request.getOverwrite()) {
            Timber.INSTANCE.d("Renaming " + file.getAbsolutePath(), new Object[0]);
            file = FileUtilsKt.renameIfExists(file);
            Timber.INSTANCE.d("Renamed to " + file.getAbsolutePath(), new Object[0]);
        }
        if (decryptedFile.exists()) {
            Timber.INSTANCE.i("Exporting using decrypted file", new Object[0]);
            success = FileUtilsKt.copy(decryptedFile, file, false);
        } else if (encryptedFile.exists()) {
            Timber.INSTANCE.i("Exporting using encrypted file", new Object[0]);
            success = decryptFile(new FileDecryptionRequest(request.getGuid(), request.getDecryptionKey(), request.getOutputFolder(), request.getFileName(), false)).getSuccess();
        }
        if (success) {
            Object systemService = this.context.getSystemService("download");
            Intrinsics.checkNotNull(systemService, "null cannot be cast to non-null type android.app.DownloadManager");
            ((DownloadManager) systemService).addCompletedDownload(file.getName(), file.getName(), true, request.getMimeType(), file.getAbsolutePath(), file.length(), request.getShowNotification());
            return success;
        }
        file.delete();
        return success;
    }

    private final FilePreviewData generateFilePreviewData(File file, LargeImageAttachmentsMode largeImageAttachmentsMode, long maxAutoDownloadSize, boolean isVideoFile, boolean isLargeFileImprovementsEnabled) {
        File file2;
        Bitmap bitmapDecodeBitmapFromFile;
        if (isLargeFileImprovementsEnabled) {
            file2 = file;
            try {
                if (isVideoFile) {
                    MediaMetadataRetriever mediaMetadataRetriever = new MediaMetadataRetriever();
                    mediaMetadataRetriever.setDataSource(file2.getAbsolutePath());
                    Bitmap frameAtTime = mediaMetadataRetriever.getFrameAtTime(0L, 2);
                    if (frameAtTime == null) {
                        return new FilePreviewData(null, null, 0L, file2, 7, null);
                    }
                    return generatePreviewDataForThumbnail(frameAtTime, file2);
                }
                if (largeImageAttachmentsMode == LargeImageAttachmentsMode.ORIGINAL) {
                    if (maxAutoDownloadSize != -1 && file2.length() > maxAutoDownloadSize) {
                        return generatePreviewDataForThumbnail(decodeBitmapFromFile(file2), file2);
                    }
                    return new FilePreviewData(null, null, 0L, file2, 7, null);
                }
                if (largeImageAttachmentsMode == LargeImageAttachmentsMode.OPTIMIZED) {
                    if (this.networkStatusMonitor.isWifiConnected()) {
                        if (maxAutoDownloadSize != -1 && file2.length() > maxAutoDownloadSize) {
                            bitmapDecodeBitmapFromFile = decodeBitmapFromFile(file2);
                        }
                        return new FilePreviewData(null, null, 0L, file2, 7, null);
                    }
                    compressLargeImageFile(decodeBitmapFromFile(file2), file2);
                    if (maxAutoDownloadSize != -1 && file2.length() > maxAutoDownloadSize) {
                        bitmapDecodeBitmapFromFile = decodeBitmapFromFile(file2);
                    }
                    return new FilePreviewData(null, null, 0L, file2, 7, null);
                    return generatePreviewDataForThumbnail(bitmapDecodeBitmapFromFile, file2);
                }
                if (largeImageAttachmentsMode == LargeImageAttachmentsMode.DATASAVER) {
                    compressLargeImageFile(decodeBitmapFromFile(file2), file2);
                    if (maxAutoDownloadSize != -1 && file2.length() > maxAutoDownloadSize) {
                        return generatePreviewDataForThumbnail(decodeBitmapFromFile(file2), file2);
                    }
                    return new FilePreviewData(null, null, 0L, file2, 7, null);
                }
                return new FilePreviewData(null, null, 0L, file2, 7, null);
            } catch (Exception e) {
                e = e;
            }
        } else {
            try {
                try {
                    return new FilePreviewData(null, null, 0L, file, 7, null);
                } catch (Exception e2) {
                    e = e2;
                    file2 = file;
                }
            } catch (Exception e3) {
                e = e3;
                file2 = file;
            }
        }
        Exception exc = e;
        Timber.INSTANCE.d("Error generating preview data for file " + file2.getName() + ": " + exc.getMessage(), new Object[0]);
        return new FilePreviewData(null, null, 0L, file2, 7, null);
    }

    private final void compressLargeImageFile(Bitmap selectedBitmap, File file) {
        scaleFilePreviewImage(selectedBitmap, false).compress(Bitmap.CompressFormat.JPEG, 100, new FileOutputStream(file));
    }

    private final Bitmap decodeBitmapFromFile(File file) throws IOException {
        FileInputStream fileInputStream = new FileInputStream(file);
        Bitmap bitmapDecodeStream = BitmapFactory.decodeStream(fileInputStream);
        fileInputStream.close();
        Intrinsics.checkNotNull(bitmapDecodeStream);
        return bitmapDecodeStream;
    }

    static /* synthetic */ Bitmap scaleFilePreviewImage$default(FileManager fileManager, Bitmap bitmap, boolean z, int i, Object obj) {
        if ((i & 2) != 0) {
            z = false;
        }
        return fileManager.scaleFilePreviewImage(bitmap, z);
    }

    private final Bitmap scaleFilePreviewImage(Bitmap bitmap, boolean forThumbnail) {
        int i;
        int i2 = forThumbnail ? 1024 : 2048;
        int width = bitmap.getWidth();
        int height = bitmap.getHeight();
        if (width > height) {
            i = (height * i2) / width;
        } else {
            int i3 = (width * i2) / height;
            i = i2;
            i2 = i3;
        }
        Bitmap bitmapCreateScaledBitmap = Bitmap.createScaledBitmap(bitmap, i2, i, true);
        Intrinsics.checkNotNullExpressionValue(bitmapCreateScaledBitmap, "createScaledBitmap(...)");
        return bitmapCreateScaledBitmap;
    }

    private final FilePreviewData generatePreviewDataForThumbnail(Bitmap thumbnailBitmap, File originalFile) {
        String strGenerateGuid = this.fileEncryptor.generateGuid();
        String str = strGenerateGuid + ".jpg";
        File decryptedFile = FileUtilsKt.getDecryptedFile(this.context, str);
        scaleFilePreviewImage(thumbnailBitmap, true).compress(Bitmap.CompressFormat.JPEG, 100, new FileOutputStream(decryptedFile));
        return new FilePreviewData(str, strGenerateGuid, decryptedFile.length(), originalFile);
    }

    @Override // com.wickr.files.IFileManager
    public void cleanupDecryptedFiles(boolean includeLockedFiles) {
        File[] fileArrListFiles;
        Timber.INSTANCE.i("Clearing out cached decrypted files", new Object[0]);
        File[] fileArrListFiles2 = FileUtilsKt.getDecryptedFileDirectory(this.context).listFiles();
        if (fileArrListFiles2 != null) {
            for (final File file : fileArrListFiles2) {
                Intrinsics.checkNotNull(file);
                File fileLockFile = lockFile(file);
                if (!fileLockFile.exists() || includeLockedFiles) {
                    FileState fileState = getFileState(FilesKt.getNameWithoutExtension(file));
                    if (fileState != FileState.Encrypting && fileState != FileState.Uploading) {
                        if (!file.isDirectory()) {
                            Timber.INSTANCE.d("Deleting cached " + fileState + " decrypted file " + file.getName() + " and optional lock file", new Object[0]);
                            file.delete();
                            fileLockFile.delete();
                            com.wickr.calling.ExtensionsKt.suppress(new Function0() { // from class: com.wickr.files.FileManager$$ExternalSyntheticLambda3
                                @Override // kotlin.jvm.functions.Function0
                                public final Object invoke() {
                                    return FileManager.cleanupDecryptedFiles$lambda$0$0(this.f$0, file);
                                }
                            });
                            if (FileUtilsKt.getEncryptedFile(this.context, FilesKt.getNameWithoutExtension(file)).exists()) {
                                updateFileState(FilesKt.getNameWithoutExtension(file), FileState.Encrypted);
                            } else {
                                updateFileState(FilesKt.getNameWithoutExtension(file), FileState.NeedsDownload);
                            }
                        }
                    } else {
                        Timber.INSTANCE.d("Not deleting " + file.getName() + " because it's state is " + fileState, new Object[0]);
                    }
                } else {
                    Timber.INSTANCE.d("Not deleting " + file.getName() + " because it is locked", new Object[0]);
                }
            }
        }
        if (!includeLockedFiles || (fileArrListFiles = FileUtilsKt.getLockFileDirectory(this.context).listFiles()) == null) {
            return;
        }
        for (File file2 : fileArrListFiles) {
            Timber.INSTANCE.d("Deleting lock file " + file2, new Object[0]);
            file2.delete();
        }
    }

    /* JADX INFO: Access modifiers changed from: private */
    public static final Unit cleanupDecryptedFiles$lambda$0$0(FileManager fileManager, File file) {
        fileManager.context.revokeUriPermission(Uri.fromFile(file), 1);
        return Unit.INSTANCE;
    }

    @Override // com.wickr.files.IFileManager
    public void cleanupInProgressFileDownloads() {
        File[] fileArrListFiles = FileUtilsKt.getEncryptedFileDirectory(this.context).listFiles();
        Intrinsics.checkNotNullExpressionValue(fileArrListFiles, "listFiles(...)");
        ArrayList<File> arrayList = new ArrayList();
        for (File file : fileArrListFiles) {
            if (!file.isDirectory()) {
                arrayList.add(file);
            }
        }
        for (File file2 : arrayList) {
            String name = file2.getName();
            Intrinsics.checkNotNullExpressionValue(name, "getName(...)");
            Long fileDownloadSize = getFileDownloadSize(name);
            String name2 = file2.getName();
            Intrinsics.checkNotNullExpressionValue(name2, "getName(...)");
            FileState fileState = getFileState(name2);
            if (fileDownloadSize != null && fileState == FileState.Encrypted) {
                if (file2.length() != fileDownloadSize.longValue()) {
                    String name3 = file2.getName();
                    Intrinsics.checkNotNullExpressionValue(name3, "getName(...)");
                    updateFileState(name3, FileState.NeedsDownload);
                    file2.delete();
                }
                String name4 = file2.getName();
                Intrinsics.checkNotNullExpressionValue(name4, "getName(...)");
                removeFileDownloadSize(name4);
            }
        }
    }

    public final void cancelFileRequest(String guid) {
        Intrinsics.checkNotNullParameter(guid, "guid");
        if (this.wickrFileAPI != null) {
            Timber.INSTANCE.i("Attempting to cancel " + guid, new Object[0]);
            WickrFileAPI wickrFileAPI = this.wickrFileAPI;
            if (wickrFileAPI == null) {
                Intrinsics.throwUninitializedPropertyAccessException("wickrFileAPI");
                wickrFileAPI = null;
            }
            wickrFileAPI.cancelFile(guid);
        }
    }

    public static /* synthetic */ void deleteFiles$default(FileManager fileManager, String str, boolean z, int i, Object obj) {
        if ((i & 2) != 0) {
            z = false;
        }
        fileManager.deleteFiles(str, z);
    }

    public final void deleteFiles(final String guid, boolean deleteEncrypted) {
        Intrinsics.checkNotNullParameter(guid, "guid");
        if (!FileUtilsKt.validateGuid(guid)) {
            Timber.INSTANCE.i("Invalid file guid, file cleanup failed", new Object[0]);
            WickrBugReporter.report$default(new IllegalStateException("Invalid file guid"), null, null, 6, null);
            return;
        }
        cancelFileRequest(guid);
        File[] fileArrListFiles = FileUtilsKt.getDecryptedFileDirectory(this.context).listFiles(new FileFilter() { // from class: com.wickr.files.FileManager$$ExternalSyntheticLambda5
            @Override // java.io.FileFilter
            public final boolean accept(File file) {
                return FileManager.deleteFiles$lambda$0(guid, file);
            }
        });
        if (fileArrListFiles != null) {
            for (final File file : fileArrListFiles) {
                Timber.INSTANCE.i("Deleting decrypted file for " + guid + ": " + file.getName(), new Object[0]);
                file.delete();
                com.wickr.calling.ExtensionsKt.suppress(new Function0() { // from class: com.wickr.files.FileManager$$ExternalSyntheticLambda6
                    @Override // kotlin.jvm.functions.Function0
                    public final Object invoke() {
                        return FileManager.deleteFiles$lambda$1$0(this.f$0, file);
                    }
                });
                Intrinsics.checkNotNull(file);
                removeFileLock(file);
            }
        }
        File encryptedFile = FileUtilsKt.getEncryptedFile(this.context, guid);
        if (deleteEncrypted && encryptedFile.exists()) {
            Timber.INSTANCE.i("Deleting encrypted file for " + guid + ": " + encryptedFile.getName(), new Object[0]);
            encryptedFile.delete();
        }
        if (encryptedFile.exists()) {
            updateFileState(guid, FileState.Encrypted);
        } else {
            this.states.remove(guid);
        }
    }

    /* JADX INFO: Access modifiers changed from: private */
    public static final boolean deleteFiles$lambda$0(String str, File file) {
        Intrinsics.checkNotNull(file);
        return Intrinsics.areEqual(FilesKt.getNameWithoutExtension(file), str);
    }

    /* JADX INFO: Access modifiers changed from: private */
    public static final Unit deleteFiles$lambda$1$0(FileManager fileManager, File file) {
        fileManager.context.revokeUriPermission(Uri.fromFile(file), 1);
        return Unit.INSTANCE;
    }

    public final void deleteAllFiles() {
        Set<String> setKeySet = this.states.keySet();
        Intrinsics.checkNotNullExpressionValue(setKeySet, "<get-keys>(...)");
        for (String str : setKeySet) {
            Intrinsics.checkNotNull(str);
            cancelFileRequest(str);
        }
        File[] fileArrListFiles = FileUtilsKt.getEncryptedFileDirectory(this.context).listFiles();
        if (fileArrListFiles != null) {
            for (File file : fileArrListFiles) {
                file.delete();
            }
        }
        File[] fileArrListFiles2 = FileUtilsKt.getDecryptedFileDirectory(this.context).listFiles();
        if (fileArrListFiles2 != null) {
            for (final File file2 : fileArrListFiles2) {
                file2.delete();
                com.wickr.calling.ExtensionsKt.suppress(new Function0() { // from class: com.wickr.files.FileManager$$ExternalSyntheticLambda8
                    @Override // kotlin.jvm.functions.Function0
                    public final Object invoke() {
                        return FileManager.deleteAllFiles$lambda$2$0(this.f$0, file2);
                    }
                });
            }
        }
        regenerateFileStates();
    }

    /* JADX INFO: Access modifiers changed from: private */
    public static final Unit deleteAllFiles$lambda$2$0(FileManager fileManager, File file) {
        fileManager.context.revokeUriPermission(Uri.fromFile(file), 1);
        return Unit.INSTANCE;
    }

    public final FileState getFileState(String guid) {
        Intrinsics.checkNotNullParameter(guid, "guid");
        if (!this.states.containsKey(guid)) {
            this.states.put(guid, FileState.NeedsDownload);
        }
        FileState fileState = this.states.get(guid);
        Intrinsics.checkNotNull(fileState);
        return fileState;
    }

    public final long getFileProgress(String guid) {
        Intrinsics.checkNotNullParameter(guid, "guid");
        Long l = this.lastSeenProgressValues.get(guid);
        if (l != null) {
            return l.longValue();
        }
        return -1L;
    }

    private final void updateFileState(String guid, FileState state) {
        Timber.INSTANCE.i("Updating guid " + guid + " state to " + state.name(), new Object[0]);
        this.states.put(guid, state);
        this.stateEvents.onNext(new Pair<>(guid, state));
    }

    private final void regenerateFileStates() {
        Object obj;
        File[] fileArrListFiles = FileUtilsKt.getDecryptedFileDirectory(this.context).listFiles();
        Intrinsics.checkNotNullExpressionValue(fileArrListFiles, "listFiles(...)");
        ArrayList arrayList = new ArrayList();
        for (File file : fileArrListFiles) {
            if (!file.isDirectory()) {
                arrayList.add(file);
            }
        }
        ArrayList arrayList2 = arrayList;
        File[] fileArrListFiles2 = FileUtilsKt.getEncryptedFileDirectory(this.context).listFiles();
        Intrinsics.checkNotNullExpressionValue(fileArrListFiles2, "listFiles(...)");
        ArrayList<File> arrayList3 = new ArrayList();
        for (File file2 : fileArrListFiles2) {
            if (!file2.isDirectory()) {
                arrayList3.add(file2);
            }
        }
        for (File file3 : arrayList3) {
            String name = file3.getName();
            Intrinsics.checkNotNullExpressionValue(name, "getName(...)");
            updateFileState(name, FileState.Encrypted);
            Iterator it = arrayList2.iterator();
            while (true) {
                obj = null;
                if (!it.hasNext()) {
                    break;
                }
                Object next = it.next();
                String name2 = ((File) next).getName();
                Intrinsics.checkNotNullExpressionValue(name2, "getName(...)");
                String name3 = file3.getName();
                Intrinsics.checkNotNullExpressionValue(name3, "getName(...)");
                if (StringsKt.startsWith$default(name2, name3, false, 2, (Object) null)) {
                    obj = next;
                    break;
                }
            }
            File file4 = (File) obj;
            if (file4 != null ? file4.exists() : false) {
                String name4 = file3.getName();
                Intrinsics.checkNotNullExpressionValue(name4, "getName(...)");
                updateFileState(name4, FileState.Decrypted);
            }
        }
        for (Map.Entry<String, FileState> entry : this.states.entrySet()) {
            String key = entry.getKey();
            FileState value = entry.getValue();
            if (value != FileState.Encrypted && value != FileState.Decrypted) {
                updateFileState(key, FileState.NeedsDownload);
            }
        }
    }

    private final void clearTempFiles() {
        Timber.INSTANCE.i("Clearing out temporary files", new Object[0]);
        File[] fileArrListFiles = FileUtilsKt.getTemporaryFileDirectory(this.context).listFiles();
        if (fileArrListFiles != null) {
            for (File file : fileArrListFiles) {
                Timber.INSTANCE.d("Deleting " + file.getName(), new Object[0]);
                file.delete();
            }
        }
    }

    private final boolean validateFile(File file) {
        List listFlatten = ArraysKt.flatten(new File[][]{this.context.getFilesDir().listFiles(), FileUtilsKt.databaseDirectory(this.context).listFiles(), FileUtilsKt.getTemporaryFileDirectory(this.context).listFiles(), FileUtilsKt.getEncryptedFileDirectory(this.context).listFiles()});
        ArrayList arrayList = new ArrayList();
        for (Object obj : listFlatten) {
            File file2 = (File) obj;
            if (!Intrinsics.areEqual(file2.getName(), file.getName())) {
                String name = file2.getName();
                File file3 = this.tmpFile;
                if (!Intrinsics.areEqual(name, file3 != null ? file3.getName() : null) && file2.length() == file.length()) {
                    arrayList.add(obj);
                }
            }
        }
        ArrayList<File> arrayList2 = arrayList;
        if (!arrayList2.isEmpty()) {
            String strHashFile = this.fileEncryptor.hashFile(file);
            for (File file4 : arrayList2) {
                FileEncryptor fileEncryptor = this.fileEncryptor;
                Intrinsics.checkNotNull(file4);
                if (Intrinsics.areEqual(fileEncryptor.hashFile(file4), strHashFile)) {
                    Timber.INSTANCE.e("File failed validation. Match: " + file4.getName(), new Object[0]);
                    return false;
                }
            }
        }
        return true;
    }

    @Override // com.wickr.files.IFileManager
    public void removeDecryptedFileLocks() {
        Timber.INSTANCE.i("Removing all cached decrypted file locks", new Object[0]);
        File[] fileArrListFiles = FileUtilsKt.getLockFileDirectory(this.context).listFiles();
        if (fileArrListFiles != null) {
            for (File file : fileArrListFiles) {
                Timber.INSTANCE.d("Deleting file lock " + file.getName(), new Object[0]);
                file.delete();
            }
        }
    }

    private final void addFileLock(File file) throws IOException {
        File fileLockFile = lockFile(file);
        if (!fileLockFile.exists()) {
            Timber.INSTANCE.d("Creating file lock " + fileLockFile.getName(), new Object[0]);
            fileLockFile.createNewFile();
            return;
        }
        Timber.INSTANCE.w("Lock file " + fileLockFile.getName() + " already exists", new Object[0]);
    }

    private final void removeFileLock(File file) {
        File fileLockFile = lockFile(file);
        if (fileLockFile.exists()) {
            Timber.INSTANCE.d("Deleting file lock " + fileLockFile.getName(), new Object[0]);
            fileLockFile.delete();
        }
    }

    private final File lockFile(File file) {
        return new File(FileUtilsKt.getLockFileDirectory(this.context), FilesKt.getNameWithoutExtension(file) + ".lock");
    }

    private final boolean setFileDownloadSize(String guid, long size) {
        ContentValues contentValues = new ContentValues();
        contentValues.put("guid", guid);
        contentValues.put("size", Long.valueOf(size));
        return this.databaseAdapter.getWritableDatabase().insertWithOnConflict(Schema.TABLE_NAME, null, contentValues, 5) > 0;
    }

    private final boolean removeFileDownloadSize(String guid) {
        return this.databaseAdapter.getWritableDatabase().delete(Schema.TABLE_NAME, "guid = ?", new String[]{guid}) > 0;
    }

    private final Long getFileDownloadSize(String guid) {
        Cursor cursorQuery = this.databaseAdapter.getWritableDatabase().query(Schema.TABLE_NAME, null, "guid = ?", new String[]{guid}, null, null, null);
        try {
            Cursor cursor = cursorQuery;
            if (!cursor.moveToFirst()) {
                CloseableKt.closeFinally(cursorQuery, null);
                return null;
            }
            Long lValueOf = Long.valueOf(cursor.getLong(cursor.getColumnIndex("size")));
            CloseableKt.closeFinally(cursorQuery, null);
            return lValueOf;
        } catch (Throwable th) {
            try {
                throw th;
            } catch (Throwable th2) {
                CloseableKt.closeFinally(cursorQuery, th);
                throw th2;
            }
        }
    }

    /* JADX INFO: compiled from: FileManager.kt */
    @Metadata(d1 = {"\u0000\f\n\u0002\u0018\u0002\n\u0002\u0018\u0002\n\u0002\b\u0004\u0018\u0000 \u00042\u00020\u0001:\u0001\u0004B\u0007¢\u0006\u0004\b\u0002\u0010\u0003¨\u0006\u0005"}, d2 = {"Lcom/wickr/files/FileManager$Schema;", "Landroid/provider/BaseColumns;", "<init>", "()V", "Companion", "wickrcoreandroid_release"}, k = 1, mv = {2, 2, 0}, xi = 48)
    public static final class Schema implements BaseColumns {
        private static final String CREATE_TABLE;

        /* JADX INFO: renamed from: Companion, reason: from kotlin metadata */
        public static final Companion INSTANCE = new Companion(null);
        public static final String KEY_guid = "guid";
        public static final String KEY_size = "size";
        public static final String TABLE_NAME = "Wickr_File_Download_Size";

        /* JADX INFO: compiled from: FileManager.kt */
        @Metadata(d1 = {"\u0000\u0014\n\u0002\u0018\u0002\n\u0002\u0010\u0000\n\u0002\b\u0003\n\u0002\u0010\u000e\n\u0002\b\u0006\b\u0086\u0003\u0018\u00002\u00020\u0001B\t\b\u0002¢\u0006\u0004\b\u0002\u0010\u0003R\u000e\u0010\u0004\u001a\u00020\u0005X\u0086T¢\u0006\u0002\n\u0000R\u000e\u0010\u0006\u001a\u00020\u0005X\u0086T¢\u0006\u0002\n\u0000R\u000e\u0010\u0007\u001a\u00020\u0005X\u0086T¢\u0006\u0002\n\u0000R\u0011\u0010\b\u001a\u00020\u0005¢\u0006\b\n\u0000\u001a\u0004\b\t\u0010\n¨\u0006\u000b"}, d2 = {"Lcom/wickr/files/FileManager$Schema$Companion;", "", "<init>", "()V", "TABLE_NAME", "", "KEY_guid", "KEY_size", "CREATE_TABLE", "getCREATE_TABLE", "()Ljava/lang/String;", "wickrcoreandroid_release"}, k = 1, mv = {2, 2, 0}, xi = 48)
        public static final class Companion {
            public /* synthetic */ Companion(DefaultConstructorMarker defaultConstructorMarker) {
                this();
            }

            private Companion() {
            }

            public final String getCREATE_TABLE() {
                return Schema.CREATE_TABLE;
            }
        }

        static {
            StringCompanionObject stringCompanionObject = StringCompanionObject.INSTANCE;
            String str = String.format("CREATE TABLE %s (%s TEXT UNIQUE, %s BIGINT )", Arrays.copyOf(new Object[]{TABLE_NAME, "guid", "size"}, 3));
            Intrinsics.checkNotNullExpressionValue(str, "format(...)");
            CREATE_TABLE = str;
        }
    }
}
