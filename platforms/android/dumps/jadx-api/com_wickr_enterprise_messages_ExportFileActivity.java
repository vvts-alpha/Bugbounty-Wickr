package com.wickr.enterprise.messages;

import android.content.ContentResolver;
import android.content.Context;
import android.content.Intent;
import android.graphics.drawable.ColorDrawable;
import android.net.Uri;
import android.os.Bundle;
import com.wickr.bugreporter.Severity;
import com.wickr.bugreporter.WickrBugReporter;
import com.wickr.enterprise.App;
import com.wickr.enterprise.base.BaseView;
import com.wickr.enterprise.base.ValidSessionActivity;
import com.wickr.enterprise.messages.model.AttachmentMetaData;
import com.wickr.enterprise.notifications.NotificationManager;
import com.wickr.enterprise.util.RxExtensionsKt;
import com.wickr.files.FileDecryptionRequest;
import com.wickr.files.FileDecryptionResult;
import com.wickr.files.FileManager;
import com.wickr.mls.PersistentChatNotice;
import com.wickr.pro.R;
import com.wickr.util.FileUtilsKt;
import io.reactivex.rxjava3.core.Observable;
import io.reactivex.rxjava3.disposables.Disposable;
import io.reactivex.rxjava3.functions.Consumer;
import io.reactivex.rxjava3.functions.Function;
import io.reactivex.rxjava3.schedulers.Schedulers;
import java.io.File;
import java.io.FileInputStream;
import java.io.OutputStream;
import kotlin.Lazy;
import kotlin.LazyKt;
import kotlin.Metadata;
import kotlin.io.ByteStreamsKt;
import kotlin.io.CloseableKt;
import kotlin.jvm.functions.Function0;
import kotlin.jvm.internal.DefaultConstructorMarker;
import kotlin.jvm.internal.Intrinsics;
import timber.log.Timber;

/* JADX INFO: compiled from: ExportFileActivity.kt */
/* JADX INFO: loaded from: classes3.dex */
@Metadata(d1 = {"\u0000@\n\u0002\u0018\u0002\n\u0002\u0018\u0002\n\u0002\b\u0003\n\u0002\u0010\u000b\n\u0002\b\u0003\n\u0002\u0018\u0002\n\u0002\b\u0005\n\u0002\u0018\u0002\n\u0000\n\u0002\u0010\u0002\n\u0000\n\u0002\u0018\u0002\n\u0002\b\u0002\n\u0002\u0010\b\n\u0002\b\u0002\n\u0002\u0018\u0002\n\u0002\b\u0004\b\u0007\u0018\u0000 \u001c2\u00020\u0001:\u0001\u001cB\u0007¢\u0006\u0004\b\u0002\u0010\u0003J\u0012\u0010\u0010\u001a\u00020\u00112\b\u0010\u0012\u001a\u0004\u0018\u00010\u0013H\u0014J\"\u0010\u0014\u001a\u00020\u00112\u0006\u0010\u0015\u001a\u00020\u00162\u0006\u0010\u0017\u001a\u00020\u00162\b\u0010\u0018\u001a\u0004\u0018\u00010\u0019H\u0014J\b\u0010\u001a\u001a\u00020\u0011H\u0002J\u001a\u0010\u001b\u001a\u00020\u00112\u0006\u0010\u0017\u001a\u00020\u00162\b\u0010\u0018\u001a\u0004\u0018\u00010\u0019H\u0002R\u0014\u0010\u0004\u001a\u00020\u0005X\u0096D¢\u0006\b\n\u0000\u001a\u0004\b\u0006\u0010\u0007R\u001b\u0010\b\u001a\u00020\t8BX\u0082\u0084\u0002¢\u0006\f\n\u0004\b\f\u0010\r\u001a\u0004\b\n\u0010\u000bR\u000e\u0010\u000e\u001a\u00020\u000fX\u0082.¢\u0006\u0002\n\u0000¨\u0006\u001d"}, d2 = {"Lcom/wickr/enterprise/messages/ExportFileActivity;", "Lcom/wickr/enterprise/base/ValidSessionActivity;", "<init>", "()V", "lockOrientation", "", "getLockOrientation", "()Z", "fileManager", "Lcom/wickr/files/FileManager;", "getFileManager", "()Lcom/wickr/files/FileManager;", "fileManager$delegate", "Lkotlin/Lazy;", PersistentChatNotice.Schema.KEY_metadata, "Lcom/wickr/enterprise/messages/model/AttachmentMetaData;", "onCreate", "", "savedInstanceState", "Landroid/os/Bundle;", "onActivityResult", "requestCode", "", "resultCode", "data", "Landroid/content/Intent;", "exportFile", "processFileCreateResult", "Companion", "app_awsRelease"}, k = 1, mv = {2, 2, 0}, xi = 48)
public final class ExportFileActivity extends ValidSessionActivity {

    /* JADX INFO: renamed from: fileManager$delegate, reason: from kotlin metadata */
    private final Lazy fileManager = LazyKt.lazy(new Function0() { // from class: com.wickr.enterprise.messages.ExportFileActivity$$ExternalSyntheticLambda0
        @Override // kotlin.jvm.functions.Function0
        public final Object invoke() {
            return ExportFileActivity.fileManager_delegate$lambda$0();
        }
    });
    private final boolean lockOrientation;
    private AttachmentMetaData metadata;

    /* JADX INFO: renamed from: Companion, reason: from kotlin metadata */
    public static final Companion INSTANCE = new Companion(null);
    public static final int $stable = 8;
    private static final String EXTRA_METADATA = PersistentChatNotice.Schema.KEY_metadata;
    private static final int REQUEST_CREATE_FILE = 100;

    /* JADX INFO: compiled from: ExportFileActivity.kt */
    @Metadata(d1 = {"\u0000*\n\u0002\u0018\u0002\n\u0002\u0010\u0000\n\u0002\b\u0003\n\u0002\u0010\u000e\n\u0000\n\u0002\u0010\b\n\u0000\n\u0002\u0010\u0002\n\u0000\n\u0002\u0018\u0002\n\u0000\n\u0002\u0018\u0002\n\u0000\b\u0086\u0003\u0018\u00002\u00020\u0001B\t\b\u0002¢\u0006\u0004\b\u0002\u0010\u0003J\u0016\u0010\b\u001a\u00020\t2\u0006\u0010\n\u001a\u00020\u000b2\u0006\u0010\f\u001a\u00020\rR\u000e\u0010\u0004\u001a\u00020\u0005X\u0082D¢\u0006\u0002\n\u0000R\u000e\u0010\u0006\u001a\u00020\u0007X\u0082D¢\u0006\u0002\n\u0000¨\u0006\u000e"}, d2 = {"Lcom/wickr/enterprise/messages/ExportFileActivity$Companion;", "", "<init>", "()V", "EXTRA_METADATA", "", "REQUEST_CREATE_FILE", "", "exportFile", "", "context", "Landroid/content/Context;", PersistentChatNotice.Schema.KEY_metadata, "Lcom/wickr/enterprise/messages/model/AttachmentMetaData;", "app_awsRelease"}, k = 1, mv = {2, 2, 0}, xi = 48)
    public static final class Companion {
        public /* synthetic */ Companion(DefaultConstructorMarker defaultConstructorMarker) {
            this();
        }

        private Companion() {
        }

        public final void exportFile(Context context, AttachmentMetaData metadata) {
            Intrinsics.checkNotNullParameter(context, "context");
            Intrinsics.checkNotNullParameter(metadata, "metadata");
            Intent intent = new Intent(context, (Class<?>) ExportFileActivity.class);
            intent.putExtra(ExportFileActivity.EXTRA_METADATA, metadata);
            context.startActivity(intent);
        }
    }

    @Override // com.wickr.enterprise.base.BaseActivity
    public boolean getLockOrientation() {
        return this.lockOrientation;
    }

    /* JADX INFO: Access modifiers changed from: private */
    public static final FileManager fileManager_delegate$lambda$0() {
        return App.INSTANCE.getAppContext().getFileManager();
    }

    /* JADX INFO: Access modifiers changed from: private */
    public final FileManager getFileManager() {
        return (FileManager) this.fileManager.getValue();
    }

    @Override // com.wickr.enterprise.base.ValidSessionActivity, com.wickr.enterprise.base.BaseActivity, com.wickr.enterprise.base.Hilt_BaseActivity, androidx.fragment.app.FragmentActivity, androidx.activity.ComponentActivity, androidx.core.app.ComponentActivity, android.app.Activity
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().setBackgroundDrawable(new ColorDrawable(0));
        Intent intent = getIntent();
        AttachmentMetaData attachmentMetaData = intent != null ? (AttachmentMetaData) intent.getParcelableExtra(EXTRA_METADATA) : null;
        if (attachmentMetaData == null) {
            Timber.INSTANCE.e("No metadata provided", new Object[0]);
            finish();
            overridePendingTransition(0, 0);
        } else {
            this.metadata = attachmentMetaData;
            exportFile();
        }
    }

    @Override // androidx.fragment.app.FragmentActivity, androidx.activity.ComponentActivity, android.app.Activity
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        Timber.INSTANCE.d("Got activity result " + requestCode + " " + resultCode, new Object[0]);
        if (requestCode == REQUEST_CREATE_FILE) {
            processFileCreateResult(resultCode, data);
            return;
        }
        Timber.INSTANCE.e("Received incorrect request code: " + requestCode, new Object[0]);
        finish();
        overridePendingTransition(0, 0);
    }

    private final void exportFile() {
        try {
            Timber.INSTANCE.d("Exporting file using file picker", new Object[0]);
            Intent intent = new Intent("android.intent.action.CREATE_DOCUMENT");
            intent.addCategory("android.intent.category.OPENABLE");
            AttachmentMetaData attachmentMetaData = this.metadata;
            if (attachmentMetaData == null) {
                Intrinsics.throwUninitializedPropertyAccessException(PersistentChatNotice.Schema.KEY_metadata);
                attachmentMetaData = null;
            }
            intent.setType(attachmentMetaData.getMimeType());
            AttachmentMetaData attachmentMetaData2 = this.metadata;
            if (attachmentMetaData2 == null) {
                Intrinsics.throwUninitializedPropertyAccessException(PersistentChatNotice.Schema.KEY_metadata);
                attachmentMetaData2 = null;
            }
            intent.putExtra("android.intent.extra.TITLE", attachmentMetaData2.getName());
            if (intent.resolveActivity(getPackageManager()) != null) {
                startActivityForResult(intent, REQUEST_CREATE_FILE);
            }
        } catch (Exception e) {
            WickrBugReporter.report$default(e, Severity.WARNING, null, 4, null);
            ExportFileActivity exportFileActivity = this;
            String string = getString(R.string.no_application_available);
            Intrinsics.checkNotNullExpressionValue(string, "getString(...)");
            BaseView.showToast$default(exportFileActivity, string, 0, 2, null);
        }
    }

    private final void processFileCreateResult(int resultCode, final Intent data) {
        if (resultCode != -1 || data == null || data.getData() == null) {
            Timber.INSTANCE.e("File create error code: " + resultCode, new Object[0]);
            finish();
            overridePendingTransition(0, 0);
            return;
        }
        showProgressDialog(getString(R.string.dialog_message_exporting_file));
        AttachmentMetaData attachmentMetaData = this.metadata;
        if (attachmentMetaData == null) {
            Intrinsics.throwUninitializedPropertyAccessException(PersistentChatNotice.Schema.KEY_metadata);
            attachmentMetaData = null;
        }
        Disposable disposableSubscribe = Observable.just(attachmentMetaData).subscribeOn(Schedulers.io()).observeOn(Schedulers.io()).map(new Function() { // from class: com.wickr.enterprise.messages.ExportFileActivity.processFileCreateResult.1
            @Override // io.reactivex.rxjava3.functions.Function
            public final FileDecryptionResult apply(AttachmentMetaData it) {
                Intrinsics.checkNotNullParameter(it, "it");
                Timber.INSTANCE.d("Decrypting file", new Object[0]);
                FileManager fileManager = ExportFileActivity.this.getFileManager();
                String guid = it.getGuid();
                byte[] key = it.getKey();
                String absolutePath = FileUtilsKt.getDecryptedFileDirectory(ExportFileActivity.this).getAbsolutePath();
                Intrinsics.checkNotNullExpressionValue(absolutePath, "getAbsolutePath(...)");
                return fileManager.decryptFile(new FileDecryptionRequest(guid, key, absolutePath, it.getGuid(), true));
            }
        }).subscribe(new Consumer() { // from class: com.wickr.enterprise.messages.ExportFileActivity.processFileCreateResult.2
            @Override // io.reactivex.rxjava3.functions.Consumer
            public final void accept(FileDecryptionResult it) {
                long jCopyTo$default;
                Intrinsics.checkNotNullParameter(it, "it");
                Timber.Companion companion = Timber.INSTANCE;
                boolean success = it.getSuccess();
                File decryptedFile = it.getDecryptedFile();
                AttachmentMetaData attachmentMetaData2 = null;
                companion.d("Got decryption result. Success: " + success + ", file: " + (decryptedFile != null ? decryptedFile.getAbsolutePath() : null), new Object[0]);
                if (it.getSuccess()) {
                    try {
                        Timber.INSTANCE.d("Writing exported file", new Object[0]);
                        ContentResolver contentResolver = ExportFileActivity.this.getContentResolver();
                        Uri data2 = data.getData();
                        Intrinsics.checkNotNull(data2);
                        OutputStream outputStreamOpenOutputStream = contentResolver.openOutputStream(data2);
                        if (outputStreamOpenOutputStream != null) {
                            OutputStream outputStream = outputStreamOpenOutputStream;
                            try {
                                OutputStream outputStream2 = outputStream;
                                File decryptedFile2 = it.getDecryptedFile();
                                Intrinsics.checkNotNull(decryptedFile2);
                                FileInputStream fileInputStream = new FileInputStream(decryptedFile2);
                                try {
                                    jCopyTo$default = ByteStreamsKt.copyTo$default(fileInputStream, outputStream2, 0, 2, null);
                                    CloseableKt.closeFinally(fileInputStream, null);
                                    CloseableKt.closeFinally(outputStream, null);
                                } catch (Throwable th) {
                                    try {
                                        throw th;
                                    } catch (Throwable th2) {
                                        CloseableKt.closeFinally(fileInputStream, th);
                                        throw th2;
                                    }
                                }
                            } catch (Throwable th3) {
                                try {
                                    throw th3;
                                } catch (Throwable th4) {
                                    CloseableKt.closeFinally(outputStream, th3);
                                    throw th4;
                                }
                            }
                        } else {
                            jCopyTo$default = 0;
                        }
                        if (jCopyTo$default > 0) {
                            NotificationManager notificationManager = App.INSTANCE.getAppContext().getNotificationManager();
                            AttachmentMetaData attachmentMetaData3 = ExportFileActivity.this.metadata;
                            if (attachmentMetaData3 == null) {
                                Intrinsics.throwUninitializedPropertyAccessException(PersistentChatNotice.Schema.KEY_metadata);
                                attachmentMetaData3 = null;
                            }
                            String name = attachmentMetaData3.getName();
                            Uri data3 = data.getData();
                            Intrinsics.checkNotNull(data3);
                            AttachmentMetaData attachmentMetaData4 = ExportFileActivity.this.metadata;
                            if (attachmentMetaData4 == null) {
                                Intrinsics.throwUninitializedPropertyAccessException(PersistentChatNotice.Schema.KEY_metadata);
                            } else {
                                attachmentMetaData2 = attachmentMetaData4;
                            }
                            notificationManager.showFileExportCompletedNotification(name, data3, attachmentMetaData2.getMimeType());
                        } else {
                            Timber.INSTANCE.d("Unable to copy file", new Object[0]);
                        }
                    } catch (Exception e) {
                        Timber.INSTANCE.e(e);
                    }
                } else {
                    Timber.INSTANCE.e("Unable to decrypt file", new Object[0]);
                }
                ExportFileActivity.this.finish();
                ExportFileActivity.this.overridePendingTransition(0, 0);
            }
        });
        Intrinsics.checkNotNullExpressionValue(disposableSubscribe, "subscribe(...)");
        RxExtensionsKt.disposeBy(disposableSubscribe, App.INSTANCE.getAppBag());
    }
}
