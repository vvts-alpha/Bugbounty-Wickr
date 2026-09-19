package com.wickr.enterprise.api.modules;

import com.wickr.enterprise.api.WickrAPIContext;
import com.wickr.session.Session;
import io.sentry.cache.EnvelopeCache;
import kotlin.Metadata;
import kotlin.jvm.internal.Intrinsics;

/* JADX INFO: compiled from: WickrAPIFeatureModuleManager.kt */
/* JADX INFO: loaded from: classes4.dex */
@Metadata(d1 = {"\u0000\u001e\n\u0002\u0018\u0002\n\u0002\u0018\u0002\n\u0002\b\u0003\n\u0002\u0010\u0002\n\u0000\n\u0002\u0018\u0002\n\u0000\n\u0002\u0018\u0002\n\u0000\b\u0007\u0018\u00002\u00020\u0001B\u0007¢\u0006\u0004\b\u0002\u0010\u0003J\u0018\u0010\u0004\u001a\u00020\u00052\u0006\u0010\u0006\u001a\u00020\u00072\u0006\u0010\b\u001a\u00020\tH\u0016¨\u0006\n"}, d2 = {"Lcom/wickr/enterprise/api/modules/WickrAPIFeatureModuleManager;", "Lcom/wickr/enterprise/api/modules/WickrAPIModuleManager;", "<init>", "()V", "initialize", "", "apiContext", "Lcom/wickr/enterprise/api/WickrAPIContext;", EnvelopeCache.PREFIX_CURRENT_SESSION_FILE, "Lcom/wickr/session/Session;", "app_awsRelease"}, k = 1, mv = {2, 2, 0}, xi = 48)
public final class WickrAPIFeatureModuleManager extends WickrAPIModuleManager {
    public static final int $stable = 8;

    @Override // com.wickr.enterprise.api.modules.WickrAPIModuleManager
    public void initialize(WickrAPIContext apiContext, Session session) {
        Intrinsics.checkNotNullParameter(apiContext, "apiContext");
        Intrinsics.checkNotNullParameter(session, "session");
        register(new GetConvosModule(apiContext, session));
        register(new GetMessagesModule(apiContext, session));
        register(new SendMessageModule(apiContext, session));
        register(new GetContactsModule(apiContext, session));
        register(new SubscriptionModule(apiContext, session));
        register(new CallModule(apiContext, session));
        register(new CreateConvoModule(apiContext, session));
        register(new EditConvosModule(apiContext, session));
        register(new NotificationModule(apiContext, session));
        register(new GetUserSettingsModule(apiContext, session));
        register(new UserAvatarModule(apiContext, session));
        register(new FileManagerModule(apiContext, session));
    }
}
