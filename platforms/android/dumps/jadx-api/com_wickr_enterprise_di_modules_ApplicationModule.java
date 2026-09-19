package com.wickr.enterprise.di.modules;

import android.content.Context;
import androidx.lifecycle.LifecycleOwner;
import androidx.lifecycle.ProcessLifecycleOwner;
import com.mywickr.interfaces.BaseUrlProvider;
import com.mywickr.repository.ConvoRepository;
import com.wickr.android.metrics.WickrMetrics;
import com.wickr.enterprise.RuntimeManager;
import com.wickr.enterprise.WickrRuntimeManagerInternal;
import com.wickr.enterprise.WickrRuntimeManagerNoOp;
import com.wickr.enterprise.di.WickrAppContext;
import com.wickr.enterprise.metrics.kinesis.LaunchTtiMetricsReporter;
import com.wickr.enterprise.notifications.NotificationManager;
import com.wickr.enterprise.util.BuildUtils;
import com.wickr.enterprise.util.EventBusManager;
import com.wickr.enterprise.util.LifecycleMonitor;
import com.wickr.enterprise.util.PasswordRequirementsValidator;
import com.wickr.enterprise.util.WickrBuildUtils;
import com.wickr.enterprise.verification.LegacyIdentityProvider;
import com.wickr.enterprise.verification.LegacyIdentityProviderImpl;
import com.wickr.networking.NetworkClient;
import com.wickr.networking.NetworkStatusMonitor;
import com.wickr.networking.proxy.ProxyManager;
import com.wickr.networking.websockets.SwitchboardConnection;
import com.wickr.registration.LoginManager;
import com.wickr.session.Session;
import com.wickr.session.SessionManager;
import com.wickr.util.WickrAppClock;
import dagger.Module;
import dagger.Provides;
import dagger.Reusable;
import dagger.hilt.android.qualifiers.ApplicationContext;
import io.sentry.protocol.App;
import javax.inject.Named;
import javax.inject.Singleton;
import kotlin.Metadata;
import kotlin.jvm.internal.Intrinsics;
import org.greenrobot.eventbus.EventBus;

/* JADX INFO: compiled from: ApplicationModule.kt */
/* JADX INFO: loaded from: classes3.dex */
@Metadata(d1 = {"\u0000¦\u0001\n\u0002\u0018\u0002\n\u0002\u0010\u0000\n\u0002\b\u0003\n\u0002\u0018\u0002\n\u0000\n\u0002\u0018\u0002\n\u0000\n\u0002\u0018\u0002\n\u0000\n\u0002\u0018\u0002\n\u0002\b\u0002\n\u0002\u0018\u0002\n\u0002\b\u0002\n\u0002\u0018\u0002\n\u0000\n\u0002\u0018\u0002\n\u0000\n\u0002\u0018\u0002\n\u0000\n\u0002\u0018\u0002\n\u0000\n\u0002\u0018\u0002\n\u0000\n\u0002\u0018\u0002\n\u0000\n\u0002\u0018\u0002\n\u0000\n\u0002\u0018\u0002\n\u0002\b\u0002\n\u0002\u0018\u0002\n\u0000\n\u0002\u0018\u0002\n\u0002\b\u0002\n\u0002\u0018\u0002\n\u0000\n\u0002\u0018\u0002\n\u0000\n\u0002\u0018\u0002\n\u0000\n\u0002\u0018\u0002\n\u0000\n\u0002\u0018\u0002\n\u0000\n\u0002\u0018\u0002\n\u0000\n\u0002\u0018\u0002\n\u0002\b\u0002\n\u0002\u0018\u0002\n\u0000\n\u0002\u0018\u0002\n\u0000\bÇ\u0002\u0018\u00002\u00020\u0001B\t\b\u0002¢\u0006\u0004\b\u0002\u0010\u0003J\b\u0010\u0004\u001a\u00020\u0005H\u0007J\u0012\u0010\u0006\u001a\u00020\u00072\b\b\u0001\u0010\b\u001a\u00020\tH\u0007J\u0010\u0010\n\u001a\u00020\u000b2\u0006\u0010\f\u001a\u00020\u0007H\u0007J\u0010\u0010\r\u001a\u00020\u000e2\u0006\u0010\u000f\u001a\u00020\u000bH\u0007J\u0010\u0010\u0010\u001a\u00020\u00112\u0006\u0010\u000f\u001a\u00020\u000bH\u0007J\u0010\u0010\u0012\u001a\u00020\u00132\u0006\u0010\u0014\u001a\u00020\u0015H\u0007J\u0010\u0010\u0016\u001a\u00020\u00172\u0006\u0010\u000f\u001a\u00020\u000bH\u0007J\u0010\u0010\u0018\u001a\u00020\u00192\u0006\u0010\u000f\u001a\u00020\u000bH\u0007J\u0010\u0010\u001a\u001a\u00020\u001b2\u0006\u0010\u000f\u001a\u00020\u000bH\u0007J\u0010\u0010\u001c\u001a\u00020\u001d2\u0006\u0010\u000f\u001a\u00020\u000bH\u0007J\u0010\u0010\u001e\u001a\u00020\u001f2\u0006\u0010 \u001a\u00020\u001bH\u0007J\u0010\u0010!\u001a\u00020\"2\u0006\u0010\u000f\u001a\u00020\u000bH\u0007J\u0010\u0010#\u001a\u00020$2\u0006\u0010\u000f\u001a\u00020\u000bH\u0007J\b\u0010%\u001a\u00020\u0015H\u0007J\b\u0010&\u001a\u00020'H\u0007J\u0010\u0010(\u001a\u00020)2\u0006\u0010 \u001a\u00020\u001bH\u0007J\b\u0010*\u001a\u00020+H\u0007J\b\u0010,\u001a\u00020-H\u0007J\b\u0010.\u001a\u00020/H\u0007J\u0010\u00100\u001a\u0002012\u0006\u0010 \u001a\u00020\u001bH\u0007J\u0010\u00102\u001a\u0002032\u0006\u00104\u001a\u00020\u000bH\u0007J\b\u00105\u001a\u000206H\u0007J\b\u00107\u001a\u000208H\u0007¨\u00069"}, d2 = {"Lcom/wickr/enterprise/di/modules/ApplicationModule;", "", "<init>", "()V", "providesApplicationLifecycleManager", "Landroidx/lifecycle/LifecycleOwner;", "providesWickrApp", "Lcom/wickr/enterprise/App;", "context", "Landroid/content/Context;", "providesWickrAppContext", "Lcom/wickr/enterprise/di/WickrAppContext;", App.TYPE, "providesLifecycleMonitor", "Lcom/wickr/enterprise/util/LifecycleMonitor;", "wickrAppContext", "providesEventBus", "Lorg/greenrobot/eventbus/EventBus;", "providesRuntimeManager", "Lcom/wickr/enterprise/RuntimeManager;", "buildUtils", "Lcom/wickr/enterprise/util/WickrBuildUtils;", "providesNetworkClient", "Lcom/wickr/networking/NetworkClient;", "providesProxyManager", "Lcom/wickr/networking/proxy/ProxyManager;", "providesSessionManager", "Lcom/wickr/session/SessionManager;", "providesLoginManager", "Lcom/wickr/registration/LoginManager;", "providesActiveSession", "Lcom/wickr/session/Session;", "sessionManager", "providesAppClock", "Lcom/wickr/util/WickrAppClock;", "providesBaseUrlProvider", "Lcom/mywickr/interfaces/BaseUrlProvider;", "providesWickrBuildUtils", "provideNetworkStatusMonitor", "Lcom/wickr/networking/NetworkStatusMonitor;", "provideSwitchboardConnection", "Lcom/wickr/networking/websockets/SwitchboardConnection;", "providesWickrMetrics", "Lcom/wickr/android/metrics/WickrMetrics;", "providesLaunchTtiMetricsReporter", "Lcom/wickr/enterprise/metrics/kinesis/LaunchTtiMetricsReporter;", "providesEventBusManager", "Lcom/wickr/enterprise/util/EventBusManager;", "providesConversationRepository", "Lcom/mywickr/repository/ConvoRepository;", "providesNotificationManager", "Lcom/wickr/enterprise/notifications/NotificationManager;", "appContext", "provideLegacyIdentityProvider", "Lcom/wickr/enterprise/verification/LegacyIdentityProvider;", "providePasswordRequirementsValidator", "Lcom/wickr/enterprise/util/PasswordRequirementsValidator;", "app_awsRelease"}, k = 1, mv = {2, 2, 0}, xi = 48)
@Module
public final class ApplicationModule {
    public static final int $stable = 0;
    public static final ApplicationModule INSTANCE = new ApplicationModule();

    private ApplicationModule() {
    }

    @Provides
    @Named("application")
    public final LifecycleOwner providesApplicationLifecycleManager() {
        return ProcessLifecycleOwner.INSTANCE.get();
    }

    @Provides
    public final com.wickr.enterprise.App providesWickrApp(@ApplicationContext Context context) {
        Intrinsics.checkNotNullParameter(context, "context");
        return (com.wickr.enterprise.App) context;
    }

    @Provides
    public final WickrAppContext providesWickrAppContext(com.wickr.enterprise.App app) {
        Intrinsics.checkNotNullParameter(app, "app");
        return app.getWickrContext();
    }

    @Provides
    public final LifecycleMonitor providesLifecycleMonitor(WickrAppContext wickrAppContext) {
        Intrinsics.checkNotNullParameter(wickrAppContext, "wickrAppContext");
        return wickrAppContext.getLifecycleMonitor();
    }

    @Provides
    public final EventBus providesEventBus(WickrAppContext wickrAppContext) {
        Intrinsics.checkNotNullParameter(wickrAppContext, "wickrAppContext");
        return wickrAppContext.getEventBus();
    }

    @Provides
    @Singleton
    public final RuntimeManager providesRuntimeManager(WickrBuildUtils buildUtils) {
        Intrinsics.checkNotNullParameter(buildUtils, "buildUtils");
        if (!buildUtils.isProductionVariant() || buildUtils.isDebug()) {
            return new WickrRuntimeManagerInternal();
        }
        return new WickrRuntimeManagerNoOp();
    }

    @Provides
    public final NetworkClient providesNetworkClient(WickrAppContext wickrAppContext) {
        Intrinsics.checkNotNullParameter(wickrAppContext, "wickrAppContext");
        return wickrAppContext.getNetworkClient();
    }

    @Provides
    public final ProxyManager providesProxyManager(WickrAppContext wickrAppContext) {
        Intrinsics.checkNotNullParameter(wickrAppContext, "wickrAppContext");
        return wickrAppContext.getProxyManager();
    }

    @Provides
    public final SessionManager providesSessionManager(WickrAppContext wickrAppContext) {
        Intrinsics.checkNotNullParameter(wickrAppContext, "wickrAppContext");
        return wickrAppContext.getSessionManager();
    }

    @Provides
    public final LoginManager providesLoginManager(WickrAppContext wickrAppContext) {
        Intrinsics.checkNotNullParameter(wickrAppContext, "wickrAppContext");
        return wickrAppContext.getLoginManager();
    }

    @Provides
    public final Session providesActiveSession(SessionManager sessionManager) {
        Intrinsics.checkNotNullParameter(sessionManager, "sessionManager");
        Session activeSession = sessionManager.getActiveSession();
        Intrinsics.checkNotNull(activeSession);
        return activeSession;
    }

    @Provides
    public final WickrAppClock providesAppClock(WickrAppContext wickrAppContext) {
        Intrinsics.checkNotNullParameter(wickrAppContext, "wickrAppContext");
        return wickrAppContext.getAppClock();
    }

    @Provides
    public final BaseUrlProvider providesBaseUrlProvider(WickrAppContext wickrAppContext) {
        Intrinsics.checkNotNullParameter(wickrAppContext, "wickrAppContext");
        return wickrAppContext.getBaseUrlProvider();
    }

    @Provides
    @Reusable
    public final WickrBuildUtils providesWickrBuildUtils() {
        return BuildUtils.INSTANCE;
    }

    @Provides
    @Reusable
    public final NetworkStatusMonitor provideNetworkStatusMonitor() {
        return com.wickr.enterprise.App.INSTANCE.getAppContext().getNetworkMonitor();
    }

    @Provides
    public final SwitchboardConnection provideSwitchboardConnection(SessionManager sessionManager) {
        Intrinsics.checkNotNullParameter(sessionManager, "sessionManager");
        Session activeSession = sessionManager.getActiveSession();
        Intrinsics.checkNotNull(activeSession);
        return activeSession.getSwitchboard();
    }

    @Provides
    @Reusable
    public final WickrMetrics providesWickrMetrics() {
        return WickrMetrics.INSTANCE;
    }

    @Provides
    @Reusable
    public final LaunchTtiMetricsReporter providesLaunchTtiMetricsReporter() {
        return LaunchTtiMetricsReporter.INSTANCE;
    }

    @Provides
    @Reusable
    public final EventBusManager providesEventBusManager() {
        return com.wickr.enterprise.App.INSTANCE;
    }

    @Provides
    public final ConvoRepository providesConversationRepository(SessionManager sessionManager) {
        Intrinsics.checkNotNullParameter(sessionManager, "sessionManager");
        Session activeSession = sessionManager.getActiveSession();
        Intrinsics.checkNotNull(activeSession);
        return activeSession.getConvoRepository();
    }

    @Provides
    public final NotificationManager providesNotificationManager(WickrAppContext appContext) {
        Intrinsics.checkNotNullParameter(appContext, "appContext");
        return appContext.getNotificationManager();
    }

    @Provides
    public final LegacyIdentityProvider provideLegacyIdentityProvider() {
        return new LegacyIdentityProviderImpl();
    }

    @Provides
    public final PasswordRequirementsValidator providePasswordRequirementsValidator() {
        return PasswordRequirementsValidator.INSTANCE;
    }
}
