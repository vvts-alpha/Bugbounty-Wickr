package com.wickr.enterprise.api;

import com.wickr.android.api.WickrAPI;
import kotlin.Metadata;
import kotlin.jvm.internal.Intrinsics;

/* JADX INFO: compiled from: WickrAPIAuthHandler.kt */
/* JADX INFO: loaded from: classes4.dex */
@Metadata(d1 = {"\u0000\u001a\n\u0002\u0018\u0002\n\u0002\u0018\u0002\n\u0002\b\u0003\n\u0002\u0010\u000b\n\u0002\b\u0002\n\u0002\u0010\u000e\n\u0000\b\u0017\u0018\u00002\u00020\u0001B\u0007¢\u0006\u0004\b\u0002\u0010\u0003J\b\u0010\u0004\u001a\u00020\u0005H\u0016J\u0010\u0010\u0006\u001a\u00020\u00052\u0006\u0010\u0007\u001a\u00020\bH\u0016¨\u0006\t"}, d2 = {"Lcom/wickr/enterprise/api/WickrAPIBuildConfigAuthHandler;", "Lcom/wickr/enterprise/api/WickrAPIAuthHandler;", "<init>", "()V", "isEnabled", "", "isAllowed", WickrAPI.EXTRA_PACKAGE_NAME, "", "app_awsRelease"}, k = 1, mv = {2, 2, 0}, xi = 48)
public class WickrAPIBuildConfigAuthHandler implements WickrAPIAuthHandler {
    public static final int $stable = 0;

    @Override // com.wickr.enterprise.api.WickrAPIAuthHandler
    public boolean isAllowed(String packageName) {
        Intrinsics.checkNotNullParameter(packageName, "packageName");
        return true;
    }

    @Override // com.wickr.enterprise.api.WickrAPIAuthHandler
    public boolean isEnabled() {
        return true;
    }
}
