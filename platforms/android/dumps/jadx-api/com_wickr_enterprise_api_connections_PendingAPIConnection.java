package com.wickr.enterprise.api.connections;

import com.wickr.android.api.WickrAPI;
import com.wickr.android.api.WickrAPIObjects;
import com.wickr.android.api.WickrAPIRequests;
import kotlin.Metadata;
import kotlin.Pair;
import kotlin.jvm.internal.DefaultConstructorMarker;
import kotlin.jvm.internal.Intrinsics;

/* JADX INFO: compiled from: WickrAPIConnection.kt */
/* JADX INFO: loaded from: classes4.dex */
@Metadata(d1 = {"\u0000&\n\u0002\u0018\u0002\n\u0002\u0018\u0002\n\u0000\n\u0002\u0018\u0002\n\u0002\u0010\u000e\n\u0002\u0018\u0002\n\u0000\n\u0002\u0010\t\n\u0000\n\u0002\u0010\u0012\n\u0002\b\u000b\b\u0007\u0018\u00002\u00020\u0001B/\u0012\u0012\u0010\u0002\u001a\u000e\u0012\u0004\u0012\u00020\u0004\u0012\u0004\u0012\u00020\u00050\u0003\u0012\u0006\u0010\u0006\u001a\u00020\u0007\u0012\n\b\u0002\u0010\b\u001a\u0004\u0018\u00010\t¢\u0006\u0004\b\n\u0010\u000bR\u001d\u0010\u0002\u001a\u000e\u0012\u0004\u0012\u00020\u0004\u0012\u0004\u0012\u00020\u00050\u0003¢\u0006\b\n\u0000\u001a\u0004\b\f\u0010\rR\u0011\u0010\u0006\u001a\u00020\u0007¢\u0006\b\n\u0000\u001a\u0004\b\u000e\u0010\u000fR\u001c\u0010\b\u001a\u0004\u0018\u00010\tX\u0086\u000e¢\u0006\u000e\n\u0000\u001a\u0004\b\u0010\u0010\u0011\"\u0004\b\u0012\u0010\u0013¨\u0006\u0014"}, d2 = {"Lcom/wickr/enterprise/api/connections/PendingAPIConnection;", "Lcom/wickr/enterprise/api/connections/WickrAPIConnection;", WickrAPI.EXTRA_PAIRING_REQUEST, "Lkotlin/Pair;", "", "Lcom/wickr/android/api/WickrAPIRequests$PairingRequest;", "dateRequested", "", "pendingEncryptionKey", "", "<init>", "(Lkotlin/Pair;J[B)V", "getPairingRequest", "()Lkotlin/Pair;", "getDateRequested", "()J", "getPendingEncryptionKey", "()[B", "setPendingEncryptionKey", "([B)V", "app_awsRelease"}, k = 1, mv = {2, 2, 0}, xi = 48)
public final class PendingAPIConnection extends WickrAPIConnection {
    public static final int $stable = 8;
    private final long dateRequested;
    private final Pair<String, WickrAPIRequests.PairingRequest> pairingRequest;
    private byte[] pendingEncryptionKey;

    public /* synthetic */ PendingAPIConnection(Pair pair, long j, byte[] bArr, int i, DefaultConstructorMarker defaultConstructorMarker) {
        this(pair, j, (i & 4) != 0 ? null : bArr);
    }

    public final Pair<String, WickrAPIRequests.PairingRequest> getPairingRequest() {
        return this.pairingRequest;
    }

    public final long getDateRequested() {
        return this.dateRequested;
    }

    public final byte[] getPendingEncryptionKey() {
        return this.pendingEncryptionKey;
    }

    public final void setPendingEncryptionKey(byte[] bArr) {
        this.pendingEncryptionKey = bArr;
    }

    /* JADX WARN: Illegal instructions before constructor call */
    public PendingAPIConnection(Pair<String, WickrAPIRequests.PairingRequest> pairingRequest, long j, byte[] bArr) {
        Intrinsics.checkNotNullParameter(pairingRequest, "pairingRequest");
        WickrAPIObjects.AppInfo appInfo = pairingRequest.getSecond().getAppInfo();
        Intrinsics.checkNotNullExpressionValue(appInfo, "getAppInfo(...)");
        super(appInfo, null);
        this.pairingRequest = pairingRequest;
        this.dateRequested = j;
        this.pendingEncryptionKey = bArr;
    }
}
