package com.wickr.enterprise.dashboard;

import android.content.DialogInterface;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.view.MenuItem;
import androidx.appcompat.app.ActionBar;
import androidx.core.app.NotificationCompat;
import androidx.fragment.app.Fragment;
import androidx.fragment.app.FragmentTransaction;
import com.mywickr.config.WickrConfig;
import com.mywickr.db.WickrSecurityLevel;
import com.mywickr.wickr.WickrSettings;
import com.wickr.enterprise.base.BaseView;
import com.wickr.enterprise.base.ValidSessionActivity;
import com.wickr.enterprise.chat.ConversationActivity;
import com.wickr.enterprise.dashboard.adapter.WickrConvoModelClickListener;
import com.wickr.enterprise.databinding.ActivityShareContentBinding;
import com.wickr.pro.R;
import com.wickr.session.Session;
import java.util.Iterator;
import java.util.List;
import kotlin.Metadata;
import kotlin.jvm.internal.Intrinsics;
import kotlin.jvm.internal.Reflection;
import org.greenrobot.eventbus.Subscribe;
import timber.log.Timber;

/* JADX INFO: compiled from: ShareExternalContentActivity.kt */
/* JADX INFO: loaded from: classes3.dex */
@Metadata(d1 = {"\u0000T\n\u0002\u0018\u0002\n\u0002\u0018\u0002\n\u0002\u0018\u0002\n\u0002\b\u0003\n\u0002\u0010\u000e\n\u0000\n\u0002\u0018\u0002\n\u0000\n\u0002\u0018\u0002\n\u0000\n\u0002\u0010\u0002\n\u0000\n\u0002\u0018\u0002\n\u0000\n\u0002\u0010\u000b\n\u0000\n\u0002\u0018\u0002\n\u0002\b\u0003\n\u0002\u0018\u0002\n\u0002\b\u0003\n\u0002\u0018\u0002\n\u0002\b\u0004\n\u0002\u0018\u0002\n\u0002\b\u0003\b\u0007\u0018\u00002\u00020\u00012\u00020\u0002B\u0007¢\u0006\u0004\b\u0003\u0010\u0004J\u0012\u0010\u000b\u001a\u00020\f2\b\u0010\r\u001a\u0004\u0018\u00010\u000eH\u0014J\u0010\u0010\u000f\u001a\u00020\u00102\u0006\u0010\u0011\u001a\u00020\u0012H\u0016J\b\u0010\u0013\u001a\u00020\fH\u0014J\u0015\u0010\u0014\u001a\u00020\f2\u0006\u0010\u0015\u001a\u00020\u0016H\u0001¢\u0006\u0002\b\u0017J\u0010\u0010\u0018\u001a\u00020\f2\u0006\u0010\u0019\u001a\u00020\u001aH\u0016J\u0010\u0010\u001b\u001a\u00020\f2\u0006\u0010\u0019\u001a\u00020\u001aH\u0016J\u0010\u0010\u001c\u001a\u00020\f2\u0006\u0010\u0019\u001a\u00020\u001aH\u0016J\u0018\u0010\u001d\u001a\u00020\f2\u0006\u0010\u001e\u001a\u00020\u001f2\u0006\u0010\u0019\u001a\u00020\u001aH\u0002J\b\u0010 \u001a\u00020\fH\u0002J\u0010\u0010!\u001a\u00020\f2\u0006\u0010\u0019\u001a\u00020\u001aH\u0002R\u0010\u0010\u0005\u001a\u0004\u0018\u00010\u0006X\u0082\u000e¢\u0006\u0002\n\u0000R\u0010\u0010\u0007\u001a\u0004\u0018\u00010\bX\u0082\u000e¢\u0006\u0002\n\u0000R\u000e\u0010\t\u001a\u00020\nX\u0082.¢\u0006\u0002\n\u0000¨\u0006\""}, d2 = {"Lcom/wickr/enterprise/dashboard/ShareExternalContentActivity;", "Lcom/wickr/enterprise/base/ValidSessionActivity;", "Lcom/wickr/enterprise/dashboard/adapter/WickrConvoModelClickListener;", "<init>", "()V", "shareText", "", "shareUri", "Landroid/net/Uri;", "binding", "Lcom/wickr/enterprise/databinding/ActivityShareContentBinding;", "onCreate", "", "savedInstanceState", "Landroid/os/Bundle;", "onOptionsItemSelected", "", "item", "Landroid/view/MenuItem;", "onStart", "onWickrConfigChanged", NotificationCompat.CATEGORY_EVENT, "Lcom/mywickr/config/WickrConfig$Event;", "onWickrConfigChanged$app_awsRelease", "onWickrConvoModelClicked", "convo", "Lcom/wickr/enterprise/dashboard/adapter/WickrConvoModel;", "onWickrConvoModelLongClicked", "onCallButtonClicked", "showSentinelAlertDialog", "lowestFoundSecurityLevel", "Lcom/mywickr/db/WickrSecurityLevel;", "refreshFileSharePermission", "openClickedConvo", "app_awsRelease"}, k = 1, mv = {2, 2, 0}, xi = 48)
public final class ShareExternalContentActivity extends ValidSessionActivity implements WickrConvoModelClickListener {
    public static final int $stable = 8;
    private ActivityShareContentBinding binding;
    private String shareText;
    private Uri shareUri;

    @Override // com.wickr.enterprise.dashboard.adapter.WickrConvoModelClickListener
    public void onCallButtonClicked(com.wickr.enterprise.dashboard.adapter.WickrConvoModel convo) {
        Intrinsics.checkNotNullParameter(convo, "convo");
    }

    @Override // com.wickr.enterprise.dashboard.adapter.WickrConvoModelClickListener
    public void onWickrConvoModelLongClicked(com.wickr.enterprise.dashboard.adapter.WickrConvoModel convo) {
        Intrinsics.checkNotNullParameter(convo, "convo");
    }

    @Override // com.wickr.enterprise.base.ValidSessionActivity, com.wickr.enterprise.base.BaseActivity, com.wickr.enterprise.base.Hilt_BaseActivity, androidx.fragment.app.FragmentActivity, androidx.activity.ComponentActivity, androidx.core.app.ComponentActivity, android.app.Activity
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        ActivityShareContentBinding activityShareContentBindingInflate = ActivityShareContentBinding.inflate(getLayoutInflater());
        Intrinsics.checkNotNullExpressionValue(activityShareContentBindingInflate, "inflate(...)");
        this.binding = activityShareContentBindingInflate;
        ActivityShareContentBinding activityShareContentBinding = null;
        if (activityShareContentBindingInflate == null) {
            Intrinsics.throwUninitializedPropertyAccessException("binding");
            activityShareContentBindingInflate = null;
        }
        setContentView(activityShareContentBindingInflate.getRoot());
        ActivityShareContentBinding activityShareContentBinding2 = this.binding;
        if (activityShareContentBinding2 == null) {
            Intrinsics.throwUninitializedPropertyAccessException("binding");
            activityShareContentBinding2 = null;
        }
        setSupportActionBar(activityShareContentBinding2.shareContentToolbar.toolbar);
        ActionBar supportActionBar = getSupportActionBar();
        if (supportActionBar != null) {
            supportActionBar.setTitle(getString(R.string.share_content_title));
            supportActionBar.setDisplayHomeAsUpEnabled(true);
        }
        Intent intent = getIntent();
        this.shareText = intent != null ? intent.getStringExtra("android.intent.extra.TEXT") : null;
        Intent intent2 = getIntent();
        this.shareUri = intent2 != null ? (Uri) intent2.getParcelableExtra("android.intent.extra.STREAM") : null;
        if (savedInstanceState == null) {
            DashboardListFragment dashboardListFragmentNewInstance = DashboardListFragment.INSTANCE.newInstance(new DashboardListPresenter.ListType[]{DashboardListPresenter.ListType.ROOMS, DashboardListPresenter.ListType.DMS}, false);
            FragmentTransaction fragmentTransactionBeginTransaction = getSupportFragmentManager().beginTransaction();
            ActivityShareContentBinding activityShareContentBinding3 = this.binding;
            if (activityShareContentBinding3 == null) {
                Intrinsics.throwUninitializedPropertyAccessException("binding");
            } else {
                activityShareContentBinding = activityShareContentBinding3;
            }
            fragmentTransactionBeginTransaction.replace(activityShareContentBinding.fragmentContainer.getId(), dashboardListFragmentNewInstance, Reflection.getOrCreateKotlinClass(DashboardListFragment.class).getSimpleName()).commit();
        }
    }

    @Override // android.app.Activity
    public boolean onOptionsItemSelected(MenuItem item) {
        Intrinsics.checkNotNullParameter(item, "item");
        if (item.getItemId() == 16908332) {
            finish();
            return true;
        }
        return super.onOptionsItemSelected(item);
    }

    @Override // com.wickr.enterprise.base.ValidSessionActivity, com.wickr.enterprise.base.BaseActivity, androidx.appcompat.app.AppCompatActivity, androidx.fragment.app.FragmentActivity, android.app.Activity
    protected void onStart() {
        super.onStart();
        Fragment fragmentFindFragmentByTag = getSupportFragmentManager().findFragmentByTag(Reflection.getOrCreateKotlinClass(DashboardListFragment.class).getSimpleName());
        DashboardListFragment dashboardListFragment = fragmentFindFragmentByTag instanceof DashboardListFragment ? (DashboardListFragment) fragmentFindFragmentByTag : null;
        if (dashboardListFragment != null) {
            dashboardListFragment.setConvoClickListener(this);
        }
        refreshFileSharePermission();
    }

    @Subscribe
    public final void onWickrConfigChanged$app_awsRelease(WickrConfig.Event event) {
        Intrinsics.checkNotNullParameter(event, "event");
        if (event.success) {
            refreshFileSharePermission();
        }
    }

    @Override // com.wickr.enterprise.dashboard.adapter.WickrConvoModelClickListener
    public void onWickrConvoModelClicked(com.wickr.enterprise.dashboard.adapter.WickrConvoModel convo) {
        WickrSecurityLevel wickrSecurityLevel;
        WickrSecurityLevel wickrSecurityLevel2;
        Object next;
        WickrSettings settings;
        Intrinsics.checkNotNullParameter(convo, "convo");
        if (WickrConfig.INSTANCE.isGuardEnabled()) {
            Session activeSession = this.sessionManager.getActiveSession();
            Object obj = null;
            List<WickrSecurityLevel> securityLevels = (activeSession == null || (settings = activeSession.getSettings()) == null) ? null : settings.getSecurityLevels();
            int securityLevelId = (int) WickrConfig.INSTANCE.getSecurityLevelId();
            if (securityLevels != null) {
                Iterator<T> it = securityLevels.iterator();
                do {
                    if (!it.hasNext()) {
                        next = null;
                        break;
                    }
                    next = it.next();
                } while (((WickrSecurityLevel) next).getLevel() != 0);
                wickrSecurityLevel = (WickrSecurityLevel) next;
            } else {
                wickrSecurityLevel = null;
            }
            if (wickrSecurityLevel != null) {
                if (securityLevelId == 0) {
                    wickrSecurityLevel2 = wickrSecurityLevel;
                } else {
                    for (Object obj2 : securityLevels) {
                        if (((WickrSecurityLevel) obj2).getSecurityId() == securityLevelId) {
                            obj = obj2;
                            break;
                        }
                    }
                    wickrSecurityLevel2 = (WickrSecurityLevel) obj;
                }
                WickrSecurityLevel lowestSecurityLevel = convo.getLowestSecurityLevel();
                if (lowestSecurityLevel != null && wickrSecurityLevel2 != null) {
                    if (lowestSecurityLevel.getLevel() < wickrSecurityLevel2.getLevel()) {
                        showSentinelAlertDialog(lowestSecurityLevel, convo);
                        return;
                    } else {
                        openClickedConvo(convo);
                        return;
                    }
                }
                showSentinelAlertDialog(wickrSecurityLevel, convo);
                return;
            }
            return;
        }
        openClickedConvo(convo);
    }

    private final void showSentinelAlertDialog(WickrSecurityLevel lowestFoundSecurityLevel, final com.wickr.enterprise.dashboard.adapter.WickrConvoModel convo) {
        ShareExternalContentActivity shareExternalContentActivity = this;
        String label = lowestFoundSecurityLevel.getLabel();
        if (label == null) {
            label = "";
        }
        String string = getString(R.string.guard_chat_block_message);
        Intrinsics.checkNotNullExpressionValue(string, "getString(...)");
        BaseView.showAlertDialog$default(shareExternalContentActivity, label, string, true, getString(R.string.dialog_button_continue), new DialogInterface.OnClickListener() { // from class: com.wickr.enterprise.dashboard.ShareExternalContentActivity$$ExternalSyntheticLambda1
            @Override // android.content.DialogInterface.OnClickListener
            public final void onClick(DialogInterface dialogInterface, int i) {
                this.f$0.openClickedConvo(convo);
            }
        }, getString(R.string.dialog_button_cancel), new DialogInterface.OnClickListener() { // from class: com.wickr.enterprise.dashboard.ShareExternalContentActivity$$ExternalSyntheticLambda2
            @Override // android.content.DialogInterface.OnClickListener
            public final void onClick(DialogInterface dialogInterface, int i) {
                dialogInterface.dismiss();
            }
        }, null, null, 384, null);
    }

    private final void refreshFileSharePermission() {
        if (this.shareUri == null || WickrConfig.INSTANCE.areFilesEnabled()) {
            return;
        }
        Timber.INSTANCE.i("Showing file sharing disabled dialog", new Object[0]);
        String string = getString(R.string.permissions_feature_disabled_title);
        Intrinsics.checkNotNullExpressionValue(string, "getString(...)");
        String string2 = getString(R.string.permissions_feature_disabled_message);
        Intrinsics.checkNotNullExpressionValue(string2, "getString(...)");
        BaseView.showAlertDialog$default(this, string, string2, true, getString(R.string.dialog_button_ok), new DialogInterface.OnClickListener() { // from class: com.wickr.enterprise.dashboard.ShareExternalContentActivity$$ExternalSyntheticLambda0
            @Override // android.content.DialogInterface.OnClickListener
            public final void onClick(DialogInterface dialogInterface, int i) {
                this.f$0.finish();
            }
        }, null, null, null, null, 480, null);
    }

    /* JADX INFO: Access modifiers changed from: private */
    public final void openClickedConvo(com.wickr.enterprise.dashboard.adapter.WickrConvoModel convo) {
        Intent intentIntentFor$default;
        if (isTablet()) {
            intentIntentFor$default = DashboardListActivity.INSTANCE.intentFor(this, convo.getVGroupID(), null, this.shareText, this.shareUri);
        } else {
            intentIntentFor$default = ConversationActivity.Companion.intentFor$default(ConversationActivity.INSTANCE, this, convo.getVGroupID(), null, this.shareText, this.shareUri, false, 32, null);
        }
        intentIntentFor$default.setFlags(intentIntentFor$default.getFlags() + 268468224);
        startActivity(intentIntentFor$default);
        finish();
    }
}
