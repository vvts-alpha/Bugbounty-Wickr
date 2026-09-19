package com.wickr.enterprise.api;

import com.mywickr.config.WickrConfig;
import com.wickr.android.api.WickrAPI;
import kotlin.Metadata;
import kotlin.jvm.internal.Intrinsics;

/* JADX INFO: compiled from: WickrAPIAuthHandler.kt */
/* JADX INFO: loaded from: classes4.dex */
@Metadata(d1 = {"\u0000 \n\u0002\u0018\u0002\n\u0002\u0018\u0002\n\u0000\n\u0002\u0018\u0002\n\u0002\b\u0003\n\u0002\u0010\u000b\n\u0002\b\u0002\n\u0002\u0010\u000e\n\u0000\b\u0007\u0018\u00002\u00020\u0001B\u000f\u0012\u0006\u0010\u0002\u001a\u00020\u0003¢\u0006\u0004\b\u0004\u0010\u0005J\b\u0010\u0006\u001a\u00020\u0007H\u0016J\u0010\u0010\b\u001a\u00020\u00072\u0006\u0010\t\u001a\u00020\nH\u0016R\u000e\u0010\u0002\u001a\u00020\u0003X\u0082\u0004¢\u0006\u0002\n\u0000¨\u0006\u000b"}, d2 = {"Lcom/wickr/enterprise/api/WickrAPIServerConfigAuthHandler;", "Lcom/wickr/enterprise/api/WickrAPIBuildConfigAuthHandler;", "config", "Lcom/mywickr/config/WickrConfig;", "<init>", "(Lcom/mywickr/config/WickrConfig;)V", "isEnabled", "", "isAllowed", WickrAPI.EXTRA_PACKAGE_NAME, "", "app_awsRelease"}, k = 1, mv = {2, 2, 0}, xi = 48)
public final class WickrAPIServerConfigAuthHandler extends WickrAPIBuildConfigAuthHandler {
    public static final int $stable = 0;
    private final WickrConfig config;

    public WickrAPIServerConfigAuthHandler(WickrConfig config) {
        Intrinsics.checkNotNullParameter(config, "config");
        this.config = config;
    }

    @Override // com.wickr.enterprise.api.WickrAPIBuildConfigAuthHandler, com.wickr.enterprise.api.WickrAPIAuthHandler
    public boolean isEnabled() {
        if (super.isEnabled()) {
            return this.config.isWickrAPIEnabled();
        }
        return false;
    }

    @Override // com.wickr.enterprise.api.WickrAPIBuildConfigAuthHandler, com.wickr.enterprise.api.WickrAPIAuthHandler
    public boolean isAllowed(String packageName) {
        Intrinsics.checkNotNullParameter(packageName, "packageName");
        if (super.isAllowed(packageName)) {
            return this.config.getWickrAPIAllowList().contains(packageName);
        }
        return false;
    }
}
