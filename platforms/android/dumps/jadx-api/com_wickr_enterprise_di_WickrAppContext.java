package com.wickr.enterprise.di;

import android.app.Application;
import androidx.core.content.ContextCompat;
import com.mywickr.WickrCore;
import com.mywickr.config.CoreFeatureConfig;
import com.mywickr.config.WickrConfig;
import com.mywickr.interfaces.BaseUrlProvider;
import com.mywickr.networking.requests.jobs.WickrJobScheduler;
import com.mywickr.search.CacheSearchResultRepository;
import com.mywickr.search.ServerSearchResultRepository;
import com.mywickr.wickr.WickrDBAdapter;
import com.wickr.di.WickrBuildConfig;
import com.wickr.di.WickrCoreContext;
import com.wickr.enterprise.App;
import com.wickr.enterprise.BuildConfig;
import com.wickr.enterprise.api.APICoroutineThreadExecutor;
import com.wickr.enterprise.api.WickrAPIManager;
import com.wickr.enterprise.api.WickrAPIServerConfigAuthHandler;
import com.wickr.enterprise.api.connections.DatabaseConnectionManager;
import com.wickr.enterprise.api.modules.WickrAPIFeatureModuleManager;
import com.wickr.enterprise.api.receivers.WickrAPIBroadcastHandler;
import com.wickr.enterprise.helpers.ScreenshotManager;
import com.wickr.enterprise.location.LocationManager;
import com.wickr.enterprise.location.WickrLocationManager;
import com.wickr.enterprise.notifications.NotificationManager;
import com.wickr.enterprise.notifications.WickrNotificationManager;
import com.wickr.enterprise.registration.di.RegistrationContext;
import com.wickr.enterprise.registration.di.RegistrationModule;
import com.wickr.enterprise.util.BuildUtils;
import com.wickr.enterprise.util.LifecycleMonitor;
import com.wickr.enterprise.util.ViewUtil;
import com.wickr.files.FileManager;
import com.wickr.files.FileShredderService;
import com.wickr.markdown.DelegateLinkResolver;
import com.wickr.markdown.MarkdownConfiguration;
import com.wickr.markdown.MarkdownRenderer;
import com.wickr.networking.NetworkActivityMonitor;
import com.wickr.networking.NetworkClient;
import com.wickr.networking.NetworkStatusMonitor;
import com.wickr.networking.WickrProxyRefreshService;
import com.wickr.networking.proxy.ProxyManager;
import com.wickr.pro.R;
import com.wickr.registration.LoginManager;
import com.wickr.registration.ProxyHandler;
import com.wickr.sdk.WickrCipher;
import com.wickr.sdk.WickrContextFactory;
import com.wickr.sdk.WickrDevice;
import com.wickr.sdk.WickrKeyGenerator;
import com.wickr.sdk.WickrProduct;
import com.wickr.session.SessionManager;
import com.wickr.session.SessionTimeoutMetrics;
import com.wickr.util.AndroidKeyStore;
import com.wickr.util.CoreMetrics;
import com.wickr.util.WickrAppClock;
import io.sentry.protocol.Device;
import kotlin.Lazy;
import kotlin.LazyKt;
import kotlin.Metadata;
import kotlin.jvm.functions.Function0;
import kotlin.jvm.internal.Intrinsics;
import kotlinx.coroutines.CoroutineScopeKt;
import kotlinx.coroutines.Dispatchers;
import net.zetetic.database.sqlcipher.SQLiteDatabase;
import org.greenrobot.eventbus.EventBus;

/* JADX INFO: compiled from: WickrAppContext.kt */
/* JADX INFO: loaded from: classes3.dex */
@Metadata(d1 = {"\u0000²\u0001\n\u0002\u0018\u0002\n\u0002\u0018\u0002\n\u0000\n\u0002\u0018\u0002\n\u0002\b\u0003\n\u0002\u0018\u0002\n\u0002\b\u0003\n\u0002\u0018\u0002\n\u0002\b\u0003\n\u0002\u0018\u0002\n\u0002\b\u0003\n\u0002\u0018\u0002\n\u0002\b\u0003\n\u0002\u0018\u0002\n\u0002\b\u0003\n\u0002\u0018\u0002\n\u0002\b\u0003\n\u0002\u0018\u0002\n\u0002\b\u0003\n\u0002\u0018\u0002\n\u0000\n\u0002\u0018\u0002\n\u0002\u0018\u0002\n\u0000\n\u0002\u0018\u0002\n\u0002\u0018\u0002\n\u0000\n\u0002\u0018\u0002\n\u0002\u0018\u0002\n\u0000\n\u0002\u0018\u0002\n\u0002\u0018\u0002\n\u0000\n\u0002\u0018\u0002\n\u0002\u0018\u0002\n\u0000\n\u0002\u0018\u0002\n\u0002\u0018\u0002\n\u0000\n\u0002\u0018\u0002\n\u0002\u0018\u0002\n\u0000\n\u0002\u0018\u0002\n\u0002\u0018\u0002\n\u0000\n\u0002\u0018\u0002\n\u0002\u0018\u0002\n\u0000\n\u0002\u0018\u0002\n\u0002\b\u0003\bf\u0018\u0000 A2\u00020\u0001:\u0002ABJ\u0010\u0010\"\u001a\u00020#2\u0006\u0010$\u001a\u00020%H&J\u0010\u0010\"\u001a\u00020&2\u0006\u0010'\u001a\u00020(H&J\u0010\u0010\"\u001a\u00020)2\u0006\u0010*\u001a\u00020+H&J\u0010\u0010\"\u001a\u00020,2\u0006\u0010-\u001a\u00020.H&J\u0010\u0010\"\u001a\u00020/2\u0006\u00100\u001a\u000201H&J\u0010\u0010\"\u001a\u0002022\u0006\u00103\u001a\u000204H&J\u0010\u0010\"\u001a\u0002052\u0006\u00106\u001a\u000207H&J\u0010\u0010\"\u001a\u0002082\u0006\u00109\u001a\u00020:H&J\u0010\u0010\"\u001a\u00020;2\u0006\u0010<\u001a\u00020=H&J\u0010\u0010\"\u001a\u00020>2\u0006\u0010?\u001a\u00020@H&R\u0012\u0010\u0002\u001a\u00020\u0003X¦\u0004¢\u0006\u0006\u001a\u0004\b\u0004\u0010\u0005R\u0012\u0010\u0006\u001a\u00020\u0007X¦\u0004¢\u0006\u0006\u001a\u0004\b\b\u0010\tR\u0012\u0010\n\u001a\u00020\u000bX¦\u0004¢\u0006\u0006\u001a\u0004\b\f\u0010\rR\u0012\u0010\u000e\u001a\u00020\u000fX¦\u0004¢\u0006\u0006\u001a\u0004\b\u0010\u0010\u0011R\u0012\u0010\u0012\u001a\u00020\u0013X¦\u0004¢\u0006\u0006\u001a\u0004\b\u0014\u0010\u0015R\u0012\u0010\u0016\u001a\u00020\u0017X¦\u0004¢\u0006\u0006\u001a\u0004\b\u0018\u0010\u0019R\u0012\u0010\u001a\u001a\u00020\u001bX¦\u0004¢\u0006\u0006\u001a\u0004\b\u001c\u0010\u001dR\u0012\u0010\u001e\u001a\u00020\u001fX¦\u0004¢\u0006\u0006\u001a\u0004\b \u0010!¨\u0006CÀ\u0006\u0003"}, d2 = {"Lcom/wickr/enterprise/di/WickrAppContext;", "Lcom/wickr/di/WickrCoreContext;", "lifecycleMonitor", "Lcom/wickr/enterprise/util/LifecycleMonitor;", "getLifecycleMonitor", "()Lcom/wickr/enterprise/util/LifecycleMonitor;", "notificationManager", "Lcom/wickr/enterprise/notifications/NotificationManager;", "getNotificationManager", "()Lcom/wickr/enterprise/notifications/NotificationManager;", "locationManager", "Lcom/wickr/enterprise/location/LocationManager;", "getLocationManager", "()Lcom/wickr/enterprise/location/LocationManager;", "screenshotManager", "Lcom/wickr/enterprise/helpers/ScreenshotManager;", "getScreenshotManager", "()Lcom/wickr/enterprise/helpers/ScreenshotManager;", "apiBroadcastHandler", "Lcom/wickr/enterprise/api/receivers/WickrAPIBroadcastHandler;", "getApiBroadcastHandler", "()Lcom/wickr/enterprise/api/receivers/WickrAPIBroadcastHandler;", "apiManager", "Lcom/wickr/enterprise/api/WickrAPIManager;", "getApiManager", "()Lcom/wickr/enterprise/api/WickrAPIManager;", "markdownRenderer", "Lcom/wickr/markdown/MarkdownRenderer;", "getMarkdownRenderer", "()Lcom/wickr/markdown/MarkdownRenderer;", "delegateLinkResolver", "Lcom/wickr/markdown/DelegateLinkResolver;", "getDelegateLinkResolver", "()Lcom/wickr/markdown/DelegateLinkResolver;", "plus", "Lcom/wickr/enterprise/registration/di/RegistrationContext;", "registrationModule", "Lcom/wickr/enterprise/registration/di/RegistrationModule;", "Lcom/wickr/enterprise/di/ContactListContext;", "contactListModule", "Lcom/wickr/enterprise/di/ContactListModule;", "Lcom/wickr/enterprise/di/AddRoomMembersContext;", "addRoomMembersModule", "Lcom/wickr/enterprise/di/AddRoomMembersModule;", "Lcom/wickr/enterprise/di/CRSRoomErrorContext;", "crsRoomErrorModule", "Lcom/wickr/enterprise/di/CRSRoomErrorModule;", "Lcom/wickr/enterprise/di/ChatContext;", "chatModule", "Lcom/wickr/enterprise/di/ChatModule;", "Lcom/wickr/enterprise/di/PrivateChatInfoContext;", "privateChatInfoModule", "Lcom/wickr/enterprise/di/PrivateChatInfoModule;", "Lcom/wickr/enterprise/di/SecureRoomInfoContext;", "secureRoomInfoModule", "Lcom/wickr/enterprise/di/SecureRoomInfoModule;", "Lcom/wickr/enterprise/di/SecureRoomMemberListContext;", "secureRoomMemberListModule", "Lcom/wickr/enterprise/di/SecureRoomMemberListModule;", "Lcom/wickr/enterprise/di/SearchContext;", "searchModule", "Lcom/wickr/enterprise/di/SearchModule;", "Lcom/wickr/enterprise/di/MessageReactionListContext;", "messageReactionListModule", "Lcom/wickr/enterprise/di/MessageReactionListModule;", "Companion", "Impl", "app_awsRelease"}, k = 1, mv = {2, 2, 0}, xi = 48)
public interface WickrAppContext extends WickrCoreContext {

    /* JADX INFO: renamed from: Companion, reason: from kotlin metadata */
    public static final Companion INSTANCE = Companion.$$INSTANCE;

    WickrAPIBroadcastHandler getApiBroadcastHandler();

    WickrAPIManager getApiManager();

    DelegateLinkResolver getDelegateLinkResolver();

    LifecycleMonitor getLifecycleMonitor();

    LocationManager getLocationManager();

    MarkdownRenderer getMarkdownRenderer();

    @Override // com.wickr.di.WickrCoreContext
    NotificationManager getNotificationManager();

    ScreenshotManager getScreenshotManager();

    AddRoomMembersContext plus(AddRoomMembersModule addRoomMembersModule);

    CRSRoomErrorContext plus(CRSRoomErrorModule crsRoomErrorModule);

    ChatContext plus(ChatModule chatModule);

    ContactListContext plus(ContactListModule contactListModule);

    MessageReactionListContext plus(MessageReactionListModule messageReactionListModule);

    PrivateChatInfoContext plus(PrivateChatInfoModule privateChatInfoModule);

    SearchContext plus(SearchModule searchModule);

    SecureRoomInfoContext plus(SecureRoomInfoModule secureRoomInfoModule);

    SecureRoomMemberListContext plus(SecureRoomMemberListModule secureRoomMemberListModule);

    RegistrationContext plus(RegistrationModule registrationModule);

    /* JADX INFO: compiled from: WickrAppContext.kt */
    @Metadata(d1 = {"\u00000\n\u0002\u0018\u0002\n\u0002\u0010\u0000\n\u0002\b\u0003\n\u0002\u0018\u0002\n\u0000\n\u0002\u0018\u0002\n\u0000\n\u0002\u0018\u0002\n\u0000\n\u0002\u0018\u0002\n\u0000\n\u0002\u0018\u0002\n\u0000\n\u0002\u0018\u0002\n\u0000\b\u0086\u0003\u0018\u00002\u00020\u0001B\t\b\u0002¢\u0006\u0004\b\u0002\u0010\u0003J.\u0010\u0004\u001a\u00020\u00052\u0006\u0010\u0006\u001a\u00020\u00072\u0006\u0010\b\u001a\u00020\t2\u0006\u0010\n\u001a\u00020\u000b2\u0006\u0010\f\u001a\u00020\r2\u0006\u0010\u000e\u001a\u00020\u000f¨\u0006\u0010"}, d2 = {"Lcom/wickr/enterprise/di/WickrAppContext$Companion;", "", "<init>", "()V", "create", "Lcom/wickr/enterprise/di/WickrAppContext;", "context", "Landroid/app/Application;", "wickrProduct", "Lcom/wickr/sdk/WickrProduct;", "baseUrlProvider", "Lcom/mywickr/interfaces/BaseUrlProvider;", "eventBus", "Lorg/greenrobot/eventbus/EventBus;", "lifecycleMonitor", "Lcom/wickr/enterprise/util/LifecycleMonitor;", "app_awsRelease"}, k = 1, mv = {2, 2, 0}, xi = 48)
    public static final class Companion {
        static final /* synthetic */ Companion $$INSTANCE = new Companion();

        private Companion() {
        }

        public final WickrAppContext create(Application context, WickrProduct wickrProduct, BaseUrlProvider baseUrlProvider, EventBus eventBus, LifecycleMonitor lifecycleMonitor) {
            Intrinsics.checkNotNullParameter(context, "context");
            Intrinsics.checkNotNullParameter(wickrProduct, "wickrProduct");
            Intrinsics.checkNotNullParameter(baseUrlProvider, "baseUrlProvider");
            Intrinsics.checkNotNullParameter(eventBus, "eventBus");
            Intrinsics.checkNotNullParameter(lifecycleMonitor, "lifecycleMonitor");
            WickrCore.initialize(context, wickrProduct, baseUrlProvider, BuildConfig.VERSION_NAME, BuildUtils.INSTANCE.getBuildFlavorText(), BuildUtils.INSTANCE.getBuildType(), eventBus);
            return new Impl(context, WickrCore.getCoreContext(), lifecycleMonitor);
        }
    }

    /* JADX INFO: Access modifiers changed from: private */
    /* JADX INFO: compiled from: WickrAppContext.kt */
    @Metadata(d1 = {"\u0000\u008c\u0003\n\u0002\u0018\u0002\n\u0002\u0018\u0002\n\u0002\u0018\u0002\n\u0000\n\u0002\u0018\u0002\n\u0002\b\u0002\n\u0002\u0018\u0002\n\u0002\b\u0007\n\u0002\u0018\u0002\n\u0002\b\u0003\n\u0002\u0018\u0002\n\u0002\b\u0005\n\u0002\u0018\u0002\n\u0002\b\u0004\n\u0002\u0018\u0002\n\u0002\b\u0003\n\u0002\u0018\u0002\n\u0002\b\u0004\n\u0002\u0018\u0002\n\u0002\b\u0003\n\u0002\u0018\u0002\n\u0002\b\u0004\n\u0002\u0018\u0002\n\u0000\n\u0002\u0018\u0002\n\u0002\u0018\u0002\n\u0000\n\u0002\u0018\u0002\n\u0002\u0018\u0002\n\u0000\n\u0002\u0018\u0002\n\u0002\u0018\u0002\n\u0000\n\u0002\u0018\u0002\n\u0002\u0018\u0002\n\u0000\n\u0002\u0018\u0002\n\u0002\u0018\u0002\n\u0000\n\u0002\u0018\u0002\n\u0002\u0018\u0002\n\u0000\n\u0002\u0018\u0002\n\u0002\u0018\u0002\n\u0000\n\u0002\u0018\u0002\n\u0002\u0018\u0002\n\u0000\n\u0002\u0018\u0002\n\u0002\u0018\u0002\n\u0000\n\u0002\u0018\u0002\n\u0000\n\u0002\u0018\u0002\n\u0002\b\u0003\n\u0002\u0018\u0002\n\u0002\b\u0005\n\u0002\u0018\u0002\n\u0002\b\u0003\n\u0002\u0018\u0002\n\u0002\b\u0003\n\u0002\u0018\u0002\n\u0002\b\u0003\n\u0002\u0018\u0002\n\u0002\b\u0003\n\u0002\u0018\u0002\n\u0002\b\u0003\n\u0002\u0018\u0002\n\u0002\b\u0003\n\u0002\u0018\u0002\n\u0002\b\u0003\n\u0002\u0018\u0002\n\u0002\b\u0003\n\u0002\u0018\u0002\n\u0002\b\u0003\n\u0002\u0018\u0002\n\u0002\b\u0003\n\u0002\u0018\u0002\n\u0002\b\u0003\n\u0002\u0018\u0002\n\u0002\b\u0003\n\u0002\u0018\u0002\n\u0002\b\u0003\n\u0002\u0018\u0002\n\u0002\b\u0003\n\u0002\u0018\u0002\n\u0002\b\u0003\n\u0002\u0018\u0002\n\u0002\b\u0003\n\u0002\u0018\u0002\n\u0002\b\u0003\n\u0002\u0018\u0002\n\u0002\b\u0003\n\u0002\u0018\u0002\n\u0002\b\u0003\n\u0002\u0018\u0002\n\u0002\b\u0003\n\u0002\u0018\u0002\n\u0002\b\u0003\n\u0002\u0018\u0002\n\u0002\b\u0003\n\u0002\u0018\u0002\n\u0002\b\u0003\n\u0002\u0018\u0002\n\u0002\b\u0005\b\u0002\u0018\u00002\u00020\u00012\u00020\u0002B\u001f\u0012\u0006\u0010\u0003\u001a\u00020\u0004\u0012\u0006\u0010\u0005\u001a\u00020\u0002\u0012\u0006\u0010\u0006\u001a\u00020\u0007¢\u0006\u0004\b\b\u0010\tJ\u0010\u0010/\u001a\u0002002\u0006\u00101\u001a\u000202H\u0016J\u0010\u0010/\u001a\u0002032\u0006\u00104\u001a\u000205H\u0016J\u0010\u0010/\u001a\u0002062\u0006\u00107\u001a\u000208H\u0016J\u0010\u0010/\u001a\u0002092\u0006\u0010:\u001a\u00020;H\u0016J\u0010\u0010/\u001a\u00020<2\u0006\u0010=\u001a\u00020>H\u0016J\u0010\u0010/\u001a\u00020?2\u0006\u0010@\u001a\u00020AH\u0016J\u0010\u0010/\u001a\u00020B2\u0006\u0010C\u001a\u00020DH\u0016J\u0010\u0010/\u001a\u00020E2\u0006\u0010F\u001a\u00020GH\u0016J\u0010\u0010/\u001a\u00020H2\u0006\u0010I\u001a\u00020JH\u0016J\u0010\u0010/\u001a\u00020K2\u0006\u0010L\u001a\u00020MH\u0016R\u0014\u0010\u0003\u001a\u00020\u0004X\u0096\u0004¢\u0006\b\n\u0000\u001a\u0004\b\n\u0010\u000bR\u0014\u0010\u0006\u001a\u00020\u0007X\u0096\u0004¢\u0006\b\n\u0000\u001a\u0004\b\f\u0010\rR\u0014\u0010\u000e\u001a\u00020\u000fX\u0096\u0004¢\u0006\b\n\u0000\u001a\u0004\b\u0010\u0010\u0011R\u001b\u0010\u0012\u001a\u00020\u00138VX\u0096\u0084\u0002¢\u0006\f\n\u0004\b\u0016\u0010\u0017\u001a\u0004\b\u0014\u0010\u0015R\u001b\u0010\u0018\u001a\u00020\u00198VX\u0096\u0084\u0002¢\u0006\f\n\u0004\b\u001c\u0010\u0017\u001a\u0004\b\u001a\u0010\u001bR\u0014\u0010\u001d\u001a\u00020\u001e8VX\u0096\u0004¢\u0006\u0006\u001a\u0004\b\u001f\u0010 R\u001b\u0010!\u001a\u00020\"8VX\u0096\u0084\u0002¢\u0006\f\n\u0004\b%\u0010\u0017\u001a\u0004\b#\u0010$R\u0014\u0010&\u001a\u00020'X\u0096\u0004¢\u0006\b\n\u0000\u001a\u0004\b(\u0010)R\u001b\u0010*\u001a\u00020+8VX\u0096\u0084\u0002¢\u0006\f\n\u0004\b.\u0010\u0017\u001a\u0004\b,\u0010-R\u0012\u0010N\u001a\u00020OX\u0096\u0005¢\u0006\u0006\u001a\u0004\bP\u0010QR\u0012\u0010R\u001a\u00020SX\u0096\u0005¢\u0006\u0006\u001a\u0004\bT\u0010UR\u0012\u0010V\u001a\u00020\u0004X\u0096\u0005¢\u0006\u0006\u001a\u0004\bW\u0010\u000bR\u0012\u0010X\u001a\u00020YX\u0096\u0005¢\u0006\u0006\u001a\u0004\bZ\u0010[R\u0012\u0010\\\u001a\u00020]X\u0096\u0005¢\u0006\u0006\u001a\u0004\b^\u0010_R\u0012\u0010`\u001a\u00020aX\u0096\u0005¢\u0006\u0006\u001a\u0004\bb\u0010cR\u0012\u0010d\u001a\u00020eX\u0096\u0005¢\u0006\u0006\u001a\u0004\bf\u0010gR\u0012\u0010h\u001a\u00020iX\u0096\u0005¢\u0006\u0006\u001a\u0004\bj\u0010kR\u0012\u0010l\u001a\u00020mX\u0096\u0005¢\u0006\u0006\u001a\u0004\bn\u0010oR\u0012\u0010p\u001a\u00020qX\u0096\u0005¢\u0006\u0006\u001a\u0004\br\u0010sR\u0012\u0010t\u001a\u00020uX\u0096\u0005¢\u0006\u0006\u001a\u0004\bv\u0010wR\u0012\u0010x\u001a\u00020yX\u0096\u0005¢\u0006\u0006\u001a\u0004\bz\u0010{R\u0012\u0010|\u001a\u00020}X\u0096\u0005¢\u0006\u0006\u001a\u0004\b~\u0010\u007fR\u0016\u0010\u0080\u0001\u001a\u00030\u0081\u0001X\u0096\u0005¢\u0006\b\u001a\u0006\b\u0082\u0001\u0010\u0083\u0001R\u0016\u0010\u0084\u0001\u001a\u00030\u0085\u0001X\u0096\u0005¢\u0006\b\u001a\u0006\b\u0086\u0001\u0010\u0087\u0001R\u0016\u0010\u0088\u0001\u001a\u00030\u0089\u0001X\u0096\u0005¢\u0006\b\u001a\u0006\b\u008a\u0001\u0010\u008b\u0001R\u0016\u0010\u008c\u0001\u001a\u00030\u008d\u0001X\u0096\u0005¢\u0006\b\u001a\u0006\b\u008e\u0001\u0010\u008f\u0001R\u0016\u0010\u0090\u0001\u001a\u00030\u0091\u0001X\u0096\u0005¢\u0006\b\u001a\u0006\b\u0092\u0001\u0010\u0093\u0001R\u0016\u0010\u0094\u0001\u001a\u00030\u0095\u0001X\u0096\u0005¢\u0006\b\u001a\u0006\b\u0096\u0001\u0010\u0097\u0001R\u0016\u0010\u0098\u0001\u001a\u00030\u0099\u0001X\u0096\u0005¢\u0006\b\u001a\u0006\b\u009a\u0001\u0010\u009b\u0001R\u0016\u0010\u009c\u0001\u001a\u00030\u009d\u0001X\u0096\u0005¢\u0006\b\u001a\u0006\b\u009e\u0001\u0010\u009f\u0001R\u0016\u0010 \u0001\u001a\u00030¡\u0001X\u0096\u0005¢\u0006\b\u001a\u0006\b¢\u0001\u0010£\u0001R\u0016\u0010¤\u0001\u001a\u00030¥\u0001X\u0096\u0005¢\u0006\b\u001a\u0006\b¦\u0001\u0010§\u0001R\u0016\u0010¨\u0001\u001a\u00030©\u0001X\u0096\u0005¢\u0006\b\u001a\u0006\bª\u0001\u0010«\u0001R\u0016\u0010¬\u0001\u001a\u00030\u00ad\u0001X\u0096\u0005¢\u0006\b\u001a\u0006\b®\u0001\u0010¯\u0001R\u0016\u0010°\u0001\u001a\u00030±\u0001X\u0096\u0005¢\u0006\b\u001a\u0006\b²\u0001\u0010³\u0001R\u0016\u0010´\u0001\u001a\u00030µ\u0001X\u0096\u0005¢\u0006\b\u001a\u0006\b¶\u0001\u0010·\u0001R\u0016\u0010¸\u0001\u001a\u00030\u0089\u0001X\u0096\u0005¢\u0006\b\u001a\u0006\b¹\u0001\u0010\u008b\u0001¨\u0006º\u0001"}, d2 = {"Lcom/wickr/enterprise/di/WickrAppContext$Impl;", "Lcom/wickr/enterprise/di/WickrAppContext;", "Lcom/wickr/di/WickrCoreContext;", "context", "Landroid/app/Application;", "wickrCoreContext", "lifecycleMonitor", "Lcom/wickr/enterprise/util/LifecycleMonitor;", "<init>", "(Landroid/app/Application;Lcom/wickr/di/WickrCoreContext;Lcom/wickr/enterprise/util/LifecycleMonitor;)V", "getContext", "()Landroid/app/Application;", "getLifecycleMonitor", "()Lcom/wickr/enterprise/util/LifecycleMonitor;", "notificationManager", "Lcom/wickr/enterprise/notifications/NotificationManager;", "getNotificationManager", "()Lcom/wickr/enterprise/notifications/NotificationManager;", "locationManager", "Lcom/wickr/enterprise/location/LocationManager;", "getLocationManager", "()Lcom/wickr/enterprise/location/LocationManager;", "locationManager$delegate", "Lkotlin/Lazy;", "screenshotManager", "Lcom/wickr/enterprise/helpers/ScreenshotManager;", "getScreenshotManager", "()Lcom/wickr/enterprise/helpers/ScreenshotManager;", "screenshotManager$delegate", "apiBroadcastHandler", "Lcom/wickr/enterprise/api/receivers/WickrAPIBroadcastHandler;", "getApiBroadcastHandler", "()Lcom/wickr/enterprise/api/receivers/WickrAPIBroadcastHandler;", "apiManager", "Lcom/wickr/enterprise/api/WickrAPIManager;", "getApiManager", "()Lcom/wickr/enterprise/api/WickrAPIManager;", "apiManager$delegate", "delegateLinkResolver", "Lcom/wickr/markdown/DelegateLinkResolver;", "getDelegateLinkResolver", "()Lcom/wickr/markdown/DelegateLinkResolver;", "markdownRenderer", "Lcom/wickr/markdown/MarkdownRenderer;", "getMarkdownRenderer", "()Lcom/wickr/markdown/MarkdownRenderer;", "markdownRenderer$delegate", "plus", "Lcom/wickr/enterprise/registration/di/RegistrationContext;", "registrationModule", "Lcom/wickr/enterprise/registration/di/RegistrationModule;", "Lcom/wickr/enterprise/di/ContactListContext;", "contactListModule", "Lcom/wickr/enterprise/di/ContactListModule;", "Lcom/wickr/enterprise/di/AddRoomMembersContext;", "addRoomMembersModule", "Lcom/wickr/enterprise/di/AddRoomMembersModule;", "Lcom/wickr/enterprise/di/CRSRoomErrorContext;", "crsRoomErrorModule", "Lcom/wickr/enterprise/di/CRSRoomErrorModule;", "Lcom/wickr/enterprise/di/ChatContext;", "chatModule", "Lcom/wickr/enterprise/di/ChatModule;", "Lcom/wickr/enterprise/di/PrivateChatInfoContext;", "privateChatInfoModule", "Lcom/wickr/enterprise/di/PrivateChatInfoModule;", "Lcom/wickr/enterprise/di/SecureRoomInfoContext;", "secureRoomInfoModule", "Lcom/wickr/enterprise/di/SecureRoomInfoModule;", "Lcom/wickr/enterprise/di/SecureRoomMemberListContext;", "secureRoomMemberListModule", "Lcom/wickr/enterprise/di/SecureRoomMemberListModule;", "Lcom/wickr/enterprise/di/SearchContext;", "searchModule", "Lcom/wickr/enterprise/di/SearchModule;", "Lcom/wickr/enterprise/di/MessageReactionListContext;", "messageReactionListModule", "Lcom/wickr/enterprise/di/MessageReactionListModule;", "androidKeyStore", "Lcom/wickr/util/AndroidKeyStore;", "getAndroidKeyStore", "()Lcom/wickr/util/AndroidKeyStore;", "appClock", "Lcom/wickr/util/WickrAppClock;", "getAppClock", "()Lcom/wickr/util/WickrAppClock;", "application", "getApplication", "baseUrlProvider", "Lcom/mywickr/interfaces/BaseUrlProvider;", "getBaseUrlProvider", "()Lcom/mywickr/interfaces/BaseUrlProvider;", "buildConfig", "Lcom/wickr/di/WickrBuildConfig;", "getBuildConfig", "()Lcom/wickr/di/WickrBuildConfig;", "cipher", "Lcom/wickr/sdk/WickrCipher;", "getCipher", "()Lcom/wickr/sdk/WickrCipher;", "contextFactory", "Lcom/wickr/sdk/WickrContextFactory;", "getContextFactory", "()Lcom/wickr/sdk/WickrContextFactory;", "coreFeatureConfig", "Lcom/mywickr/config/CoreFeatureConfig;", "getCoreFeatureConfig", "()Lcom/mywickr/config/CoreFeatureConfig;", "coreMetrics", "Lcom/wickr/util/CoreMetrics;", "getCoreMetrics", "()Lcom/wickr/util/CoreMetrics;", "database", "Lnet/zetetic/database/sqlcipher/SQLiteDatabase;", "getDatabase", "()Lnet/zetetic/database/sqlcipher/SQLiteDatabase;", "databaseAdapter", "Lcom/mywickr/wickr/WickrDBAdapter;", "getDatabaseAdapter", "()Lcom/mywickr/wickr/WickrDBAdapter;", Device.TYPE, "Lcom/wickr/sdk/WickrDevice;", "getDevice", "()Lcom/wickr/sdk/WickrDevice;", "eventBus", "Lorg/greenrobot/eventbus/EventBus;", "getEventBus", "()Lorg/greenrobot/eventbus/EventBus;", "fileManager", "Lcom/wickr/files/FileManager;", "getFileManager", "()Lcom/wickr/files/FileManager;", "fileShredderService", "Lcom/wickr/files/FileShredderService;", "getFileShredderService", "()Lcom/wickr/files/FileShredderService;", "jobScheduler", "Lcom/mywickr/networking/requests/jobs/WickrJobScheduler;", "getJobScheduler", "()Lcom/mywickr/networking/requests/jobs/WickrJobScheduler;", "keyGenerator", "Lcom/wickr/sdk/WickrKeyGenerator;", "getKeyGenerator", "()Lcom/wickr/sdk/WickrKeyGenerator;", "loginManager", "Lcom/wickr/registration/LoginManager;", "getLoginManager", "()Lcom/wickr/registration/LoginManager;", "networkActivityMonitor", "Lcom/wickr/networking/NetworkActivityMonitor;", "getNetworkActivityMonitor", "()Lcom/wickr/networking/NetworkActivityMonitor;", "networkClient", "Lcom/wickr/networking/NetworkClient;", "getNetworkClient", "()Lcom/wickr/networking/NetworkClient;", "networkMonitor", "Lcom/wickr/networking/NetworkStatusMonitor;", "getNetworkMonitor", "()Lcom/wickr/networking/NetworkStatusMonitor;", "product", "Lcom/wickr/sdk/WickrProduct;", "getProduct", "()Lcom/wickr/sdk/WickrProduct;", "proxyHandler", "Lcom/wickr/registration/ProxyHandler;", "getProxyHandler", "()Lcom/wickr/registration/ProxyHandler;", "proxyManager", "Lcom/wickr/networking/proxy/ProxyManager;", "getProxyManager", "()Lcom/wickr/networking/proxy/ProxyManager;", "proxyRefreshService", "Lcom/wickr/networking/WickrProxyRefreshService;", "getProxyRefreshService", "()Lcom/wickr/networking/WickrProxyRefreshService;", "sessionManager", "Lcom/wickr/session/SessionManager;", "getSessionManager", "()Lcom/wickr/session/SessionManager;", "sessionTimeoutMetrics", "Lcom/wickr/session/SessionTimeoutMetrics;", "getSessionTimeoutMetrics", "()Lcom/wickr/session/SessionTimeoutMetrics;", "wickrJobScheduler", "getWickrJobScheduler", "app_awsRelease"}, k = 1, mv = {2, 2, 0}, xi = 48)
    static final class Impl implements WickrAppContext, WickrCoreContext {
        private final /* synthetic */ WickrCoreContext $$delegate_0;

        /* JADX INFO: renamed from: apiManager$delegate, reason: from kotlin metadata */
        private final Lazy apiManager;
        private final Application context;
        private final DelegateLinkResolver delegateLinkResolver;
        private final LifecycleMonitor lifecycleMonitor;

        /* JADX INFO: renamed from: locationManager$delegate, reason: from kotlin metadata */
        private final Lazy locationManager;

        /* JADX INFO: renamed from: markdownRenderer$delegate, reason: from kotlin metadata */
        private final Lazy markdownRenderer;
        private final NotificationManager notificationManager;

        /* JADX INFO: renamed from: screenshotManager$delegate, reason: from kotlin metadata */
        private final Lazy screenshotManager;

        @Override // com.wickr.di.WickrCoreModule
        public AndroidKeyStore getAndroidKeyStore() {
            return this.$$delegate_0.getAndroidKeyStore();
        }

        @Override // com.wickr.di.WickrCoreModule
        public WickrAppClock getAppClock() {
            return this.$$delegate_0.getAppClock();
        }

        @Override // com.wickr.di.WickrCoreContext
        public Application getApplication() {
            return this.$$delegate_0.getApplication();
        }

        @Override // com.wickr.di.WickrCoreModule
        public BaseUrlProvider getBaseUrlProvider() {
            return this.$$delegate_0.getBaseUrlProvider();
        }

        @Override // com.wickr.di.WickrCoreContext
        public WickrBuildConfig getBuildConfig() {
            return this.$$delegate_0.getBuildConfig();
        }

        @Override // com.wickr.di.WickrSDKModule
        public WickrCipher getCipher() {
            return this.$$delegate_0.getCipher();
        }

        @Override // com.wickr.di.WickrSDKModule
        public WickrContextFactory getContextFactory() {
            return this.$$delegate_0.getContextFactory();
        }

        @Override // com.wickr.di.WickrCoreContext
        public CoreFeatureConfig getCoreFeatureConfig() {
            return this.$$delegate_0.getCoreFeatureConfig();
        }

        @Override // com.wickr.di.WickrCoreMetricsModule
        public CoreMetrics getCoreMetrics() {
            return this.$$delegate_0.getCoreMetrics();
        }

        @Override // com.wickr.di.WickrDatabaseModule
        public SQLiteDatabase getDatabase() {
            return this.$$delegate_0.getDatabase();
        }

        @Override // com.wickr.di.WickrDatabaseModule
        public WickrDBAdapter getDatabaseAdapter() {
            return this.$$delegate_0.getDatabaseAdapter();
        }

        @Override // com.wickr.di.WickrSDKModule
        public WickrDevice getDevice() {
            return this.$$delegate_0.getDevice();
        }

        @Override // com.wickr.di.WickrCoreContext
        public EventBus getEventBus() {
            return this.$$delegate_0.getEventBus();
        }

        @Override // com.wickr.di.WickrCoreModule
        public FileManager getFileManager() {
            return this.$$delegate_0.getFileManager();
        }

        @Override // com.wickr.di.WickrCoreModule
        public FileShredderService getFileShredderService() {
            return this.$$delegate_0.getFileShredderService();
        }

        @Override // com.wickr.di.WickrCoreContext
        public WickrJobScheduler getJobScheduler() {
            return this.$$delegate_0.getJobScheduler();
        }

        @Override // com.wickr.di.WickrSDKModule
        public WickrKeyGenerator getKeyGenerator() {
            return this.$$delegate_0.getKeyGenerator();
        }

        @Override // com.wickr.di.WickrCoreModule
        public LoginManager getLoginManager() {
            return this.$$delegate_0.getLoginManager();
        }

        @Override // com.wickr.di.WickrNetworkModule
        public NetworkActivityMonitor getNetworkActivityMonitor() {
            return this.$$delegate_0.getNetworkActivityMonitor();
        }

        @Override // com.wickr.di.WickrNetworkModule
        public NetworkClient getNetworkClient() {
            return this.$$delegate_0.getNetworkClient();
        }

        @Override // com.wickr.di.WickrNetworkModule
        public NetworkStatusMonitor getNetworkMonitor() {
            return this.$$delegate_0.getNetworkMonitor();
        }

        @Override // com.wickr.di.WickrCoreContext
        public WickrProduct getProduct() {
            return this.$$delegate_0.getProduct();
        }

        @Override // com.wickr.di.WickrCoreContext
        public ProxyHandler getProxyHandler() {
            return this.$$delegate_0.getProxyHandler();
        }

        @Override // com.wickr.di.WickrNetworkModule
        public ProxyManager getProxyManager() {
            return this.$$delegate_0.getProxyManager();
        }

        @Override // com.wickr.di.WickrNetworkModule
        public WickrProxyRefreshService getProxyRefreshService() {
            return this.$$delegate_0.getProxyRefreshService();
        }

        @Override // com.wickr.di.WickrCoreModule
        public SessionManager getSessionManager() {
            return this.$$delegate_0.getSessionManager();
        }

        @Override // com.wickr.di.WickrCoreModule
        public SessionTimeoutMetrics getSessionTimeoutMetrics() {
            return this.$$delegate_0.getSessionTimeoutMetrics();
        }

        @Override // com.wickr.di.WickrCoreModule
        public WickrJobScheduler getWickrJobScheduler() {
            return this.$$delegate_0.getWickrJobScheduler();
        }

        public Impl(Application context, WickrCoreContext wickrCoreContext, LifecycleMonitor lifecycleMonitor) {
            Intrinsics.checkNotNullParameter(context, "context");
            Intrinsics.checkNotNullParameter(wickrCoreContext, "wickrCoreContext");
            Intrinsics.checkNotNullParameter(lifecycleMonitor, "lifecycleMonitor");
            this.$$delegate_0 = wickrCoreContext;
            this.context = context;
            this.lifecycleMonitor = lifecycleMonitor;
            this.notificationManager = new WickrNotificationManager(getContext(), getLifecycleMonitor(), getSessionManager(), App.INSTANCE);
            this.locationManager = LazyKt.lazy(new Function0() { // from class: com.wickr.enterprise.di.WickrAppContext$Impl$$ExternalSyntheticLambda0
                @Override // kotlin.jvm.functions.Function0
                public final Object invoke() {
                    return WickrAppContext.Impl.locationManager_delegate$lambda$0(this.f$0);
                }
            });
            this.screenshotManager = LazyKt.lazy(new Function0() { // from class: com.wickr.enterprise.di.WickrAppContext$Impl$$ExternalSyntheticLambda1
                @Override // kotlin.jvm.functions.Function0
                public final Object invoke() {
                    return WickrAppContext.Impl.screenshotManager_delegate$lambda$0(this.f$0);
                }
            });
            this.apiManager = LazyKt.lazy(new Function0() { // from class: com.wickr.enterprise.di.WickrAppContext$Impl$$ExternalSyntheticLambda2
                @Override // kotlin.jvm.functions.Function0
                public final Object invoke() {
                    return WickrAppContext.Impl.apiManager_delegate$lambda$0(this.f$0);
                }
            });
            this.delegateLinkResolver = new DelegateLinkResolver();
            this.markdownRenderer = LazyKt.lazy(new Function0() { // from class: com.wickr.enterprise.di.WickrAppContext$Impl$$ExternalSyntheticLambda3
                @Override // kotlin.jvm.functions.Function0
                public final Object invoke() {
                    return WickrAppContext.Impl.markdownRenderer_delegate$lambda$0(this.f$0);
                }
            });
        }

        @Override // com.wickr.di.WickrCoreContext
        public Application getContext() {
            return this.context;
        }

        @Override // com.wickr.enterprise.di.WickrAppContext
        public LifecycleMonitor getLifecycleMonitor() {
            return this.lifecycleMonitor;
        }

        @Override // com.wickr.di.WickrCoreContext
        public NotificationManager getNotificationManager() {
            return this.notificationManager;
        }

        @Override // com.wickr.enterprise.di.WickrAppContext
        public LocationManager getLocationManager() {
            return (LocationManager) this.locationManager.getValue();
        }

        /* JADX INFO: Access modifiers changed from: private */
        public static final WickrLocationManager locationManager_delegate$lambda$0(Impl impl) {
            return new WickrLocationManager(impl.getContext(), impl.getAppClock(), impl.getLifecycleMonitor(), impl.getSessionManager(), impl.getLoginManager());
        }

        @Override // com.wickr.enterprise.di.WickrAppContext
        public ScreenshotManager getScreenshotManager() {
            return (ScreenshotManager) this.screenshotManager.getValue();
        }

        /* JADX INFO: Access modifiers changed from: private */
        public static final ScreenshotManager screenshotManager_delegate$lambda$0(Impl impl) {
            return new ScreenshotManager(impl.getContext(), impl.getLifecycleMonitor(), impl.getFileManager(), impl.getSessionManager());
        }

        @Override // com.wickr.enterprise.di.WickrAppContext
        public WickrAPIBroadcastHandler getApiBroadcastHandler() {
            return getApiManager();
        }

        @Override // com.wickr.enterprise.di.WickrAppContext
        public WickrAPIManager getApiManager() {
            return (WickrAPIManager) this.apiManager.getValue();
        }

        /* JADX INFO: Access modifiers changed from: private */
        public static final WickrAPIManager apiManager_delegate$lambda$0(Impl impl) {
            return new WickrAPIManager(impl.getContext(), new WickrAPIServerConfigAuthHandler(WickrConfig.INSTANCE), new APICoroutineThreadExecutor(CoroutineScopeKt.CoroutineScope(Dispatchers.getIO())), impl.getSessionManager(), impl.getNotificationManager(), App.INSTANCE, new WickrAPIFeatureModuleManager(), new DatabaseConnectionManager(App.INSTANCE), new CacheSearchResultRepository(), new ServerSearchResultRepository(impl.getNetworkClient(), impl.getSessionManager()));
        }

        @Override // com.wickr.enterprise.di.WickrAppContext
        public DelegateLinkResolver getDelegateLinkResolver() {
            return this.delegateLinkResolver;
        }

        @Override // com.wickr.enterprise.di.WickrAppContext
        public MarkdownRenderer getMarkdownRenderer() {
            return (MarkdownRenderer) this.markdownRenderer.getValue();
        }

        /* JADX INFO: Access modifiers changed from: private */
        public static final MarkdownRenderer markdownRenderer_delegate$lambda$0(Impl impl) {
            return new MarkdownRenderer(new MarkdownConfiguration(ViewUtil.getAttributeColor(impl.getContext(), R.attr.primary_7), ViewUtil.getAttributeColor(impl.getContext(), R.attr.utility_1), ContextCompat.getColor(impl.getContext(), R.color.primary_2), ContextCompat.getColor(impl.getContext(), R.color.secondary_6), ViewUtil.getAttributeColor(impl.getContext(), R.attr.primary), ViewUtil.getAttributeColor(impl.getContext(), R.attr.primary_1), ViewUtil.getAttributeColor(impl.getContext(), R.attr.primary_2), null, impl.getDelegateLinkResolver()));
        }

        @Override // com.wickr.enterprise.di.WickrAppContext
        public RegistrationContext plus(RegistrationModule registrationModule) {
            Intrinsics.checkNotNullParameter(registrationModule, "registrationModule");
            return RegistrationContext.INSTANCE.create(this, registrationModule);
        }

        @Override // com.wickr.enterprise.di.WickrAppContext
        public ContactListContext plus(ContactListModule contactListModule) {
            Intrinsics.checkNotNullParameter(contactListModule, "contactListModule");
            return ContactListContext.INSTANCE.create(this, contactListModule);
        }

        @Override // com.wickr.enterprise.di.WickrAppContext
        public AddRoomMembersContext plus(AddRoomMembersModule addRoomMembersModule) {
            Intrinsics.checkNotNullParameter(addRoomMembersModule, "addRoomMembersModule");
            return AddRoomMembersContext.INSTANCE.create(this, addRoomMembersModule);
        }

        @Override // com.wickr.enterprise.di.WickrAppContext
        public CRSRoomErrorContext plus(CRSRoomErrorModule crsRoomErrorModule) {
            Intrinsics.checkNotNullParameter(crsRoomErrorModule, "crsRoomErrorModule");
            return CRSRoomErrorContext.INSTANCE.create(this, crsRoomErrorModule);
        }

        @Override // com.wickr.enterprise.di.WickrAppContext
        public ChatContext plus(ChatModule chatModule) {
            Intrinsics.checkNotNullParameter(chatModule, "chatModule");
            return ChatContext.INSTANCE.create(this, chatModule);
        }

        @Override // com.wickr.enterprise.di.WickrAppContext
        public PrivateChatInfoContext plus(PrivateChatInfoModule privateChatInfoModule) {
            Intrinsics.checkNotNullParameter(privateChatInfoModule, "privateChatInfoModule");
            return PrivateChatInfoContext.INSTANCE.create(this, privateChatInfoModule);
        }

        @Override // com.wickr.enterprise.di.WickrAppContext
        public SecureRoomInfoContext plus(SecureRoomInfoModule secureRoomInfoModule) {
            Intrinsics.checkNotNullParameter(secureRoomInfoModule, "secureRoomInfoModule");
            return SecureRoomInfoContext.INSTANCE.create(this, secureRoomInfoModule);
        }

        @Override // com.wickr.enterprise.di.WickrAppContext
        public SecureRoomMemberListContext plus(SecureRoomMemberListModule secureRoomMemberListModule) {
            Intrinsics.checkNotNullParameter(secureRoomMemberListModule, "secureRoomMemberListModule");
            return SecureRoomMemberListContext.INSTANCE.create(this, secureRoomMemberListModule);
        }

        @Override // com.wickr.enterprise.di.WickrAppContext
        public SearchContext plus(SearchModule searchModule) {
            Intrinsics.checkNotNullParameter(searchModule, "searchModule");
            return SearchContext.INSTANCE.create(this, searchModule);
        }

        @Override // com.wickr.enterprise.di.WickrAppContext
        public MessageReactionListContext plus(MessageReactionListModule messageReactionListModule) {
            Intrinsics.checkNotNullParameter(messageReactionListModule, "messageReactionListModule");
            return MessageReactionListContext.INSTANCE.create(this, messageReactionListModule);
        }
    }
}
